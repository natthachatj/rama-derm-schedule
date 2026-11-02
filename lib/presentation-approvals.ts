import type {Activity} from './activities';
import {presentationRole,type Presentation} from './presentations';
export type ApprovalEntry={activity:Activity;record:Presentation};
/** Pending submissions only, in original submission order within the selected academic year. */
export function presentationApprovalQueue(year:number,activities:Activity[],records:Presentation[]):ApprovalEntry[]{
 const active=new Map(activities.filter(a=>a.year===year&&!a.deleted&&!['draft','cancelled'].includes(a.status)).map(a=>[a.id,a]));
 return records.filter(p=>p.year===year&&p.status==='pending').flatMap(record=>{const activity=active.get(record.activityId);return activity&&presentationRole(activity,record.fellow)?[{activity,record}]:[]}).sort((a,b)=>(a.record.finishedAt||a.record.signoff?.at||a.record.updated).localeCompare(b.record.finishedAt||b.record.signoff?.at||b.record.updated)||a.record.id.localeCompare(b.record.id));
}
