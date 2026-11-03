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
  if(candidates.length<rows.length)throw Error('Not enough eligible dates. Choose more weekdays or fewer topics.');
  const first=Date.parse(candidates[0]),last=Date.parse(candidates.at(-1)!);let previous=-1;
  return rows.map((r,i)=>{const target=rows.length===1?(first+last)/2:first+(last-first)*i/(rows.length-1);let best=previous+1;const max=candidates.length-(rows.length-i);for(let j=best;j<=max;j++)if(Math.abs(Date.parse(candidates[j])-target)<Math.abs(Date.parse(candidates[best])-target))best=j;previous=best;return {...r,date:candidates[best],recurrence:undefined,presenters:r.presenters?.length?r.presenters:[...r.responsible],status:'scheduled'}});
 }
 if(rows.some(r=>r.type!=='Journal club'))throw Error('JC auto-scheduling requires Journal club rows.');
 if(!candidates.length)throw Error('No eligible Journal club dates remain.');
 if(fellowOrder.length!==active.length||new Set(fellowOrder).size!==active.length||fellowOrder.some(id=>!active.some(f=>f.id===id)))throw Error('Include every active fellow once in the Journal club order.');
 return candidates.map((date,i)=>{const r=rows[i%rows.length],f=fellowOrder[i%fellowOrder.length];return {...structuredClone(r),rowId:`${r.rowId}-${i}`,date,responsible:[f],presenters:[f],coPresenters:[],attendees:[],recurrence:undefined,status:'scheduled'}});
}

export function validateAutoPreview(rows:ActivityRow[],year:Year,rules:AutoRules,holidays:string[]){autoRulesSchema.parse(rules);const blocked=new Set(holidays);const type=rules.mode==='topics'?'Topic review':'Journal club';for(const r of rows){if(r.type!==type||r.date<`${year.year}-07-16`||r.date>(rules.mode==='topics'?`${year.year+1}-05-31`:`${year.year+1}-06-14`))throw Error('Preview dates or activity types do not follow this programme’s scheduling rules.');if(blocked.has(r.date))throw Error('A selected date is a holiday. Regenerate the preview.');if(rules.mode==='topics'?!rules.weekdays.includes(weekday(r.date)):weekday(r.date)!==5||![2,4].includes(Math.ceil(Number(r.date.slice(8))/7)))throw Error('Preview dates must follow the selected weekdays or second/fourth Friday rule.');if(r.recurrence&&r.recurrence.frequency!=='none')throw Error('Auto-scheduled rows cannot add another recurrence.');}}
