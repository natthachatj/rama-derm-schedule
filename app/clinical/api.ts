export async function clinicalApi(path: string, body?: unknown, preview = false) { const r = await fetch('/api/clinical/' + path + (path.includes('?') ? '&' : '?') + (preview ? 'preview=1' : ''), { method: body ? 'POST' : 'GET', headers: body ? { 'Content-Type': 'application/json' } : undefined, body: body ? JSON.stringify(body) : undefined, cache: 'no-store' }); const data = await r.json(); if (!r.ok) {
    const e = new Error(data.error || 'Clinical request failed.');
    (e as any).validation = data.validation;
    throw e;
} return data; }
export async function downloadExport(body: any) { const r = await fetch('/api/clinical/export', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); if (!r.ok)
    throw Error((await r.json()).error || 'Export failed.'); const url = URL.createObjectURL(await r.blob()), a = document.createElement('a'); a.href = url; a.download = r.headers.get('Content-Disposition')?.match(/filename="([^"]+)"/)?.[1] || 'case-summary.' + body.format; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
export async function downloadResearch(body: unknown) {
    const r = await fetch('/api/clinical/research', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), cache: 'no-store' });
    if (!r.ok) throw Error((await r.json()).error || 'Unable to export research.');
    const url = URL.createObjectURL(await r.blob()), a = document.createElement('a'); a.href = url; a.download = r.headers.get('Content-Disposition')?.match(/filename="([^"]+)"/)?.[1] || 'Registry-research'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
