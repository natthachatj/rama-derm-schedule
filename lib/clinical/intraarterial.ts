import {z} from 'zod';
export const arteries=['Facial','Angular','Supratrochlear','Supraorbital','Dorsal nasal','Superficial temporal','Transverse facial','Superior labial','Inferior labial','Other','Unknown'] as const;
export const iaSchema=z.object({status:z.enum(['not_recorded','performed','not_performed','unknown','historical_na']),days:z.array(z.object({id:z.string().uuid(),date:z.string().max(10),guidance:z.enum(['not_recorded','yes','no','unknown']),notes:z.string().max(2000).default(''),injections:z.array(z.object({id:z.string().uuid(),artery:z.string().max(100),otherArtery:z.string().max(120).optional(),dose:z.string().max(40),doseStatus:z.enum(['recorded','unknown']).default('recorded')})).max(100)})).max(100)});
export type Intraarterial=z.infer<typeof iaSchema>;
export const emptyIA=(historical=false):Intraarterial=>({status:historical?'historical_na':'not_recorded',days:[]});
export const decimal=(s:string)=>/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(s)&&Number.isFinite(Number(s));
export const validIADay=(s:string)=>/^\d{4}-\d{2}-\d{2}$/.test(s)&&s>='1900-01-01'&&s<='2100-12-31'&&!isNaN(Date.parse(s))&&new Date(s+'T12:00Z').toISOString().slice(0,10)===s;
export function iaTotals(ia?:Intraarterial){
 if(!ia||ia.status!=='performed')return {sessions:null,units:null,knownUnits:0,incomplete:false};
 const seen=new Set<string>();let knownUnits=0,incomplete=!ia.days.length;
 for(const day of ia.days){if(!validIADay(day.date))incomplete=true;else seen.add(day.date);if(!day.injections.length)incomplete=true;for(const i of day.injections){if(i.doseStatus!=='recorded'||!decimal(i.dose)||Number(i.dose)<=0)incomplete=true;else knownUnits+=Number(i.dose);}}
 if(!Number.isFinite(knownUnits))incomplete=true;
 knownUnits=Number(knownUnits.toPrecision(12));
 return {sessions:seen.size,units:incomplete?null:knownUnits,knownUnits,incomplete};
}
export function iaErrors(ia:Intraarterial|undefined,submit=false,historical=false){
 const errors:string[]=[];if(!ia){if(submit&&!historical)errors.push('Select whether intraarterial dissolution was performed.');return errors;}
 if(ia.status==='historical_na'&&!historical)errors.push('Historical exemption is only available for historical records.');
 if(submit&&ia.status==='not_recorded')errors.push('Select whether intraarterial dissolution was performed.');
 if(ia.status!=='performed'){if(ia.days.length)errors.push('Recorded IA treatment days conflict with the treatment status. Review them before changing status.');return errors;}
 if(submit&&!ia.days.length)errors.push('Add at least one intraarterial treatment day.');
 const dates=new Set<string>(),ids=new Set<string>();
 for(const d of ia.days){if(ids.has(d.id))errors.push('Duplicate treatment-day ID.');ids.add(d.id);if(d.date&&!validIADay(d.date))errors.push('Choose a valid treatment date.');if(d.date&&dates.has(d.date))errors.push('Injections on the same date must be grouped into one treatment day.');dates.add(d.date);if(submit&&!d.date)errors.push('Each IA treatment day needs a date.');if(submit&&d.guidance==='not_recorded')errors.push('Confirm ultrasound guidance for each treatment day.');if(submit&&!d.injections.length)errors.push('Add the artery and dose for each treatment day.');for(const i of d.injections){if(ids.has(i.id))errors.push('Duplicate injection ID.');ids.add(i.id);if(i.doseStatus==='recorded'&&i.dose&&(!decimal(i.dose)||Number(i.dose)<=0))errors.push('IA hyaluronidase dose must be a positive number in IU.');if(submit&&(!arteries.includes(i.artery as any)||i.artery==='Other'&&!i.otherArtery?.trim()))errors.push('Select the injected artery; specify Other when selected.');if(submit&&!historical&&(i.doseStatus!=='recorded'||!i.dose.trim()))errors.push('Each new IA injection requires a numerical hyaluronidase dose.');}}
 return [...new Set(errors)];
}
export function iaRows(ia?:Intraarterial,historical=false):[string,string][]{
 const x=ia||emptyIA(historical),t=iaTotals(x);const rows:[string,string][]=[['IA treatment status',({not_recorded:'Not recorded',performed:'Performed',not_performed:'Not performed',unknown:'Unknown',historical_na:'Not applicable — historical record'})[x.status]]];
 if(x.status==='performed')rows.push(['IA sessions (unique treatment days)',String(t.sessions)],['Total IA hyaluronidase',t.incomplete?t.knownUnits+' IU documented so far — incomplete':t.units+' IU']);
 for(const d of x.days){rows.push([d.date||'Date missing','Ultrasound guidance: '+d.guidance]);for(const i of d.injections)rows.push([i.artery==='Other'?i.otherArtery||'Other':i.artery||'Artery missing',i.doseStatus==='unknown'?'Dose unknown':(i.dose||'Dose missing')+' IU']);if(d.notes)rows.push(['Treatment-day notes',d.notes]);}return rows;
}
