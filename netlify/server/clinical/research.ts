import { z } from 'zod';
import { DRIVE_PARENT, SOURCES } from '../../../lib/clinical/catalog';
import { analyze, type ResearchSnapshot } from '../../../lib/clinical/research';
import type { CaseRecord } from '../../../lib/clinical/model';
import { privatePermissions, clinicalOwnerEmail, type GoogleClient } from './google';
const TAB = 'Registry Research';
export function parseFolderLink(input: unknown) {
    const value = z.string().trim().max(500).parse(input);
    if (/^[A-Za-z0-9_-]{10,150}$/.test(value)) return value;
    let url: URL; try { url = new URL(value); } catch { throw Error('Paste a Google Drive folder link.'); }
    const match = url.pathname.match(/^\/drive\/(?:u\/\d+\/)?folders\/([A-Za-z0-9_-]{10,150})\/?$/);
    if (url.protocol !== 'https:' || url.hostname !== 'drive.google.com' || url.username || url.password || !match) throw Error('Use a Google Drive folder URL, not a file or another website.');
    return match[1];
}
export async function validateCaseFolder(google: GoogleClient, id: string, caseId: string) {
    if (id === DRIVE_PARENT) throw Error('Choose an individual case folder, not the shared destination folder.');
    let current = id; const seen = new Set<string>();
    for (let depth = 0; depth < 30; depth++) {
        if (seen.has(current)) throw Error('Folder ancestry could not be verified.'); seen.add(current);
        const f = await google.request(`drive/v3/files/${current}?fields=id,mimeType,trashed,parents,permissions(type,emailAddress,role),appProperties`);
        if (f.trashed || f.mimeType !== 'application/vnd.google-apps.folder' || !privatePermissions(f.permissions || [], clinicalOwnerEmail())) throw Error('The folder and its ancestors must be available and private to the clinical owner.');
        if (depth === 0 && f.appProperties?.registryCase && f.appProperties.registryCase !== caseId) throw Error('This folder belongs to another registry case.');
        if (f.parents?.includes(DRIVE_PARENT)) return;
        if (!f.parents?.length || f.parents.length !== 1) break;
        current = f.parents[0];
    }
    throw Error('Choose a case folder inside Complications - U/S. No files were moved and no folder was created.');
}
export async function listResearchSnapshots(google: GoogleClient): Promise<ResearchSnapshot[]> {
    const meta = await google.request(`sheets/v4/spreadsheets/${SOURCES.ravc.sheetId}?fields=sheets(properties(title))`);
    if (!meta.sheets?.some((s: any) => s.properties.title === TAB)) return [];
    const rows = await google.values(SOURCES.ravc.sheetId, "'Registry Research'!A2:F");
    return rows.filter((r: any[]) => r[0]).map((r: any[]) => { try { return JSON.parse(r.slice(2, 6).join('')); } catch { throw Error('A saved analysis is damaged. Review the Registry Research tab.'); } });
}
export async function saveResearchSnapshot(google: GoogleClient, records: CaseRecord[], input: unknown, actor: string) {
    const body = z.object({ id: z.string().uuid(), name: z.string().trim().min(1).max(100), config: z.unknown() }).parse(input);
    const existing = await listResearchSnapshots(google), previous = existing.find(s => s.id === body.id);
    if (previous) return previous; // Lost-response retries reuse the immutable snapshot.
    const snapshot: ResearchSnapshot = { id: body.id, name: body.name, created: new Date().toISOString(), actor, result: analyze(records, body.config) };
    const encoded = JSON.stringify(snapshot);
    if (encoded.length > 160000) throw Error('This analysis snapshot is too large. Narrow the date range.');
    const meta = await google.request(`sheets/v4/spreadsheets/${SOURCES.ravc.sheetId}?fields=sheets(properties(title))`);
    if (!meta.sheets?.some((s: any) => s.properties.title === TAB)) await google.request(`sheets/v4/spreadsheets/${SOURCES.ravc.sheetId}:batchUpdate`, 'POST', { requests: [{ addSheet: { properties: { title: TAB, gridProperties: { rowCount: 1000, columnCount: 6 } } } }] });
    await google.append(SOURCES.ravc.sheetId, "'Registry Research'!A:F", [[snapshot.id, snapshot.created, ...Array.from({ length: 4 }, (_, i) => encoded.slice(i * 40000, (i + 1) * 40000))]]);
    return snapshot;
}
