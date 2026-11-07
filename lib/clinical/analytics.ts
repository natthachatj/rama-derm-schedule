import { answerText, recordYear, type CaseRecord } from './model';
const sharedKeys = { material: { ravc: 'ravc_K', nodule: 'nodule_M' }, brand: { ravc: 'ravc_L', nodule: 'nodule_N' }, area: { ravc: 'ravc_W', nodule: 'nodule_R' }, outcome: { ravc: 'ravc_AI', nodule: 'nodule_CV' } };
export function combinedCounts(records: CaseRecord[], factor: keyof typeof sharedKeys = 'material', year?: number, definition: 'visit' | 'injection' | 'academic' = 'visit') { const rows = records.filter(r => r.status !== 'draft' && (year === undefined || recordYear(r, definition) === year)), groups = new Map<string, {
    ravc: number;
    nodule: number;
}>(); let missing = 0; for (const r of rows) {
    const a = r.answers[sharedKeys[factor][r.kind]];
    if (!a || a.state !== 'recorded' || !a.value.length) {
        missing++;
        continue;
    }
    for (const value of Array.isArray(a.value) ? a.value : [a.value]) {
        const key = factor === 'material' ? normalizeMaterial(value) : value;
        const counts = groups.get(key) || { ravc: 0, nodule: 0 };
        counts[r.kind]++;
        groups.set(key, counts);
    }
} return { n: rows.length, missing, recorded: rows.length - missing, rows: [...groups].map(([label, counts]) => ({ label, ...counts })) }; }
export function normalizeMaterial(value: string) { const v = value.trim(); if (/^(cross[- ]linked |non[- ]cross[- ]linked )?HA( filler)?$/i.test(v))
    return 'HA'; for (const known of ['CaHA', 'PLLA', 'PCL', 'PMMA'])
    if (v.toLowerCase() === known.toLowerCase())
        return known; return v; }
export function possibleDuplicates(record: CaseRecord, all: CaseRecord[]) { const hn = (r: CaseRecord) => { const a = r.answers[r.kind === 'ravc' ? 'ravc_B' : 'nodule_B']; return a?.state === 'recorded' ? String(a.value).trim().toLowerCase() : ''; }; const own = hn(record); if (!own)
    return []; return all.filter(r => r.id !== record.id && r.status !== 'draft' && hn(r) === own).map(r => ({ id: r.id, kind: r.kind, visitYear: recordYear(r), linked: record.linkedCaseIds.includes(r.id), reason: 'Same recorded HN. Review dates and clinical episode before linking; this does not prove duplication.' })); }
