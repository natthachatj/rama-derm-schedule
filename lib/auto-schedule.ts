import {dates,weekday,type Year} from './schedule';
import {activityDate,academicStart,academicEnd,type ActivityRow} from './activities';
import {autoRulesSchema,type AutoRules} from './auto-rules';
export {autoRulesSchema,type AutoRules} from './auto-rules';
export function autoSchedule(rows:ActivityRow[],year:Year,rules:AutoRules,holidays:string[],fellowOrder:string[]):ActivityRow[]{
 autoRulesSchema.parse(rules);holidays.forEach(d=>{activityDate.parse(d);if(d<academicStart(year.year)||d>academicEnd(year.year))throw Error('Holiday dates must stay in the selected academic year.')});
 const active=year.fellows.filter(f=>!f.retired);const excluded=new Set(holidays);
 const end=rules.mode==='topics'?`${year.year+1}-05-31`:`${year.year+1}-06-14`;
 const candidates=dates(`${year.year}-07-16`,end).filter(d=>!excluded.has(d)&&(rules.mode==='topics'?rules.weekdays.includes(weekday(d)):weekday(d)===5&&[2,4].includes(Math.ceil(Number(d.slice(8))/7))));
 if(!rows.length)throw Error('Add at least one template topic.');
 if(rules.mode==='topics'){
  if(rows.some(r=>r.type!=='Topic review'))throw Error('Topic review auto-scheduling requires Topic review rows.');
  const all=dates(`${year.year}-07-16`,end).filter(d=>!excluded.has(d));
  const eligible=rows.map(row=>{const days=topicWeekdays(row,rules);return all.map(d=>days.includes(weekday(d)))});
  if(all.length<rows.length||eligible.some(list=>!list.some(Boolean)))throw Error('Not enough eligible dates for a topic. Review its preferred weekdays and holiday exclusions.');
  const first=eligible[0].findIndex(Boolean),last=eligible.at(-1)!.lastIndexOf(true);const day=(j:number)=>Date.parse(all[j])/86400000;
  let previous=all.map(()=>Infinity);const parents:number[][]=[];
  rows.forEach((row,i)=>{const target=rows.length===1?(day(first)+day(last))/2:day(first)+(day(last)-day(first))*i/(rows.length-1);const next=all.map(()=>Infinity),parent=all.map(()=>-1);let best=-1;for(let j=0;j<all.length;j++){if(j>0&&(best<0||previous[j-1]<previous[best]))best=j-1;if(!eligible[i][j])continue;const cost=(day(j)-target)**2;if(i===0)next[j]=cost;else if(best>=0&&Number.isFinite(previous[best])){next[j]=previous[best]+cost;parent[j]=best}}parents.push(parent);previous=next;});
  let selected=previous.reduce((best,cost,j)=>cost<previous[best]?j:best,0);if(!Number.isFinite(previous[selected]))throw Error('Not enough eligible dates to keep this topic order. Move topics, add preferred weekdays, or review holidays.');
  const chosen:number[]=Array(rows.length);for(let i=rows.length-1;i>=0;i--){chosen[i]=selected;selected=parents[i][selected]}
  return rows.map((r,i)=>({...r,date:all[chosen[i]],recurrence:undefined,presenters:r.presenters?.length?r.presenters:[...r.responsible],status:'scheduled'}));
 }
 if(rows.some(r=>r.type!=='Journal club'))throw Error('JC auto-scheduling requires Journal club rows.');
 if(!candidates.length)throw Error('No eligible Journal club dates remain.');
 if(fellowOrder.length!==active.length||new Set(fellowOrder).size!==active.length||fellowOrder.some(id=>!active.some(f=>f.id===id)))throw Error('Include every active fellow once in the Journal club order.');
 return candidates.map((date,i)=>{const r=rows[i%rows.length],f=fellowOrder[i%fellowOrder.length];return {...structuredClone(r),rowId:`${r.rowId}-${i}`,date,responsible:[f],presenters:[f],coPresenters:[],attendees:[],recurrence:undefined,status:'scheduled'}});
}

export function validateAutoPreview(rows:ActivityRow[],year:Year,rules:AutoRules,holidays:string[]){autoRulesSchema.parse(rules);const blocked=new Set(holidays);const type=rules.mode==='topics'?'Topic review':'Journal club';for(const r of rows){if(r.type!==type||r.date<`${year.year}-07-16`||r.date>(rules.mode==='topics'?`${year.year+1}-05-31`:`${year.year+1}-06-14`))throw Error('Preview dates or activity types do not follow this programme’s scheduling rules.');if(blocked.has(r.date))throw Error('A selected date is a holiday. Regenerate the preview.');if(rules.mode==='topics'?!topicWeekdays(r,rules).includes(weekday(r.date)):weekday(r.date)!==5||![2,4].includes(Math.ceil(Number(r.date.slice(8))/7)))throw Error('Preview dates must follow the selected weekdays or second/fourth Friday rule.');if(r.recurrence&&r.recurrence.frequency!=='none')throw Error('Auto-scheduled rows cannot add another recurrence.');}}

export function topicWeekdays(row:ActivityRow,rules:AutoRules){const days=row.preferredWeekdays??rules.weekdays;if(!Array.isArray(days)||!days.length||days.length>7||new Set(days).size!==days.length||days.some(d=>!Number.isInteger(d)||d<0||d>6))throw Error('Choose valid preferred weekdays for each topic.');return days;}
