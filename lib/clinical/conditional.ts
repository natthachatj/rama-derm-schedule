import type {Answer} from './model';
import {fields,type Field, type RegistryKind} from './catalog';
const meaningful=(a?:Answer)=>!!a&&(Array.isArray(a.value)?a.value.join(''):String(a.value)).trim().length>0;
export function setConditionalAnswer(kind:RegistryKind,answers:Record<string,Answer>,id:string,value:Answer){
 const next={...answers,[id]:value};
 // Never erase saved clinical content. Inconsistent retained children remain visible for review.
 for(let pass=0;pass<3;pass++)for(const f of fields(kind).filter(f=>f.condition)){
  const parent=next[f.condition!.field];if(!parent)continue;
  const enabled=parent.state==='recorded'&&(f.condition!.values.includes('*')||(Array.isArray(parent.value)?parent.value:[String(parent.value)]).some(v=>f.condition!.values.includes(v)));
  const closed=parent.state==='not_applicable'||parent.state==='none'||parent.state==='recorded'&&['No','Not performed','Equipment unavailable','Not prescribed','Not done','None','Negative','Done – negative'].includes(String(parent.value));
  if(!enabled&&closed)next[f.id]={...(next[f.id]||{value:''}),state:'not_applicable'};
  if(enabled&&next[f.id]?.state==='not_applicable'&&!meaningful(next[f.id])&&!next[f.id]?.details)delete next[f.id];
 }
 return next;
}
export const treatmentGroups=[{title:'Filler dissolution',status:'ravc_dissolution_status',ids:['ravc_AE','ravc_AC','ravc_dissolution_total','ravc_dissolution_unit','ravc_dissolution_days','ravc_dissolution_cycles','ravc_AB','ravc_AD','ravc_dissolution_notes']},{title:'LED treatment',status:'ravc_led_status',ids:['ravc_AF','ravc_led_days','ravc_led_notes']},{title:'HBOT treatment',status:'ravc_hbot_status',ids:['ravc_AG','ravc_hbot_days','ravc_hbot_hours','ravc_hbot_notes']}];
export function orderedFields(kind:RegistryKind):Field[]{const all=fields(kind),ordered:Field[]=[],seen=new Set<string>();const add=(f:Field)=>{if(seen.has(f.id))return;seen.add(f.id);if(f.condition){const p=all.find(x=>x.id===f.condition!.field);if(p)add(p);}ordered.push(f);};const grouped=new Set(treatmentGroups.flatMap(g=>[g.status,...g.ids]));const source=kind==='ravc'?[...all.filter(f=>f.section<5),...treatmentGroups.flatMap(g=>[g.status,...g.ids].map(id=>all.find(f=>f.id===id)!).filter(Boolean)),...all.filter(f=>f.section===5&&!grouped.has(f.id)),...all.filter(f=>f.section>5)]:all;source.forEach(add);return ordered;}
