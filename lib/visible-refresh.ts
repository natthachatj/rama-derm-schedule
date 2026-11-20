type VisibilitySource={visibilityState:string;addEventListener:(type:'visibilitychange',listener:()=>void)=>void;removeEventListener:(type:'visibilitychange',listener:()=>void)=>void};
type WakeSource={addEventListener:(type:string,listener:()=>void)=>void;removeEventListener:(type:string,listener:()=>void)=>void};
// Event-driven checks only. No polling or keep-alive intervals.
export function startVisibleRefresh(source:VisibilitySource,refresh:()=>void,wake:WakeSource|undefined=typeof window==='undefined'?undefined:window){
 let visible=false,disposed=false;
 const check=()=>{if(!disposed&&source.visibilityState==='visible')refresh()};
 function sync(){const next=source.visibilityState==='visible';if(next===visible)return;visible=next;if(visible)check()}
 source.addEventListener('visibilitychange',sync);wake?.addEventListener('focus',check);wake?.addEventListener('online',check);wake?.addEventListener('pageshow',check);sync();
 return()=>{disposed=true;source.removeEventListener('visibilitychange',sync);for(const type of ['focus','online','pageshow'])wake?.removeEventListener(type,check)};
}
export function acceptsSnapshot(currentRevision:number,nextRevision:unknown){return typeof nextRevision==='number'&&Number.isFinite(nextRevision)&&nextRevision>=currentRevision;}
