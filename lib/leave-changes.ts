import {assignment,type Assignment,type Leave,type Workspace,type Year} from './schedule';
const same=(a:Assignment|undefined|null,b:Assignment|undefined|null)=>a?.fellow===b?.fellow&&!!a?.extra===!!b?.extra;
const copy=(a:Assignment|undefined)=>a?structuredClone(a):null;
function requireValue(value:unknown,message:string):asserts value{if(!value)throw Error(message)}
export function approveLeave(year:Year,leave:Leave){
 requireValue(year.published,'No published plan.');
 for(const item of leave.items){const slot=year.published.slots.find(s=>s.id===item.slot);requireValue(slot&&assignment(year,year.published,item.date,slot)?.fellow===leave.requester,'An assignment has changed. Reject and resubmit this request.');}
 for(const item of leave.items){
  const key=`${item.date}|${item.slot}`,slot=year.published.slots.find(s=>s.id===item.slot)!;
  item.before={published:copy(year.published.overrides[key]),draft:copy(year.draft.overrides[key]),effective:structuredClone(assignment(year,year.published,item.date,slot)!),draftEffective:(()=>{const draftSlot=year.draft.slots.find(s=>s.id===item.slot);return draftSlot?structuredClone(assignment(year,year.draft,item.date,draftSlot)):null})()};
  const applied={fellow:item.replacement,extra:true};year.published.overrides[key]=structuredClone(applied);year.draft.overrides[key]=structuredClone(applied);
 }
}
export function cancelApprovedLeave(state:Workspace,leave:Leave){
 requireValue(leave.status==='approved','Only an approved request can be cancelled.');
 const year=state.years.find(y=>y.year===leave.year);requireValue(year?.published,'The published academic year was not found.');
 const published=structuredClone(year.published),draft=structuredClone(year.draft);
 // Validate and prepare every restoration before changing state. Later coverage must be undone first.
 for(const item of leave.items){
  const key=`${item.date}|${item.slot}`,slot=published.slots.find(s=>s.id===item.slot),applied={fellow:item.replacement,extra:true};
  requireValue(slot&&same(published.overrides[key],applied)&&same(assignment(year,published,item.date,slot),applied),'A requested session changed after approval. Cancel later coverage requests first, or review the assignment manually.');
  const before=item.before;
  if(before){
   if(before.published)published.overrides[key]=structuredClone(before.published);else delete published.overrides[key];
   // A later rotation/template edit must not change who receives the restored session.
   if(!same(assignment(year,published,item.date,slot),before.effective))published.overrides[key]=structuredClone(before.effective);
  }else{
   // Legacy approvals did not save snapshots. Restore the requester, retaining an earlier approved cover when known.
   const earlier=state.leaves.some(l=>l.id!==leave.id&&l.year===leave.year&&l.status==='approved'&&l.decided&&leave.decided&&l.decided<leave.decided&&l.items.some(i=>i.date===item.date&&i.slot===item.slot&&i.replacement===leave.requester));
   published.overrides[key]={fellow:leave.requester,...(earlier?{extra:true}:{})};
  }
  if(same(draft.overrides[key],applied)){
   if(before){if(before.draft)draft.overrides[key]=structuredClone(before.draft);else delete draft.overrides[key];const draftSlot=draft.slots.find(s=>s.id===item.slot);const current=draftSlot&&assignment(year,draft,item.date,draftSlot);if(current&&before.draftEffective&&!same(current,before.draftEffective))draft.overrides[key]=structuredClone(before.draftEffective)}
   else draft.overrides[key]=structuredClone(published.overrides[key]);
  }
 }
 year.published=published;year.draft=draft;year.publishedAt=new Date().toISOString();
 leave.status='cancelled';leave.cancelledAt=new Date().toISOString();
 const recipients=new Set([leave.requester,...leave.items.map(i=>i.replacement)]);
 for(const fellow of recipients){const count=fellow===leave.requester?leave.items.length:leave.items.filter(i=>i.replacement===fellow).length;state.notices.push({id:crypto.randomUUID(),year:leave.year,fellow,text:fellow===leave.requester?`Your approved leave request for ${count} session(s) was cancelled. Your previous clinic assignments have been restored.`:`Approved coverage for ${count} session(s) was cancelled. The previous clinic assignments have been restored; check the updated calendar.`,read:false,created:leave.cancelledAt});}
}
