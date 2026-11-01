'use client';
import {Clock3} from 'lucide-react';
import type {ReactNode} from 'react';
import type {Assignment,Slot} from '../lib/schedule';
export type AgendaEntry={s:Slot;a:Assignment};
export const sessionLabels={AM:'Morning',PM:'Afternoon',RAVC:'RAVC on-call'};
export const sessionTimes={AM:'08:00–12:00',PM:'13:00–16:00',RAVC:'07:00–21:00'};
export default function AgendaSections({date,entries,renderAssignment,holiday=false,filtered=false,compact=false}:{date:string;entries:AgendaEntry[];renderAssignment:(date:string,slot:Slot,assignment:Assignment)=>ReactNode;holiday?:boolean;filtered?:boolean;compact?:boolean}){
 return <div className={'selected-day-sections agenda-sections '+(compact?'agenda-compact':'')}>{(['AM','PM','RAVC'] as const).map(session=><section className={'selected-session '+(session==='RAVC'?'selected-ravc':'')} aria-label={sessionLabels[session]+' assignments'} key={session}><h3>{session==='RAVC'?<Clock3 size={16}/>:<span className="session-letter">{session}</span>}{sessionLabels[session]}<small>{sessionTimes[session]}</small></h3><div className="selected-session-cards">{entries.filter(({s})=>s.session===session).map(({s,a})=>renderAssignment(date,s,a))}{!entries.some(({s})=>s.session===session)&&<p className="selected-empty">{holiday&&session!=='RAVC'?'Clinics closed for the holiday.':filtered?'No assignments match your filters.':'No assignments scheduled.'}</p>}</div></section>)}</div>
}
