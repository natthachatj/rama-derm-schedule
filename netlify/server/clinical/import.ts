import {iaSchema} from '../../../lib/clinical/intraarterial';
import { createHash } from 'node:crypto';
import { fields, SOURCES, column, type RegistryKind } from '../../../lib/clinical/catalog';
import { newRecord, answerSchema, type Answer, type CaseRecord } from '../../../lib/clinical/model';
import { SheetsRepository, registryIdHeader, structuredHeaders, quantityHeaders, sourceValue } from './storage';
const fingerprint = (row: string[]) => createHash('sha256').update(JSON.stringify(row)).digest('hex');
export async function importPreview(repo: SheetsRepository, kind: RegistryKind) { const headers = await repo.sourceHeaders(kind), end = column(headers.length - 1), rows = await repo.google.values(SOURCES[kind].sheetId, `'Form Responses 1'!A2:${end}`), idCol = headers.indexOf(registryIdHeader); const existing = new Set((await repo.list()).map(r => r.id)); const typed = rows.length ? await repo.google.request(`sheets/v4/spreadsheets/${SOURCES[kind].sheetId}?includeGridData=true&ranges=${encodeURIComponent(`'Form Responses 1'!A2:${end}${rows.length + 1}`)}&fields=sheets(data(startRow,rowData(values(effectiveValue,effectiveFormat(numberFormat(type))))))`) : null; const typedRows = typed?.sheets?.[0]?.data?.[0]?.rowData || []; return rows.flatMap((row: string[], i: number) => { if (!row.slice(0, idCol >= 0 ? idCol : headers.length).some(Boolean))
    return []; const answers: Record<string, Answer> = {}, sourceRaw: Record<string, string> = {}; for (const f of fields(kind)) {
    const at = headers.indexOf(f.header), raw = at >= 0 ? String(row[at] || '') : '';
    sourceRaw[f.header] = raw;
    if (!f.system && raw) {
        answers[f.id] = { state: 'recorded', value: raw };
        if(f.extra && ['unknown','not applicable','not recorded','not assessed','none'].includes(raw.trim().toLowerCase())) answers[f.id]={state:raw.trim().toLowerCase().replaceAll(' ','_') as Answer['state'],value:''};
        const cell = typedRows[i]?.values?.[at], format = cell?.effectiveFormat?.numberFormat?.type, serial = cell?.effectiveValue?.numberValue;
        if ((f.type === 'date' || f.type === 'datetime') && typeof serial === 'number' && ['DATE', 'DATE_TIME'].includes(format)) {
            const iso = new Date(Date.UTC(1899, 11, 30) + Math.round(serial * 86400000)).toISOString();
            answers[f.id] = { state: 'recorded', value: format === 'DATE_TIME' && f.type === 'datetime' ? iso.slice(0, 16) : iso.slice(0, 10), ...(f.type === 'datetime' && format === 'DATE' ? { precision: 'day' as const } : {}) };
        }
    }
} let timelineStatus:CaseRecord['timelineStatus'];let intraarterial:CaseRecord['intraarterial'];const structuredAt=headers.indexOf('Registry Structured Answers');
 if(structuredAt>=0 && row[structuredAt]) {
  try {const stored=JSON.parse(structuredHeaders.map(h=>{const at=headers.indexOf(h);return at>=0?row[at]||'':'';}).join(''));if(stored.__timelineStatus!==undefined){if(!['recorded','none'].includes(stored.__timelineStatus))throw Error('Invalid management status');timelineStatus=stored.__timelineStatus;}if(stored.__intraarterial)intraarterial=iaSchema.parse(stored.__intraarterial);for(const field of fields(kind).filter(f=>!f.system)){if(stored[field.id]!==undefined){const parsed=answerSchema.safeParse(stored[field.id]);if(!parsed.success)throw Error('Invalid structured answer');const at=headers.indexOf(field.header),cell=at>=0?String(row[at]||''):'';if(at<0||cell===String(sourceValue(field,parsed.data)))answers[field.id]=parsed.data;}}}
  catch {throw Error('Structured answers on source row '+(i+2)+' need review. No import was performed.');}
 }
 const id = idCol >= 0 ? row[idCol] : undefined; return [{ row: i + 2, kind, fingerprint: fingerprint(row), answers, sourceRaw, intraarterial, timelineStatus, existingId: id || undefined, alreadyImported: !!id && existing.has(id), warnings: ['Original answers retained; ambiguous dates and combined fields require owner review.'] }]; }); }
export async function commitImport(repo: SheetsRepository, kind: RegistryKind, selections: {
    row: number;
    fingerprint: string;
}[], actor: string) { if (!Array.isArray(selections) || selections.length < 1 || selections.length > 20 || new Set(selections.map(s => s.row)).size !== selections.length)
    throw Error('Import 1–20 distinct reviewed rows at a time.'); const candidates = await importPreview(repo, kind); const selected = selections.map(s => { const c = candidates.find(c => c.row === s.row && c.fingerprint === s.fingerprint); if (!c)
    throw Error('Source rows changed since preview. Generate a new import preview.'); return c; }); let skipped = 0; const records: CaseRecord[] = []; const headers = await repo.sourceHeaders(kind), at = headers.indexOf(registryIdHeader); if (at < 0)
    throw Error('Complete spreadsheet setup first.'); for (const c of selected) {
    if (c.alreadyImported) {
        skipped++;
        continue;
    }
    const record: CaseRecord = { ...newRecord(kind, actor, 'historical', 0), ...(c.existingId ? { id: c.existingId } : {}), answers: c.answers, timelineStatus:c.timelineStatus, intraarterial:c.intraarterial, sourceRaw: c.sourceRaw, status: 'submitted', historical: true, processing: 'complete', source: { spreadsheet: SOURCES[kind].sheetId, sheet: SOURCES[kind].tab, row: c.row, fingerprint: c.fingerprint } };
    records.push(record);
} await repo.importHistoricalBatch(records, actor, at); return { imported: records.length, skipped }; }
