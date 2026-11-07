import { DRIVE_PARENT, SOURCES } from '../../../lib/clinical/catalog';
import { answerText, recordYear, type CaseRecord, type ClinicalSettings } from '../../../lib/clinical/model';
import { clinicalPdf, exportModel } from '../../../lib/clinical/export';
import { SheetsRepository } from './storage';
export function folderName(r: CaseRecord) { const value = (id: string) => { const a = r.answers[id]; return !a || a.state === 'not_recorded' || a.state === 'unknown' ? 'Unknown' : a.state === 'none' || a.state === 'not_applicable' ? 'NotApplicable' : answerText(a); }; const clean = (s: string) => s.normalize('NFKC').replace(/[^\p{L}\p{N}-]+/gu, '').slice(0, 45) || 'Unknown'; return [String(recordYear(r) || r.year), r.kind === 'nodule' ? 'Nodule' : value('ravc_complication_type'), value(r.kind === 'ravc' ? 'ravc_K' : 'nodule_M'), value(r.kind === 'ravc' ? 'ravc_W' : 'nodule_R'), value(r.kind === 'ravc' ? 'ravc_AB' : 'nodule_hyal_technique'), r.kind === 'ravc' ? value('ravc_AC') : r.answers.nodule_hyal?.value === 'Yes' ? 'Hyaluronidase' : 'NotApplicable', r.id].map(clean).join('_'); }
export async function processClinicalRecord(repo: SheetsRepository, r: CaseRecord, settings: ClinicalSettings) {
    await repo.synchronize(r);
    if (r.historical && !r.folderId)
        return r;
    const parent = await repo.google.request(`drive/v3/files/${DRIVE_PARENT}?fields=id,mimeType,trashed`);
    if (parent.mimeType !== 'application/vnd.google-apps.folder' || parent.trashed)
        throw Error('Configured Drive parent is unavailable.');
    if (!r.folderId) {
        const q = `'${DRIVE_PARENT}' in parents and trashed=false and appProperties has {key='registryCase' and value='${r.id}'}`;
        const list = await repo.google.request(`drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id)`);
        if (list.files.length > 1)
            throw Error('Duplicate case folders found. Review before retrying.');
        r.folderId = list.files[0]?.id;
        if (!r.folderId) {
            const created = await repo.google.request('drive/v3/files?fields=id', 'POST', { name: folderName(r), mimeType: 'application/vnd.google-apps.folder', parents: [DRIVE_PARENT], appProperties: { registryCase: r.id } });
            r.folderId = created.id;
        }
    }
    // Never rename existing folders, recreate deleted media, or share folder permissions.
    const bytes = await clinicalPdf(exportModel(r, true), settings);
    r.pdfId = await repo.google.uploadPdf(r.folderId!, r.id, bytes);
    return r;
}
