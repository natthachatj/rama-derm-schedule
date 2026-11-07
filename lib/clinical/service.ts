import { editRequestSchema, mergeEdit, auditEdit, same } from './edit';
import { caseSummary, text } from './research';
import { fields, SOURCES, FORM_VERSION, type RegistryKind } from './catalog';
import { newRecord, validateForm, settingsSchema, defaultSettings, safeReceipt, type CaseRecord, type ClinicalSettings } from './model';
import type { ClinicalRepository } from './repository';
export type ClinicalActor = {
    principal: string;
    owner: boolean;
    memberships: {
        year: number;
        id: string;
        name: string;
    }[];
};
export type ClinicalPorts = {
    actor: () => Promise<ClinicalActor | null>;
    repository: ClinicalRepository;
    lock: <T>(fn: () => Promise<T>) => Promise<T>;
    process: (r: CaseRecord, settings: ClinicalSettings) => Promise<CaseRecord>;
    now?: () => string;
    preview?: boolean;
};
const fail = (message: string) => { throw Error(message); };
export function createClinicalService(ports: ClinicalPorts) {
    const repo = ports.repository, now = () => ports.now?.() || new Date().toISOString();
    async function actor() { return await ports.actor() || fail('Sign in to access the clinical workspace.'); }
    async function own(r: CaseRecord, a: ClinicalActor) { return a.owner || r.status === 'draft' && a.memberships.some(m => m.year === r.year && m.id === r.fellow); }
    async function checkEnabled(a: ClinicalActor, r: CaseRecord) { if (!a.owner) {
        const s = await repo.settings();
        if (s.disabledFellows.includes(`${r.year}:${r.fellow}`))
            fail('Clinical submission access is disabled. Contact the clinical owner.');
    } }
    async function list() { const a = await actor(); if (a.owner)
        return (await repo.all()).map(r => ({ id: r.id, kind: r.kind, owner: r.owner, fellow: r.fellow, year: r.year, status: r.status, revision: r.revision, created: r.created, updated: r.updated, historical: r.historical, processing: r.processing, folderId: r.folderId, summary: caseSummary(r), searchText: [r.id, r.fellow, text(r, r.kind === 'ravc' ? 'ravc_B' : 'nodule_B'), ...Object.values(caseSummary(r))].join(' ') })); const rows = await repo.list(); return rows.filter(r => a.memberships.some(m => m.year === r.year && m.id === r.fellow)).map(r => ({ id: r.id, kind: r.kind, status: r.status, year: r.year, created: r.created, updated: r.updated, revision: r.revision, processing: r.processing })); }
    async function read(id: string) { const a = await actor(); if (!a.owner) {
        const index = (await repo.list()).find(r => r.id === id);
        if (!index || index.status !== 'draft' || !a.memberships.some(m => m.year === index.year && m.id === index.fellow))
            fail('Case unavailable. Submitted clinical records are visible only to the clinical owner.');
    } const r = await repo.get(id); if (!r || !await own(r, a))
        fail('Case unavailable. Submitted clinical records are visible only to the clinical owner.'); await checkEnabled(a, r); return r; }
    async function create(kind: RegistryKind, year: number, fellow: string) { return ports.lock(async () => { const a = await actor(); if (!['ravc', 'nodule'].includes(kind) || !Number.isInteger(year) || year < 2020 || year > 2100)
        fail('Select a valid registry and cohort.'); if (!a.owner && !a.memberships.some(m => m.year === year && m.id === fellow))
        fail('Fellow access required.'); const r = newRecord(kind, a.principal, fellow, year, now()); await checkEnabled(a, r); await repo.put(r, a.principal, 'Draft created'); return r; }); }
    async function save(id: string, revision: number, input: unknown, submit = false, reason = '') { return ports.lock(async () => { const a = await actor(), r = await read(id); if (r.revision !== revision)
        fail('This case changed in another window. Reload before saving.'); if (r.status !== 'draft' && !a.owner)
        fail('Submitted records are locked.'); const { form, errors } = validateForm(input, submit); if (form.kind !== r.kind)
        fail('Cannot change registry type.'); if (errors.length) {
        const e = new Error(errors[0].message);
        (e as any).validation = errors;
        throw e;
    } if (r.status !== 'draft' && reason.trim().length < 3)
        fail('Enter a reason for editing this submitted record.'); const next: CaseRecord = { ...r, ...form, formVersion: FORM_VERSION, revision: r.revision + 1, updated: now(), ...(submit ? { status: 'submitted', submittedAt: now(), processing: 'pending', processingError: undefined } : {}) }; if (r.status !== 'draft')
        next.processing = 'pending'; await repo.put(next, a.principal, submit ? 'Submitted' : r.status === 'draft' ? 'Draft saved' : 'Clinical edit: ' + reason.trim()); return a.owner || !submit ? next : safeReceipt(next); }); }
    async function edit(id: string, input: unknown) { return ports.lock(async () => {
        const a = await actor(); if (!a.owner) fail('Clinical-owner access required.');
        const request = editRequestSchema.parse(input), latest = await repo.get(id);
        if (!latest || latest.status === 'draft') fail('Choose a submitted case to edit.');
        const candidates = request.baseRevision === latest.revision ? [latest] : (await repo.revisions(id)).filter(r => r.revision === request.baseRevision);
        const base = candidates[0];
        if (base && candidates.some(r => !same({ kind:r.kind,answers:r.answers,events:r.events,outcomes:r.outcomes }, { kind:base.kind,answers:base.answers,events:base.events,outcomes:base.outcomes }))) fail('The original version has conflicting history entries. Your edits remain on screen; review the saved history before retrying.');
        if (!base) fail('The original saved version is unavailable. Your edits remain on screen; do not close this page.');
        const merged = mergeEdit(base, latest, request);
        if (merged.conflict) return { conflict: merged.conflict };
        if (!merged.changed.length) return { record: latest, unchanged: true };
        const validation = validateForm(merged.record, false), oldErrors = validateForm(latest, false).errors;
        const touched = new Set(merged.changed.map(k => k.startsWith('answer:') ? k.slice(7) : k.startsWith('event:') ? 'events' : 'outcomes'));
        const errors = validation.errors.filter(e => touched.has(e.field) || !oldErrors.some(old => old.field === e.field && old.message === e.message));
        if (errors.length) { const e = new Error(errors[0].message); (e as any).validation = errors; throw e; }
        const next: CaseRecord = { ...merged.record, ...validation.form, revision: latest.revision + 1, formVersion: FORM_VERSION, updated: now(), processing: 'pending', processingError: undefined };
        await repo.put(next, a.principal, auditEdit(next.kind, merged.changed, request.note));
        return { record: next };
    }); }
    async function process(id: string, revision: number) { return ports.lock(async () => { const a = await actor(), r = await repo.get(id); if (!r || r.status === 'draft')
        fail('Submitted case not found.'); if (!a.owner)
        fail('Only the clinical owner can retry processing.'); if (r.revision !== revision)
        fail('Reload the updated case before retrying.'); return processRecord(r, a.principal); }); }
    async function processRecord(r: CaseRecord, principal: string) { let next: CaseRecord; try {
        next = await ports.process(structuredClone(r), await repo.settings());
        next.processing = 'complete';
        delete next.processingError;
    }
    catch (e) {
        next = { ...r, processing: 'failed', processingError: e instanceof Error ? e.message : 'Processing failed. Retry from the owner workspace.' };
    } next.revision = r.revision + 1; next.updated = now(); await repo.put(next, principal, 'Submission processing: ' + next.processing); return next; }
    // Called by the trusted request handler immediately after a successful submission.
    async function processSubmission(id: string) { return ports.lock(async () => { const a = await actor(), r = await repo.get(id); if (!r || r.status === 'draft' || !a.owner && !a.memberships.some(m => m.id === r.fellow && m.year === r.year))
        fail('Case unavailable.'); if (r.processing !== 'pending')
        return safeReceipt(r); return safeReceipt(await processRecord(r, 'system')); }); }
    async function approve(id: string, revision: number) { return ports.lock(async () => { const a = await actor(); if (!a.owner)
        fail('Clinical-owner access required.'); const r = await repo.get(id); if (!r || r.status === 'draft' || r.revision !== revision)
        fail('Reload the submitted case.'); const next: CaseRecord = { ...r, status: 'approved', reviewedAt: now(), updated: now(), revision: r.revision + 1, processing: 'pending' }; await repo.put(next, a.principal, 'Submission reviewed'); return next; }); }
    async function history(id: string) { const a = await actor(); if (!a.owner)
        fail('Clinical-owner access required.'); return repo.revisions(id); }
    async function formOptions() {
        const a = await actor();
        if (!a.owner && !a.memberships.length)
            fail('Clinical fellow access required.');
        const s = await repo.settings();
        if (!a.owner && a.memberships.every(m => s.disabledFellows.includes(`${m.year}:${m.id}`)))
            fail('Clinical submission access is disabled. Contact the clinical owner.');
        // Only intake choices are shared. Export styles, fellow access settings and
        // clinical records remain private to the owner.
        return { extraChoices: structuredClone(s.extraChoices) };
    }
    async function settings(input?: unknown) { const a = await actor(); if (!a.owner)
        fail('Clinical-owner access required.'); if (input === undefined)
        return repo.settings(); return ports.lock(async () => { const s = settingsSchema.parse(input); for (const [id, options] of Object.entries(s.extraChoices)) {
        if (![...fields('ravc'), ...fields('nodule')].some(f => f.id === id && f.options) || new Set(options).size !== options.length)
            fail('Invalid answer-choice settings.');
    } await repo.saveSettings(s); return s; }); }
    async function removeDraft(id: string, revision: number) { return ports.lock(async () => { const a = await actor(); if (!a.owner)
        fail('Clinical-owner approval is required before deleting a draft.'); const r = await repo.get(id); if (!r || r.status !== 'draft' || r.revision !== revision)
        fail('Reload the unfinished draft.'); await repo.put({ ...r, revision: r.revision + 1, updated: now() }, a.principal, 'Owner approved draft deletion'); await repo.removeDraft(id); return { deleted: true }; }); }
    async function link(id: string, revision: number, otherId: string) { return ports.lock(async () => { const a = await actor(); if (!a.owner)
        fail('Clinical-owner access required.'); const r = await repo.get(id), other = await repo.get(otherId); if (!r || !other || r.id === other.id || r.status === 'draft' || other.status === 'draft' || r.revision !== revision)
        fail('Choose two existing submitted cases and reload first.'); for (const [x, y] of [[r, other], [other, r]])
        await repo.put({ ...x, linkedCaseIds: [...new Set([...x.linkedCaseIds, y.id])], revision: x.revision + 1, updated: now() }, a.principal, 'Linked clinical episode'); return { linked: true }; }); }
    async function folder(id: string, revision: number, folderId: string, validate: (id: string, caseId: string) => Promise<void>) { return ports.lock(async () => {
        const a = await actor(); if (!a.owner) fail('Clinical-owner access required.');
        const r = await repo.get(id); if (!r || r.status === 'draft' || r.revision !== revision) fail('Reload the submitted case before linking a folder.');
        await validate(folderId, id);
        const next = { ...r, folderId, pdfId: r.folderId === folderId ? r.pdfId : undefined, revision: r.revision + 1, updated: now() };
        await repo.put(next, a.principal, 'Owner linked an existing private case folder'); return next;
    }); }
    return { edit, folder, list, read, create, save, process, processSubmission, approve, history, settings, formOptions, removeDraft, link };
}
