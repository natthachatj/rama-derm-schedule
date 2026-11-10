import {presentationApprovalQueue} from './presentation-approvals';
import {fellowName,type Year,type Leave} from './schedule';
export type InboxKind='clinical'|'leave'|'presentation';
export type PriorityItem={id:string;kind:InboxKind;title:string;fellow:string;submitted:string;date?:string;year:number;reference?:string};
export type ClinicalQueueRecord={id:string;kind?:string;fellow:string;year:number;status:string;created:string;submittedAt?:string;historical?:boolean;trashedAt?:string};
/** Deliberately excludes patient identifiers, clinical answers, folders and source text. */
export function clinicalApprovalItems(rows:ClinicalQueueRecord[]):PriorityItem[]{return rows.filter(r=>r.status==='submitted'&&['ravc','nodule'].includes(r.kind||'')&&!r.historical&&!r.trashedAt).map(r=>({id:r.id,kind:'clinical',title:r.kind==='ravc'?'RAVC complication case':'Injectable-related nodule',fellow:r.fellow,year:r.year,submitted:r.submittedAt||r.created,reference:r.id}));}
export function scheduleApprovalItems(year:Year,leaves:Leave[],activities:any[],presentations:any[]):PriorityItem[]{
 const name=(id:string)=>fellowName(year.fellows.find(f=>f.id===id));
 return [...leaves.filter(l=>l.year===year.year&&l.status==='pending').map(l=>({id:l.id,kind:'leave' as const,title:l.type?l.type+' leave':'Leave request',fellow:name(l.requester),year:l.year,submitted:l.created,date:[...(l.days||[]).map(d=>d.date),...l.items.map(i=>i.date)].sort()[0]})),...presentationApprovalQueue(year.year,activities,presentations).map(({activity,record})=>({id:record.id,kind:'presentation' as const,title:activity.title||activity.type,fellow:name(record.fellow),year:year.year,submitted:record.finishedAt||record.signoff?.at||record.updated,date:activity.date}))];
}
export function sortPriorityItems(items:PriorityItem[],order:'time'|'newest',today:string):PriorityItem[]{
 const stamp=(v?:string)=>{const n=Date.parse(v||'');return Number.isFinite(n)?n:0;};
 const soon=(r:PriorityItem)=>r.kind!=='clinical'&&!!r.date&&r.date<=new Date(Date.parse(today+'T12:00Z')+7*86400000).toISOString().slice(0,10);
 return [...items].sort((a,b)=>order==='newest'?stamp(b.submitted)-stamp(a.submitted)||a.kind.localeCompare(b.kind)||a.id.localeCompare(b.id):Number(soon(b))-Number(soon(a))||(soon(a)&&soon(b)?String(a.date).localeCompare(String(b.date)):0)||stamp(a.submitted)-stamp(b.submitted)||a.kind.localeCompare(b.kind)||a.id.localeCompare(b.id));
}
export function firstVisitLabel(date?:string){if(!date||!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date))||new Date(date+'T12:00Z').toISOString().slice(0,10)!==date)return 'Date not recorded';return new Date(date+'T12:00Z').toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric',timeZone:'Asia/Bangkok'});}
