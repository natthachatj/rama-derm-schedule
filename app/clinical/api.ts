// Shared GET requests and session metadata live only in page memory.
let identity='';const sessions=new Map<string,any>();const pending=new Map<string,Promise<any>>();
export function setClinicalIdentity(next:string){if(next!==identity){identity=next;sessions.clear();pending.clear()}}
export function clinicalApi(path:string,body?:unknown,preview=false):Promise<any>{
 const key=identity+':'+path+':'+preview;
 if(!body&&path==='session'&&sessions.has(key))return Promise.resolve(sessions.get(key));
 if(!body&&pending.has(key))return pending.get(key)!;
 const scope=identity;
 const job=(async()=>{const r=await fetch('/api/clinical/'+path+(path.includes('?')?'&':'?')+(preview?'preview=1':''),{method:body?'POST':'GET',headers:body?{'Content-Type':'application/json'}:undefined,body:body?JSON.stringify(body):undefined,cache:'no-store'});const data=await r.json();if(!r.ok){const e=new Error(data.error||'Clinical request failed.');(e as any).validation=data.validation;throw e}if(!body&&path==='session'&&scope===identity)sessions.set(key,data);if(body && (body as {action?:string}).action!=='save'){window.dispatchEvent(new Event('rama-clinical-changed'))}return data})().finally(()=>{if(pending.get(key)===job)pending.delete(key)});
 if(!body)pending.set(key,job);return job;
}
export async function downloadExport(body: any) { const r = await fetch('/api/clinical/export', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); if (!r.ok)
    throw Error((await r.json()).error || 'Export failed.'); const url = URL.createObjectURL(await r.blob()), a = document.createElement('a'); a.href = url; a.download = r.headers.get('Content-Disposition')?.match(/filename="([^"]+)"/)?.[1] || 'case-summary.' + body.format; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
export async function downloadResearch(body: unknown) {
    const r = await fetch('/api/clinical/research', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), cache: 'no-store' });
    if (!r.ok) throw Error((await r.json()).error || 'Unable to export research.');
    const url = URL.createObjectURL(await r.blob()), a = document.createElement('a'); a.href = url; a.download = r.headers.get('Content-Disposition')?.match(/filename="([^"]+)"/)?.[1] || 'Registry-research'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
