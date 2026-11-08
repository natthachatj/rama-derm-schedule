import type { Answer, CaseEvent, CaseRecord } from './model';
export const doseHeaders = ['Structured dissolution total dose', 'Structured dissolution dose unit'] as const;
export const doseIds = ['ravc_dissolution_total', 'ravc_dissolution_unit'] as const;
export const doseUnits = ['IU', 'units', 'mg', 'mL', 'vials', 'Multiple agents: see treatment events', 'Other'];
export const meaningfulDose = (s: string) => !!s.trim() && !/^(?:not applicable|n\/?a|none|no dissolution|not recorded|unknown|-)$/i.test(s.trim());
export function plainDose(a?: Answer) { return a?.state === 'recorded' && typeof a.value === 'string' && a.value.trim() !== '' && Number.isFinite(Number(a.value)) && Number(a.value) >= 0 ? a.value : undefined; }
// Recovery never guesses totals or concentrations and never overwrites a new numerical total.
export function recoverHistoricalDose(record: CaseRecord): CaseRecord | null {
 if (record.kind !== 'ravc' || !record.historical || record.status === 'draft' || record.trashedAt) return null;
 const original = record.sourceRaw?.['Total amount of dissolution agent used'] || '', a = record.answers.ravc_AD;
 if (!meaningfulDose(original) || !a || typeof a.value !== 'string') return null;
 const r = structuredClone(record);
 if (a.state === 'not_applicable' && a.value.trim() === original.trim()) { r.answers.ravc_AD = {state:'recorded',value:original}; return r; }
 // Explicit owner-entered numeric corrections are retained as structured values, without unit conversion.
 if (plainDose(a) !== undefined && original.trim() !== a.value.trim() && !record.answers.ravc_dissolution_total) {
  r.answers.ravc_dissolution_total = structuredClone(a); r.answers.ravc_AD={state:'recorded',value:original}; return r;
 }
 return null;
}
export function treatmentDoseTotals(events: CaseEvent[]) {
 const totals = new Map<string,{agent:string;unit:string;amount:number}>(); let incomplete = 0;
 for (const e of events.filter(e=>e.type==='Treatment' && e.amount?.trim())) {
  const n=Number(e.amount); if (!e.agent?.trim() || !e.unit?.trim() || ['Other','Multiple agents: see treatment events'].includes(e.unit.trim()) || !Number.isFinite(n) || n<0) { incomplete++; continue; }
  const agent=e.agent.trim(),unit=e.unit.trim(),key=JSON.stringify([agent.toLowerCase(),unit.toLowerCase()]);
  const item=totals.get(key)||{agent,unit,amount:0};item.amount+=n;totals.set(key,item);
 }
 return { totals:[...totals.values()], incomplete };
}
