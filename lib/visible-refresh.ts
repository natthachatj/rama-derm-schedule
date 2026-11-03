export const VISIBLE_REFRESH_MS=3*60*1000;
type VisibilitySource={visibilityState:string;addEventListener:(type:'visibilitychange',listener:()=>void)=>void;removeEventListener:(type:'visibilitychange',listener:()=>void)=>void};
type Clock={setInterval:(callback:()=>void,delay:number)=>unknown;clearInterval:(timer:unknown)=>void};
export function startVisibleRefresh(source:VisibilitySource,refresh:()=>void,clock:Clock={setInterval:(callback,delay)=>globalThis.setInterval(callback,delay),clearInterval:timer=>globalThis.clearInterval(timer as ReturnType<typeof setInterval>)} ){
 let timer:unknown=null,visible=false,disposed=false;
 function sync(){if(disposed)return;const next=source.visibilityState==='visible';if(next===visible)return;visible=next;if(timer!==null){clock.clearInterval(timer);timer=null}if(visible){refresh();timer=clock.setInterval(()=>{if(!disposed&&source.visibilityState==='visible')refresh()},VISIBLE_REFRESH_MS)}}
 source.addEventListener('visibilitychange',sync);sync();return()=>{disposed=true;source.removeEventListener('visibilitychange',sync);if(timer!==null)clock.clearInterval(timer);timer=null};
}
export function acceptsSnapshot(currentRevision:number,nextRevision:unknown){return typeof nextRevision==='number'&&Number.isFinite(nextRevision)&&nextRevision>=currentRevision;}
