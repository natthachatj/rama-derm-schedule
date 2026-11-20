type Snapshot={revision:number;accessKey:string;[key:string]:any};
type Channel={postMessage:(message:unknown)=>void;addEventListener:(type:'message',listener:(event:{data:any})=>void)=>void;removeEventListener:(type:'message',listener:(event:{data:any})=>void)=>void};
export function createScheduleSync(options:{fetch:typeof fetch;onData:(data:Snapshot)=>void;channel?:Channel;lock?:(job:()=>Promise<void>)=>Promise<unknown>}){
 let current:Snapshot|undefined,pending:Promise<void>|undefined;
 const seen=new Map<string,Snapshot>();
 function accept(data:Snapshot,announce=true){
  if(!data.accessKey||typeof data.revision!=='number')return;
  if(current?.accessKey===data.accessKey&&data.revision<current.revision)return;
  current=data;seen.clear();seen.set(data.accessKey,data);options.onData(data);
  if(announce)options.channel?.postMessage({type:'snapshot',data});
 }
 const receive=(event:{data:any})=>{const message=event.data;if(message?.type!=='snapshot'||!message.data?.accessKey)return;const data=message.data as Snapshot;
  // Never render another account's view. Retain only same-scope updates in memory.
  if(current?.accessKey===data.accessKey)accept(data,false);
  else if(!current){if(seen.size>=2)seen.clear();seen.set(data.accessKey,data)}
 };
 options.channel?.addEventListener('message',receive);
 async function read(path:string){const r=await options.fetch(path,{cache:'no-store'});const data=await r.json();if(!r.ok)throw Error(data.error||'Unable to refresh the schedule.');return data}
 async function check(){const version=await read('/api/schedule/version');
  if(!version.accessKey||typeof version.revision!=='number')throw Error('Invalid schedule version.');
  const latest=seen.get(version.accessKey)||current;
  if(latest?.accessKey===version.accessKey&&latest.revision===version.revision){if(current!==latest)accept(latest,false);return;}
  // Full response carries its own scope/version, so a concurrent save or sign-out is safe.
  accept(await read('/api/schedule'));
 }
 return {accept,check(){if(pending)return pending;pending=Promise.resolve(options.lock?options.lock(check):check()).then(()=>{}).finally(()=>{pending=undefined});return pending},close(){options.channel?.removeEventListener('message',receive);seen.clear();current=undefined}};
}
