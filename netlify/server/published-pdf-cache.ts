import {createHash} from 'node:crypto';
import {getStore} from '@netlify/blobs';
import type {Year} from '../../lib/schedule';
type PdfCache={get:(key:string)=>Promise<ArrayBuffer|null>;set:(key:string,bytes:Uint8Array)=>Promise<unknown>};
export function publishedPdfInput(y:Year){return {year:y.year,published:y.published!,publishedAt:y.publishedAt,fellows:y.fellows.map(f=>({id:f.id,first:f.first,last:f.last,nick:f.nick,displayName:f.displayName,color:f.color,email:''}))}}
const inFlight=new Map<string,Promise<Uint8Array>>();
export async function publishedPdfResponse(request:Request,y:Year,cache?:PdfCache,build?:(input:ReturnType<typeof publishedPdfInput>)=>Promise<Uint8Array>){
 const input=publishedPdfInput(y),hash=createHash('sha256').update('pdf-v1:'+JSON.stringify(input)).digest('hex'),key='published/'+y.year+'/'+hash,etag='"'+hash+'"';
 const headers={'Content-Type':'application/pdf','Content-Disposition':`attachment; filename="RAMA-Derm-Published-Schedule-${y.year}-${y.year+1}.pdf"`,'Cache-Control':'public, max-age=0, must-revalidate','X-Content-Type-Options':'nosniff','ETag':etag};
 if(request.headers.get('if-none-match')?.split(',').map(v=>v.trim()).includes(etag))return new Response(null,{status:304,headers});
 const store=cache||(()=>{const blobs=getStore({name:'rama-derm-public-pdfs',consistency:'strong'});return {get:(k:string)=>blobs.get(k,{type:'arrayBuffer'}),set:(k:string,bytes:Uint8Array)=>blobs.set(k,Uint8Array.from(bytes).buffer)}})();
 let job=inFlight.get(key);
 if(!job){job=(async()=>{try{const stored=await store.get(key);if(stored)return new Uint8Array(stored)}catch{/* Cache failure must not block downloads. */}
  const generator=build||(await import('../../lib/published-pdf')).buildPublishedPdf;const bytes=await generator(input);try{await store.set(key,bytes)}catch{/* Return generated PDF even if storage is unavailable. */}return bytes})().finally(()=>inFlight.delete(key));inFlight.set(key,job)}
 return new Response(await job as BodyInit,{headers});
}
