import { possibleDuplicates } from '../../../lib/clinical/analytics';
import { getAuthenticatedUser, siteOrigin } from '../auth';
import { loadSnapshot } from '../store';
import { clinicalOwner, accessToken, GoogleClient, connectionInfo, inspectClinicalPrivacy } from './google';
import { SheetsRepository, withClinicalLock } from './storage';
import { processClinicalRecord } from './processing';
import { previewRepository } from './preview';
import { importPreview, commitImport } from './import';
import { createClinicalService, type ClinicalActor } from '../../../lib/clinical/service';
import { clinicalPdf, clinicalPptx, exportModel } from '../../../lib/clinical/export';
import { fellowName } from '../../../lib/schedule';
import { defaultSettings, type CaseRecord } from '../../../lib/clinical/model';
const json = (value: unknown, status = 200) => Response.json(value, { status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
export async function handleClinical(request: Request) {
    try {
        if (process.env.CONTEXT && process.env.CONTEXT !== 'production')
            return json({ error: 'Clinical integrations are disabled on non-production deployments. Use the isolated fictional-data preview.' }, 403);
        const user = await getAuthenticatedUser(request);
        if (!user)
            return json({ error: 'Sign in to access the clinical workspace.' }, 401);
        const owner = clinicalOwner(user), url = new URL(request.url), preview = url.searchParams.get('preview') === '1';
        if (preview && !owner)
            return json({ error: 'Clinical-owner access required for test mode.' }, 403);
        const { state } = await loadSnapshot();
        const memberships = user.localAccess ? user.localAccess.memberships : state.years.flatMap(y => y.fellows.filter(f => f.email && f.email.toLowerCase() === user.email.toLowerCase()).map(f => ({ year: y.year, id: f.id })));
        const active = memberships.flatMap(m => { const f = state.years.find(y => y.year === m.year)?.fellows.find(f => f.id === m.id && !f.retired); return f ? [{ ...m, name: fellowName(f) }] : []; });
        const testMember = { year: 2026, id: 'fictional-fellow', name: 'Fictional fellow' };
        const actor: ClinicalActor = { principal: user.userId, owner: owner && !preview, memberships: preview ? [testMember] : active };
        if (url.pathname === '/api/clinical/session') {
            return json({ owner, eligible: owner || active.length > 0, ownerConfigured: !!process.env.CLINICAL_OWNER_EMAIL, connection: owner ? await connectionInfo() : undefined, memberships: owner ? state.years.flatMap(y => y.fellows.filter(f => !f.retired).map(f => ({ year: y.year, id: f.id, name: fellowName(f) }))) : active, previewMembership: testMember });
        }
        if (!owner && !active.length)
            return json({ error: 'Clinical fellow access required.' }, 403);
        if (request.method !== 'GET' && request.headers.get('origin') !== siteOrigin())
            return json({ error: 'Invalid request origin.' }, 403);
        if (!actor.owner && ['/api/clinical/setup', '/api/clinical/settings', '/api/clinical/history', '/api/clinical/analysis', '/api/clinical/duplicates', '/api/clinical/import', '/api/clinical/export'].includes(url.pathname))
            return json({ error: 'Clinical-owner Google access required.' }, 403);
        let body: any = {};
        if (request.method === 'POST') {
            const text = await request.text();
            if (text.length > 220000)
                return json({ error: 'Clinical request is too large.' }, 413);
            body = JSON.parse(text);
        }
        const repo = preview ? previewRepository(user.userId) : new SheetsRepository(new GoogleClient(await accessToken()));
        const real = repo instanceof SheetsRepository ? repo : null;
        const service = createClinicalService({ actor: async () => actor, repository: repo, lock: withClinicalLock, preview, process: async (r, s) => { if (preview)
                return { ...r, processing: 'complete' }; return processClinicalRecord(real!, r, s); } });
        if (url.pathname === '/api/clinical/setup') {
            if (!owner || preview || !real)
                return json({ error: 'Clinical-owner production setup required.' }, 403);
            if (request.method === 'GET')
                return json({ report: await real.inspect(), privacy: await inspectClinicalPrivacy(real.google), parentId: '1fUqfMTRLxfcl_mSKeiLozlNDG1QYWo5P' });
            if (body.action !== 'initialize' || body.reviewed !== true)
                throw Error('Review the source mappings before initializing supporting tabs.');
            if ((await inspectClinicalPrivacy(real.google)).some(r => !r.privateToOwner))
                throw Error('Make both response spreadsheets and the parent folder private to the clinical owner before initialization. The app never changes sharing permissions.');
            return json(await withClinicalLock(() => real.setup()));
        }
        if (real && (await inspectClinicalPrivacy(real.google)).some(r => !r.privateToOwner))
            return json({ error: 'Clinical access is paused: both response spreadsheets and the parent folder must be private to the clinical owner. Review their Drive sharing settings.' }, 403);
        if (url.pathname === '/api/clinical/records' && request.method === 'GET')
            return json({ records: await service.list() });
        if (url.pathname === '/api/clinical/record' && request.method === 'GET')
            return json({ record: await service.read(url.searchParams.get('id') || '') });
        if (url.pathname === '/api/clinical/settings' && request.method === 'GET')
            return json({ settings: await service.settings() });
        if (url.pathname === '/api/clinical/history' && request.method === 'GET')
            return json({ revisions: await service.history(url.searchParams.get('id') || '') });
        if (url.pathname === '/api/clinical/duplicates' && request.method === 'GET') {
            if (!actor.owner)
                return json({ error: 'Clinical-owner access required.' }, 403);
            const r = await repo.get(url.searchParams.get('id') || '');
            if (!r)
                return json({ error: 'Case not found.' }, 404);
            return json({ matches: possibleDuplicates(r, await repo.all()) });
        }
        if (url.pathname === '/api/clinical/analysis' && request.method === 'GET') {
            if (!actor.owner)
                return json({ error: 'Clinical-owner access required.' }, 403);
            return json({ records: (await repo.all()).filter(r => r.status !== 'draft') });
        }
        if (url.pathname === '/api/clinical/import') {
            if (!actor.owner || !real)
                return json({ error: 'Clinical-owner production access required.' }, 403);
            const kind = request.method === 'GET' ? url.searchParams.get('kind') : body.kind;
            if (!['ravc', 'nodule'].includes(kind))
                throw Error('Choose a registry.');
            return json(request.method === 'GET' ? { candidates: await importPreview(real, kind as any) } : await withClinicalLock(() => commitImport(real, kind, body.selections, user.userId)));
        }
        if (url.pathname === '/api/clinical/export' && request.method === 'POST') {
            if (!actor.owner)
                return json({ error: 'Clinical-owner access required.' }, 403);
            const r = await repo.get(body.id);
            if (!r || r.status === 'draft')
                throw Error('Choose a submitted record.');
            if (body.format !== 'preview' && body.anonymous !== false && body.reviewed !== true)
                throw Error('Review the anonymous preview before exporting.');
            const sections = Array.isArray(body.sections) ? body.sections : undefined;
            if (sections && sections.some((n: any) => !Number.isInteger(n) || n < 0 || n > 7))
                throw Error('Invalid export sections.');
            const model = exportModel(r, body.anonymous !== false, sections, String(body.summary || '').slice(0, 12000));
            if (body.format === 'preview')
                return json({ model });
            const settings = await repo.settings(), pptx = body.format === 'pptx';
            if (!pptx && body.format !== 'pdf')
                throw Error('Choose PDF or PPTX.');
            const bytes = pptx ? await clinicalPptx(model, settings) : await clinicalPdf(model, settings);
            return new Response(bytes as BodyInit, { headers: { 'Content-Type': pptx ? 'application/vnd.openxmlformats-officedocument.presentationml.presentation' : 'application/pdf', 'Content-Disposition': `attachment; filename="${model.anonymous ? r.presentationCode : 'Private-case-summary'}.${pptx ? 'pptx' : 'pdf'}"`, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
        }
        if (url.pathname === '/api/clinical/action' && request.method === 'POST') {
            switch (body.action) {
                case 'create': return json({ record: await service.create(body.kind, Number(body.year), body.fellow) });
                case 'save': return json({ record: await service.save(body.id, body.revision, body.form, false, String(body.reason || '')) });
                case 'submit': {
                    await service.save(body.id, body.revision, body.form, true);
                    return json({ receipt: await service.processSubmission(body.id) });
                }
                case 'approve': {
                    const record = await service.approve(body.id, body.revision);
                    return json({ record });
                }
                case 'retry': return json({ record: await service.process(body.id, body.revision) });
                case 'deleteDraft': return json(await service.removeDraft(body.id, body.revision));
                case 'link': return json(await service.link(body.id, body.revision, body.otherId));
                case 'settings': return json({ settings: await service.settings(body.settings) });
                default: throw Error('Unknown clinical action.');
            }
        }
        return json({ error: 'Clinical route not found.' }, 404);
    }
    catch (e) {
        return json({ error: e instanceof Error ? e.message : 'Clinical service unavailable.', validation: (e as any)?.validation }, 400);
    }
}
