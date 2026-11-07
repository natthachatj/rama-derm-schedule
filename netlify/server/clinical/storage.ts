import { getStore } from '@netlify/blobs';
import { GoogleClient } from './google';
import { SOURCES, column, fields, type RegistryKind } from '../../../lib/clinical/catalog';
import { defaultSettings, type CaseRecord, type ClinicalSettings } from '../../../lib/clinical/model';
import type { ClinicalRepository, RecordIndex } from '../../../lib/clinical/repository';
const INDEX = ['Record ID', 'Owner principal', 'Cohort', 'Status', 'Revision', 'Form version', 'Created', 'Updated', 'Index JSON', 'Data 1', 'Data 2', 'Data 3', 'Data 4'];
const quote = (s: string) => "'" + s.replace(/'/g, "''") + "'";
export const registryIdHeader = 'Registry Record ID';
const lockStore = () => getStore({ name: 'rama-derm-clinical-locks', consistency: 'strong' });
// Locks contain only an opaque lease ID and expiry; clinical answers stay in Sheets.
export async function withClinicalLock<T>(job: () => Promise<T>) { const store = lockStore(), now = Date.now(), lease = crypto.randomUUID(); let old = await store.getWithMetadata('sheet-write', { type: 'json' }); if (old && (old.data as any).until > now)
    throw Error('Another clinical update is being saved. Please retry.'); const acquired = await store.setJSON('sheet-write', { lease, until: now + 180000 }, old ? { onlyIfMatch: old.etag } : { onlyIfNew: true }); if (!acquired.modified)
    throw Error('Another clinical update is being saved. Please retry.'); try {
    return await job();
}
finally {
    const row = await store.getWithMetadata('sheet-write', { type: 'json' });
    if ((row?.data as any)?.lease === lease)
        await store.setJSON('sheet-write', { lease, until: 0 }, { onlyIfMatch: row!.etag });
} }
export class SheetsRepository implements ClinicalRepository {
    constructor(public google: GoogleClient) { }
    async list() { const result: RecordIndex[] = []; for (const kind of ['ravc', 'nodule'] as const) {
        const rows = await this.google.values(SOURCES[kind].sheetId, "'Registry Records'!A2:I");
        for (const r of rows)
            if (r[0]) {
                try {
                    result.push(JSON.parse(r[8]));
                }
                catch {
                    throw Error('Registry index is damaged. Ask the clinical owner to inspect it.');
                }
            }
    } return result; }
    async all() { const result: CaseRecord[] = []; for (const kind of ['ravc', 'nodule'] as const) {
        const rows = await this.google.values(SOURCES[kind].sheetId, "'Registry Records'!J2:M");
        for (const row of rows)
            if (row.some(Boolean))
                result.push(decode(row.join('')));
    } return result; }
    async locate(id: string) { for (const kind of ['ravc', 'nodule'] as const) {
        const rows = await this.google.values(SOURCES[kind].sheetId, "'Registry Records'!A2:A");
        const at = rows.findIndex((r: any[]) => r[0] === id);
        if (at >= 0)
            return { kind, row: at + 2 };
    } return null; }
    async get(id: string) { const found = await this.locate(id); if (!found)
        return null; const row = (await this.google.values(SOURCES[found.kind].sheetId, `'Registry Records'!J${found.row}:M${found.row}`))[0]; if (!row)
        return null; return decode(row.join('')) as CaseRecord; }
    async put(record: CaseRecord, actor: string, action: string) { const found = await this.locate(record.id), spreadsheet = SOURCES[record.kind].sheetId; const row = encode(record); await this.google.append(spreadsheet, "'Registry Revisions'!A:M", [encode({ ...record, history: [{ at: record.updated, actor, action, revision: record.revision }] })]); if (found)
        await this.google.update(spreadsheet, `'Registry Records'!A${found.row}:M${found.row}`, [row]);
    else
        await this.google.append(spreadsheet, "'Registry Records'!A:M", [row]); }
    async revisions(id: string) { const found = await this.locate(id); if (!found)
        return []; const rows = await this.google.values(SOURCES[found.kind].sheetId, "'Registry Revisions'!A2:M"); return rows.filter((r: any[]) => r[0] === id).map((r: any[]) => decode(r.slice(9, 13).join('')) as CaseRecord); }
    async importHistoricalBatch(records: CaseRecord[], actor: string, idColumn: number) {
        if (!records.length) return;
        const kind = records[0].kind, spreadsheet = SOURCES[kind].sheetId;
        if (records.length > 20 || !Number.isInteger(idColumn) || idColumn < 0 ||
            new Set(records.map(r => r.id)).size !== records.length ||
            records.some(r => !r.historical || r.kind !== kind || r.source?.spreadsheet !== spreadsheet || !Number.isInteger(r.source?.row) || r.source!.row < 2))
            throw Error('Invalid historical import batch. Generate a new preview.');
        const meta = await this.google.request(`sheets/v4/spreadsheets/${spreadsheet}?fields=sheets(properties(sheetId,title))`);
        const sheetId = (title: string) => {
            const sheet = meta.sheets?.find((s: any) => s.properties.title === title);
            if (!sheet) throw Error('Complete spreadsheet setup before importing records.');
            return sheet.properties.sheetId;
        };
        const sourceId = sheetId(SOURCES[kind].tab), recordsId = sheetId('Registry Records'), revisionsId = sheetId('Registry Revisions');
        const cells = (record: CaseRecord) => ({ values: encode(record).map(value => ({ userEnteredValue: { stringValue: String(value) } })) });
        const requests: any[] = records.map(record => ({ updateCells: {
            start: { sheetId: sourceId, rowIndex: record.source!.row - 1, columnIndex: idColumn },
            rows: [{ values: [{ userEnteredValue: { stringValue: record.id } }] }], fields: 'userEnteredValue'
        } }));
        requests.push({ appendCells: { sheetId: recordsId, rows: records.map(cells), fields: 'userEnteredValue' } });
        requests.push({ appendCells: { sheetId: revisionsId, rows: records.map(record => cells({ ...record,
            history: [{ at: record.updated, actor, action: 'Historical import · original answers preserved · no folder creation', revision: record.revision }]
        })), fields: 'userEnteredValue' } });
        const body = { requests };
        if (Buffer.byteLength(JSON.stringify(body), 'utf8') > 1800000)
            throw Error('This import batch contains unusually large records. Select fewer rows and retry.');
        // One atomic request writes IDs, records and audit rows together. A failed
        // batch cannot leave source IDs or partial registry rows behind.
        await this.google.request(`sheets/v4/spreadsheets/${spreadsheet}:batchUpdate`, 'POST', body);
    }
    async removeDraft(id: string) { const found = await this.locate(id); if (!found)
        return; const r = await this.get(id); if (r?.status !== 'draft')
        throw Error('Submitted cases cannot be deleted as drafts.'); await this.google.update(SOURCES[found.kind].sheetId, `'Registry Records'!A${found.row}:M${found.row}`, [Array(13).fill('')]); }
    async settings() { const row = (await this.google.values(SOURCES.ravc.sheetId, "'Registry Settings'!A2:B2"))[0]; return row?.[1] ? { ...defaultSettings, ...JSON.parse(row[1]) } : structuredClone(defaultSettings); }
    async saveSettings(settings: ClinicalSettings) { await this.google.update(SOURCES.ravc.sheetId, "'Registry Settings'!A2:B2", [['settings', JSON.stringify(settings)]]); }
    async sourceHeaders(kind: RegistryKind) { return (await this.google.values(SOURCES[kind].sheetId, quote(SOURCES[kind].tab) + '!1:1'))[0] as string[] || []; }
    async synchronize(r: CaseRecord) { const kind = r.kind, id = SOURCES[kind].sheetId, headers = await this.sourceHeaders(kind), idColumn = headers.indexOf(registryIdHeader); if (idColumn < 0)
        throw Error('Registry Record ID column is missing. Review setup first.'); const sourceRows = await this.google.values(id, `${quote(SOURCES[kind].tab)}!A2:${column(idColumn)}`); const matches = sourceRows.flatMap((row: any[], i: number) => row[idColumn] === r.id ? [i + 2] : []); if (matches.length > 1)
        throw Error('Duplicate source ID. Resolve this in the spreadsheet before retrying.'); if (!matches.length) {
        const values = Array(headers.length).fill('');
        for (const field of fields(kind)) {
            if (field.system || field.extra)
                continue;
            const at = headers.indexOf(field.header);
            if (at < 0)
                throw Error('Source headers changed. Review field mappings before retrying.');
            const a = r.answers[field.id];
            values[at] = !a ? 'Not recorded' : a.state === 'recorded' ? Array.isArray(a.value) ? a.value.join(', ') : a.value : a.state.replaceAll('_', ' ');
        }
        values[idColumn] = r.id;
        const timestamp = headers.indexOf('Timestamp');
        if (timestamp >= 0)
            values[timestamp] = r.submittedAt || r.created;
        await this.google.append(id, `${quote(SOURCES[kind].tab)}!A:${column(headers.length - 1)}`, [values]);
        return;
    } const rowNumber = matches[0]; const writes: any[] = []; for (const field of fields(kind)) {
        if (field.system || field.extra)
            continue;
        const at = headers.findIndex(h => h === field.header);
        if (at < 0)
            throw Error('Source headers changed. Review field mappings before retrying.');
        const a = r.answers[field.id];
        writes.push({ range: `${quote(SOURCES[kind].tab)}!${column(at)}${rowNumber}`, values: [[!a ? 'Not recorded' : a.state === 'recorded' ? Array.isArray(a.value) ? a.value.join(', ') : a.value : a.state.replaceAll('_', ' ')]] });
    } writes.push({ range: `${quote(SOURCES[kind].tab)}!${column(idColumn)}${rowNumber}`, values: [[r.id]] }); if (!r.historical) {
        const timestamp = headers.indexOf('Timestamp');
        if (timestamp >= 0)
            writes.push({ range: `${quote(SOURCES[kind].tab)}!${column(timestamp)}${rowNumber}`, values: [[r.submittedAt || r.created]] });
    } await this.google.request(`sheets/v4/spreadsheets/${id}/values:batchUpdate`, 'POST', { valueInputOption: 'RAW', data: writes }); }
    async inspect() { const result: any[] = []; for (const kind of ['ravc', 'nodule'] as const) {
        const meta = await this.google.request(`sheets/v4/spreadsheets/${SOURCES[kind].sheetId}?fields=spreadsheetId,sheets(properties)`), headers = await this.sourceHeaders(kind);
        const expected = fields(kind).filter(f => !f.extra).map(f => f.header);
        result.push({ kind, title: SOURCES[kind].title, missingHeaders: expected.filter(h => !headers.includes(h)), hasRecordId: headers.includes(registryIdHeader), tabs: meta.sheets.map((s: any) => s.properties.title), automationPresent: meta.sheets.some((s: any) => /autocrat|scripts/i.test(s.properties.title)) });
    } return result; }
    async setup() { const report = await this.inspect(); if (report.some(x => x.missingHeaders.length))
        throw Error('Source headers differ from the agreed mapping. Review them before setup.'); for (const item of report) {
        const id = SOURCES[item.kind as RegistryKind].sheetId;
        const requests = ['Registry Records', 'Registry Revisions', ...(item.kind === 'ravc' ? ['Registry Settings'] : [])].filter(name => !item.tabs.includes(name)).map(title => ({ addSheet: { properties: { title, gridProperties: { rowCount: 1000, columnCount: 13, frozenRowCount: 1 } } } }));
        if (requests.length)
            await this.google.request(`sheets/v4/spreadsheets/${id}:batchUpdate`, 'POST', { requests });
        for (const tab of ['Registry Records', 'Registry Revisions'])
            await this.google.update(id, `'${tab}'!A1:M1`, [INDEX]);
        if (item.kind === 'ravc')
            await this.google.update(id, "'Registry Settings'!A1:B1", [['Key', 'Value']]);
        if (!item.hasRecordId) {
            const headers = await this.sourceHeaders(item.kind);
            const meta = await this.google.request(`sheets/v4/spreadsheets/${id}?fields=sheets(properties)`), source = meta.sheets.find((s: any) => s.properties.title === SOURCES[item.kind as RegistryKind].tab);
            if (headers.length >= source.properties.gridProperties.columnCount)
                await this.google.request(`sheets/v4/spreadsheets/${id}:batchUpdate`, 'POST', { requests: [{ appendDimension: { sheetId: source.properties.sheetId, dimension: 'COLUMNS', length: 1 } }] });
            await this.google.update(id, `${quote(SOURCES[item.kind as RegistryKind].tab)}!${column(headers.length)}1`, [[registryIdHeader]]);
        }
    } return this.inspect(); }
}
function encode(r: CaseRecord) { const index: RecordIndex = { trashedAt: r.trashedAt, id: r.id, kind: r.kind, owner: r.owner, fellow: r.fellow, year: r.year, status: r.status, revision: r.revision, created: r.created, updated: r.updated, historical: r.historical, processing: r.processing, searchText: [r.id, r.fellow, ...[r.kind === 'ravc' ? 'ravc_B' : 'nodule_B', r.kind === 'ravc' ? 'ravc_C' : 'nodule_I', r.kind === 'ravc' ? 'ravc_K' : 'nodule_M', r.kind === 'ravc' ? 'ravc_AI' : 'nodule_CV'].map(id => { const a = r.answers[id]; return a?.state === 'recorded' ? Array.isArray(a.value) ? a.value.join(', ') : a.value : ''; })].join(' ') }; const text = JSON.stringify(r); if (text.length > 170000)
    throw Error('This case is too large for the current Sheets record layout. Shorten lengthy notes before saving.'); return [r.id, r.owner, String(r.year), r.status, String(r.revision), String(r.formVersion), r.created, r.updated, JSON.stringify(index), ...[0, 1, 2, 3].map(i => text.slice(i * 44000, (i + 1) * 44000))]; }
function decode(value: string): CaseRecord { try {
    return JSON.parse(value);
}
catch {
    throw Error('Clinical record cannot be decoded. Ask the clinical owner to inspect its stored revision.');
} }
