import { fields, sectionTitles } from './catalog';
import { validateForm, stateLabels, type CaseForm, type CaseRecord } from './model';
import type { EditSection } from './edit';
export type Attention = { field: string; label: string; message: string; section: EditSection; review?: boolean };
export function attention(form: CaseForm): Attention[] {
    let errors: {field:string;message:string}[] = [];
    try { errors = validateForm(form, true).errors; }
    catch (e) { errors = ((e as any).issues || []).map((i: any) => { const p = i.path || []; return { field: p[0] === 'answers' ? p[1] : p[0] || 'outcomes', message: p.filter((x: any) => x !== 'answers').join(' → ') + ': ' + i.message }; }); }
    return errors.map(e => { const f = fields(form.kind).find(f => f.id === e.field); return { ...e, label: f?.label || (e.field === 'events' ? 'Dated event' : 'Outcome & follow-up'), section: f ? String(f.section) as EditSection : e.field === 'events' ? 'events' : 'outcomes' }; });
}
export function legacyReview(form: CaseForm, extraChoices: Record<string,string[]> = {}): Attention[] { return fields(form.kind).filter(f => !f.system && form.answers[f.id]?.state === 'recorded' && f.options && (Array.isArray(form.answers[f.id].value) ? form.answers[f.id].value as string[] : [String(form.answers[f.id].value)]).some(v => v && ![...f.options!, ...(extraChoices[f.id] || [])].includes(v))).map(f => ({field:f.id,label:f.label,section:String(f.section) as EditSection,message:f.label + ': saved answer differs from standard choices; review if needed.',review:true})); }
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
