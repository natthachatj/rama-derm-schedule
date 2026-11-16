import { z } from 'zod';
import { fields, sectionTitles } from './catalog';
import { emptyOutcomes } from './outcomes';
import type { CaseRecord, CaseForm, Answer } from './model';
export const editRequestSchema = z.object({ section: z.enum(['0','1','2','3','4','5','6','7','events','outcomes','followup']), baseRevision: z.number().int().nonnegative(), changes: z.array(z.object({ key: z.string().max(120), value: z.unknown() })).max(300), note: z.string().trim().max(1000).default(''), resolutions: z.record(z.enum(['mine','latest'])).default({}), resolveRevision: z.number().int().nonnegative().optional() });
export type EditSection = z.infer<typeof editRequestSchema>['section'];
export type EditChange = { key: string; value: unknown };
export type EditConflict = { revision: number; items: { key: string; label: string; mine: unknown; latest: unknown }[] };
export const editSectionTitle = (s: EditSection) => s === 'events' ? 'History & management timeline' : s === 'outcomes' ? 'Outcome & follow-up' : s === 'followup' ? 'Add follow-up' : sectionTitles[Number(s)];
function canonical(value: unknown): unknown { if (Array.isArray(value)) return value.map(canonical); if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).filter(([k, v]) => v !== undefined && k !== 'corrected').sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => [k, canonical(v)])); return value; }
export const same = (a: unknown, b: unknown) => JSON.stringify(canonical(a ?? null)) === JSON.stringify(canonical(b ?? null));
export function editItems(r: CaseForm, section: EditSection): Record<string, unknown> {
    if (/^[0-7]$/.test(section)) return {...(section==='5'&&r.kind==='ravc'?{'intraarterial:log':r.intraarterial||null}:{}),...Object.fromEntries(fields(r.kind).filter(f => !f.system && f.section === Number(section)).map(f => ['answer:' + f.id, r.answers[f.id] || null]))};
    if (section === 'events') return {'timeline:status':r.timelineStatus||null,...Object.fromEntries(r.events.map(e => ['event:' + e.id, e]))};
    const o = r.outcomes || emptyOutcomes(), visits = Object.fromEntries(o.followups.map(f => ['followup:' + f.id, f]));
    return section === 'followup' ? visits : { 'outcomes:wound': o.wound, 'outcomes:firstTreatment': o.firstTreatment, 'outcomes:severity': o.severity, 'outcomes:healing': o.healing, ...visits };
}
export function editLabel(kind: CaseRecord['kind'], key: string) { return key==='timeline:status'?'Management timeline status':key==='intraarterial:log'?'Intraarterial treatment log':key.startsWith('answer:') ? fields(kind).find(f => 'answer:' + f.id === key)?.label || 'Clinical answer' : key.startsWith('event:') ? 'Dated event' : key.startsWith('followup:') ? 'Follow-up assessment' : ({ 'outcomes:wound': 'Wound present', 'outcomes:firstTreatment': 'First RAVC treatment date', 'outcomes:severity': 'Initial wound severity', 'outcomes:healing': 'Healing status and dates' }[key] || 'Clinical information'); }
export function editChanges(base: CaseForm, draft: CaseForm, section: EditSection): EditChange[] { const a = editItems(base, section), b = editItems(draft, section); return [...new Set([...Object.keys(a), ...Object.keys(b)])].filter(k => !same(a[k], b[k])).map(key => ({ key, value: b[key] ?? null })); }
export function mergeEdit(base: CaseRecord, latest: CaseRecord, input: unknown) {
    const request = editRequestSchema.parse(input), before = editItems(base, request.section), current = editItems(latest, request.section);
    if (base.id !== latest.id || base.kind !== latest.kind || request.baseRevision !== base.revision || new Set(request.changes.map(c => c.key)).size !== request.changes.length) throw Error('Invalid edit request. Your changes have not been saved.');
    const allowed = new Set(Object.keys(editItems({ ...base, answers: {} }, request.section))), uuid = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
    const conflicts: EditConflict['items'] = [], apply: EditChange[] = [];
    for (const change of request.changes) {
        const collection = request.section === 'events' ? 'event' : ['outcomes','followup'].includes(request.section) ? 'followup' : '';
        if (!allowed.has(change.key) && !(collection && new RegExp('^' + collection + ':' + uuid + '$', 'i').test(change.key))) throw Error('This field does not belong to the selected section.');
        if (same(change.value, before[change.key]) || same(change.value, current[change.key])) continue;
        if (!same(before[change.key], current[change.key])) {
            const choice = request.resolveRevision === latest.revision ? request.resolutions[change.key] : undefined;
            if (!choice) { conflicts.push({ key: change.key, label: editLabel(latest.kind, change.key), mine: change.value, latest: current[change.key] ?? null }); continue; }
            if (choice === 'latest') continue;
        }
        apply.push({ key: change.key, value: change.value });
    }
    if (conflicts.length) return { conflict: { revision: latest.revision, items: conflicts }, changed: [] as string[], record: latest };
    const record = structuredClone(latest);
    for (const change of apply) {
        const [kind, key] = change.key.split(':');
        if(kind==='timeline'){if(change.value===null)delete record.timelineStatus;else record.timelineStatus=change.value as any;}
        else if(kind==='intraarterial'){if(change.value===null)delete record.intraarterial;else record.intraarterial=change.value as any;}
        else if (kind === 'answer') { if (change.value === null) delete record.answers[key]; else record.answers[key] = change.value as Answer; }
        else if (kind === 'event') {
            record.events = record.events.filter(e => e.id !== key);
            if (change.value !== null) { if ((change.value as any)?.id !== key) throw Error('Event identity does not match this change.'); record.events.push(change.value as any); }
        } else {
            record.outcomes ||= emptyOutcomes();
            if (kind === 'followup') { record.outcomes.followups = record.outcomes.followups.filter(f => f.id !== key); if (change.value !== null) { if ((change.value as any)?.id !== key) throw Error('Assessment identity does not match this change.'); record.outcomes.followups.push(change.value as any); } }
            else if (kind === 'outcomes') (record.outcomes as any)[key] = change.value;
        }
    }
    return { record, conflict: undefined, changed: apply.map(c => c.key) };
}
export function auditEdit(kind: CaseRecord['kind'], changed: string[], note = '') { const labels = [...new Set(changed.map(key => editLabel(kind, key)))]; return 'Owner updated ' + labels.join(', ') + (note ? '. Additional explanation: ' + note : ''); }
