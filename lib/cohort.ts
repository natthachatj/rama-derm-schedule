import {makeYear,assignment,dates,type Year,type Workspace} from './schedule';
export const activeFellows=(year:Year)=>year.fellows.filter(f=>!f.retired);
export function resizeCohort(state:Workspace,year:Year,activeIds:string[],count:number){
 if(![3,4,5].includes(count))throw Error('Choose 3–5 active fellows.');
 const current=activeFellows(year);if(new Set(activeIds).size!==activeIds.length||activeIds.some(id=>!current.some(f=>f.id===id))||activeIds.length!==Math.min(count,current.length))throw Error('Choose the fellows to retain.');
 if(year.fellows.length+Math.max(0,count-current.length)>30)throw Error('This cohort has reached its historical profile limit.');
 // Freeze the published rotation order before changing the cohort. No public assignment changes until publication.
 if(year.published&&!year.published.fellowOrder)year.published.fellowOrder=current.map(f=>f.id);
 const removed=current.filter(f=>!activeIds.includes(f.id));for(const f of removed)f.retired=true;
 const fresh=makeYear(year.year,count);while(activeFellows(year).length<count){const i=activeFellows(year).length;year.fellows.push({...fresh.fellows[i],id:crypto.randomUUID()})}
 const active=activeFellows(year);const keepHolidays=year.draft.holidays;
 year.draft={...fresh.draft,holidays:keepHolidays,fellowOrder:active.map(f=>f.id),reviewed:false};year.dirty=true;
 return removed.map(f=>f.id);
}
export function cohortImpact(state:Pick<Workspace,'activities'|'leaves'>,year:Year,retained:string[]){const removed=new Set(activeFellows(year).filter(f=>!retained.includes(f.id)).map(f=>f.id));let sessions=0;if(year.published)for(const d of dates(`${year.year}-07-01`,`${year.year+1}-06-30`))for(const s of year.published.slots)if(removed.has(assignment(year,year.published,d,s)?.fellow||''))sessions++;return {sessions,activities:(state.activities||[]).filter(a=>a.year===year.year&&!a.deleted&&a.status!=='cancelled'&&[...a.responsible,...a.presenters||[],...a.coPresenters||[]].some(id=>removed.has(id))),requests:(state.leaves||[]).filter(l=>l.year===year.year&&l.status==='pending'&&(removed.has(l.requester)||l.items.some(i=>removed.has(i.replacement))))};}
