import {activityTypes,type Activity} from './activities';
import {presentationCredit,presentationRole,requiresInstructorSignoff,type Presentation} from './presentations';
export const learningBuckets=[{key:'completed',label:'Completed'},{key:'awaiting',label:'Awaiting action'},{key:'upcoming',label:'Upcoming'},{key:'past',label:'Past, not submitted'}] as const;
export type LearningBucket=typeof learningBuckets[number]['key'];
export type LearningItem={activity:Activity;record?:Presentation;role:'presenter'|'co-presenter'};
export type LearningCategory={type:typeof activityTypes[number]}&Record<LearningBucket,LearningItem[]>;
export const learningNow=()=>new Date(Date.now()+7*3600000).toISOString().slice(0,16);
/** Bangkok wall-clock time. Every active presenter assignment belongs to exactly one group. */
export function learningProgress(year:number,activities:Activity[],records:Presentation[],fellow:string,at=learningNow()):LearningCategory[]{
 const result=activityTypes.map(type=>({type,completed:[],awaiting:[],upcoming:[],past:[]} as LearningCategory));
 const own=new Map(records.filter(p=>p.year===year&&p.fellow===fellow).map(p=>[p.activityId,p]));
 for(const a of activities){const role=presentationRole(a,fellow);if(a.year!==year||a.deleted||['draft','cancelled'].includes(a.status)||!role)continue;const p=own.get(a.id);let bucket:LearningBucket;
  if(p&&presentationCredit(p,activities))bucket='completed';
  else if(p&&['pending','returned'].includes(p.status))bucket='awaiting';
  else if(a.date>at.slice(0,10)||a.date===at.slice(0,10)&&(a.allDay||a.end>at.slice(11,16)))bucket='upcoming';
  else if(p?.status==='awaiting_signature'&&requiresInstructorSignoff(a.type))bucket='awaiting';
  else bucket='past';
  result.find(c=>c.type===a.type)![bucket].push({activity:a,record:p,role});
 }
 for(const c of result)for(const {key} of learningBuckets)c[key].sort((a,b)=>a.activity.date.localeCompare(b.activity.date)||a.activity.start.localeCompare(b.activity.start)||a.activity.title.localeCompare(b.activity.title));
 return result;
}
