import { reviewIssues, hasAnswer } from './review';
import { fields, sectionTitles } from './catalog';
import { validateForm, visible, stateLabels, type CaseForm, type CaseRecord } from './model';
import type { EditSection } from './edit';
export type Attention = { field: string; label: string; message: string; section: EditSection; review?: boolean };
export function attention(form: CaseForm): Attention[] {
    let errors: {field:string;message:string}[] = [];
    try { errors = validateForm(form, true,{},!!(form as CaseRecord).historical).errors; }
    catch (e) { errors = ((e as any).issues || []).map((i: any) => { const p = i.path || []; return { field: p[0] === 'answers' ? p[1] : p[0] || 'outcomes', message: p.filter((x: any) => x !== 'answers').join(' → ') + ': ' + i.message }; }); }
    return errors.map(e => { const f = fields(form.kind).find(f => f.id === e.field); return { ...e, label: f?.label || (e.field === 'events' ? 'Dated event' : 'Outcome & follow-up'), section: e.field==='intraarterial'?'5':f ? String(f.section) as EditSection : e.field === 'events' ? 'events' : 'outcomes' }; });
}
/** Clinical completeness is separate from submission validation and export status. */
export function caseAttention(form: CaseForm): Attention[] {
 const issues = attention(form).filter(i=>!hasAnswer(form.answers[i.field]));
 const essential = form.kind === 'ravc'
  ? ['ravc_sex','ravc_D','ravc_Q','ravc_W','ravc_K','ravc_AB','ravc_AC','ravc_AI','ravc_R']
  : ['nodule_D','nodule_C','nodule_K','nodule_R','nodule_M','nodule_CM','nodule_CO','nodule_CV'];
 for (const id of essential) {
  const f = fields(form.kind).find(f=>f.id===id), a=form.answers[id];
  if (f && visible(f,form.answers) && (!a || a.state==='not_recorded' || (a.state==='recorded' && !(Array.isArray(a.value)?a.value.join('').trim():String(a.value||'').trim()))))
   issues.push({field:id,label:f.label,section:String(f.section) as EditSection,message:f.label+': information not recorded.'});
 }
 return [...new Map(issues.map(i=>[i.field,i])).values()];
}
export type CaseSort = 'visit' | 'created' | 'updated';
export function sortCaseRows<T extends {id:string;visitDate?:string;created?:string;updated?:string}>(rows:T[], basis:CaseSort='visit', direction:'asc'|'desc'='desc'):T[] {
 const time=(r:T)=>{ const v=basis==='visit'?r.visitDate:r[basis]; const n=v?Date.parse(v):NaN; return Number.isFinite(n)?n:null; };
 return [...rows].sort((a,b)=>{const x=time(a),y=time(b);return x===null?(y===null?a.id.localeCompare(b.id):1):y===null?-1:(x-y)*(direction==='asc'?1:-1)||a.id.localeCompare(b.id);});
}
export function processingLabel(value:string) { return ({complete:'Sheet/PDF updated',pending:'Sheet/PDF update pending',failed:'Sheet/PDF update failed',draft:'Draft'} as Record<string,string>)[value] || 'Sheet/PDF status: '+value; }
export function legacyReview(form: CaseForm, extraChoices: Record<string,string[]> = {}): Attention[] { return reviewIssues(form,extraChoices) as Attention[]; }
export const sectionName = (s: EditSection) => /^[0-7]$/.test(s) ? sectionTitles[Number(s)] : s === 'events' ? 'Dated events' : 'Outcome & follow-up';
export const commonFilters = [
 {id:'sex',label:'Sex',keys:['ravc_sex','nodule_D']},
 {id:'material',label:'Material type',keys:['ravc_K','nodule_M']},
 {id:'complication',label:'Complication type',keys:['ravc_complication_type','nodule_AR']},
 {id:'area',label:'Affected / worst area',keys:['ravc_W','nodule_R']},
 {id:'technique',label:'Dissolution technique',keys:['ravc_AB','nodule_hyal_technique']},
 {id:'agent',label:'Dissolution agent',keys:['ravc_AC','nodule_hyal']},
 {id:'brand',label:'Product brand',keys:['ravc_L','nodule_N']},
];
export function filterDefinitions(kind = '') {
 const all = [...fields('ravc'), ...fields('nodule')];
 return [...commonFilters, ...all.filter(f => !f.system && f.options && !commonFilters.some(c=>c.keys.includes(f.id))).map(f => ({id:f.id,label:(f.id.startsWith('ravc')?'RAVC · ':'Nodule · ')+f.label,keys:[f.id]}))].filter(d => !kind || d.keys.some(k => k.startsWith(kind + '_')));
}
export function registryValues(r: CaseRecord): Record<string,string[]> {
 return Object.fromEntries(filterDefinitions().filter(d=>d.keys.some(k=>k.startsWith(r.kind+'_'))).map(d => [d.id, [...new Set(d.keys.filter(k=>k.startsWith(r.kind+'_')).flatMap(k=> { const a=r.answers[k]; if(!a || a.state==='not_recorded')return ['Not recorded']; if(a.state!=='recorded')return [stateLabels[a.state]]; if(d.id==='agent' && k==='nodule_hyal')return [a.value==='Yes'?'Hyaluronidase':a.value==='No'?'None':String(a.value)]; return (Array.isArray(a.value)?a.value:[a.value]).map(v=>v.trim()).filter(Boolean).length ? (Array.isArray(a.value)?a.value:[a.value]).map(v=>v.trim()).filter(Boolean) : ['Not recorded']; }))]]));
}
export function matchesFilters(values: Record<string,string[]> = {}, filters: Record<string,string[]> = {}) { return Object.entries(filters).every(([key, selected])=>!selected.length || selected.some(v=>(values[key] || []).includes(v))); }
