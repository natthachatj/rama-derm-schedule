import { fields, type Field } from './catalog';
import type { Answer, CaseForm, CaseRecord } from './model';
export type ReviewIssue = {field:string;label:string;message:string;section:string;review:true};
export const values=(a?:Answer):string[]=>a?.state==='recorded'?(Array.isArray(a.value)?a.value:String(a.value).split(', ')).filter(Boolean):[];
export const storedText=(a?:Answer)=>!a?'':Array.isArray(a.value)?a.value.join(', '):a.value;
export const retainedText=(a?:Answer)=>a?.state!=='recorded'?storedText(a):'';
export const meaningfulOriginal=(s:string)=>!!s.trim()&&!/^(none|n\/?a|not applicable|not recorded|unknown|not assessed|-)$/i.test(s.trim());
export const rawValue=(a?:Answer)=>a?.state==='recorded'?(Array.isArray(a.value)?a.value.join(', '):a.value):'';
export function conditionMet(f:Field,answers:Record<string,Answer>) {if(!f.condition)return true;const a=answers[f.condition.field];return a?.state==='recorded'&&(f.condition.values.includes('*')||f.condition.values.includes(String(a.value)));}
export function hasAnswer(a?:Answer){return !!a&&(a.state!=='not_recorded')&&(a.state!=='recorded'||!!rawValue(a).trim());}
export function validClinicalDay(s:string) {if(!/^\d{4}-\d{2}-\d{2}$/.test(s))return false;const d=new Date(s+'T12:00:00Z');return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===s&&Number(s.slice(0,4))>=1900&&Number(s.slice(0,4))<=2100;}
export function malformed(f:Field,a?:Answer):string|undefined {
 if(a?.state!=='recorded')return;
 const s=rawValue(a).trim();
 if(f.type==='number') {
  if(!/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(s)||!Number.isFinite(Number(s))||Number(s)<(f.min??0)||Number(s)>(f.max??1e9)||f.integer&&!Number.isInteger(Number(s)))return 'Saved answer is not a valid '+(f.integer?'whole-number count':'number')+'. Original content is preserved; enter a structured value or select an information status.';
  if(a.upper!==undefined&&a.upper!==''&&(!f.range||!/^\d+$/.test(a.upper)||!Number.isFinite(Number(a.upper))||Number(a.upper)<Number(s)||f.integer&&!Number.isInteger(Number(a.upper))))return 'The estimated upper count must be a whole number at least as large as the lower count.';
  if(f.units&&a.unit&&!f.units.includes(a.unit))return 'The saved unit does not match this quantity.';
 }
 if(f.type==='date'||f.type==='datetime') {
  if(!validClinicalDay(s.slice(0,10)))return /^2[45]\d{2}/.test(s)?'Buddhist year saved as a Gregorian year. Review and explicitly confirm the calendar conversion.':'Saved date needs review. Use a valid Gregorian date from 1900 to 2100.';
  if(f.type==='date'&&!/^\d{4}-\d{2}-\d{2}$/.test(s)||f.type==='datetime'&&!(a.precision==='day'?/^\d{4}-\d{2}-\d{2}$/:/^\d{4}-\d{2}-\d{2}T([01]\d|2[0-3]):[0-5]\d$/).test(s))return 'Saved date/time format needs review. Keep the original answer visible while correcting it.';
 }
}
export function chronology(form:CaseForm) {
 const pairs=form.kind==='ravc'?[['ravc_O','ravc_P'],['ravc_O','ravc_Q'],['ravc_P','ravc_Q'],['ravc_Q','ravc_R']]:[['nodule_J','nodule_AB'],['nodule_J','nodule_K'],['nodule_AB','nodule_K'],['nodule_K','nodule_CK']];
 return pairs.flatMap(([before,after])=>{const a=form.answers[before],b=form.answers[after],x=rawValue(a),y=rawValue(b);if(!validClinicalDay(x.slice(0,10))||!validClinicalDay(y.slice(0,10)))return [];const dayOnly=x.length===10||y.length===10;const bad=dayOnly?y.slice(0,10)<x.slice(0,10):y<x;const signature=before+':'+x+'|'+after+':'+y;if(!bad||b?.sequenceException?.split('\n').includes(signature)&&(b.details||'').trim().length>=3)return [];return [{field:after,before,signature,message:'This date/time precedes '+(fields(form.kind).find(f=>f.id===before)?.label||before)+'. Correct it, or document and confirm a clinical exception.'}];});
}
export function reviewIssues(form:CaseForm & {sourceRaw?:Record<string,string>},extraChoices:Record<string,string[]>={}):ReviewIssue[] {
 const all=fields(form.kind),issues:ReviewIssue[]=[];
 const add=(f:Field,message:string)=>issues.push({field:f.id,label:f.label,section:String(f.section),message,review:true});
 for(const f of all.filter(f=>!f.system)) {
  const a=form.answers[f.id],s=rawValue(a),problem=malformed(f,a);
  const original=form.sourceRaw?.[f.header]||'';
  if(!a?.corrected&&((a?.state!=='recorded'&&(meaningfulOriginal(retainedText(a))||meaningfulOriginal(original)))||!storedText(a).trim()&&meaningfulOriginal(original)))add(f,'Saved information is retained behind an unavailable or missing status. Review the original text and status manually; neither has been changed.');
  if(problem)add(f,problem);
  if(a?.state==='recorded'&&f.options){const opts=[...f.options,...(extraChoices[f.id]||[])];if(values(a).some(v=>!opts.includes(v)))add(f,'Saved choice is outside the current options. Review its meaning; the original selection remains visible.');}
  if(f.condition&&!conditionMet(f,form.answers)&&a?.state==='recorded'&&s.trim())add(f,'Saved information exists although its parent answer does not enable this question. Review both answers; this content remains visible.');
  if(f.type==='number'&&f.units&&f.units.length>1&&s&&!a?.unit)add(f,'Quantity unit is not explicitly recorded. Select the unit without guessing or converting the original answer.');
 }
 for(const x of chronology(form)){const f=all.find(f=>f.id===x.field);if(f)add(f,x.message);}
 if(form.kind==='ravc')for(const [prefix,id] of [['dissolution','ravc_AE'],['led','ravc_AF'],['hbot','ravc_AG']]) {
  const status=rawValue(form.answers['ravc_'+prefix+'_status']), count=rawValue(form.answers[id]);
  if(['Not performed','Equipment unavailable'].includes(status)&&count.trim()&&Number.isFinite(Number(count))&&Number(count)>0)add(all.find(f=>f.id===id)!,'A positive session count conflicts with the treatment status. Review both answers.');
 }
 if(form.kind==='ravc'&&rawValue(form.answers.ravc_AI)&&!hasAnswer(form.answers.ravc_response))add(all.find(f=>f.id==='ravc_AI')!,'Original outcome combines response, sequelae or follow-up. Review the separate outcome fields.');
 if(form.kind==='nodule'&&rawValue(form.answers.nodule_BB)&&(!hasAnswer(form.answers.nodule_homogeneity)||!hasAnswer(form.answers.nodule_composition)))add(all.find(f=>f.id==='nodule_BB')!,'Original internal structure may describe homogeneity rather than solid/cystic composition. Review the separate questions.');
 return [...new Map(issues.map(i=>[i.field,{...i,message:issues.filter(j=>j.field===i.field).map(j=>j.message).filter((m,n,a)=>a.indexOf(m)===n).join(' ')}])).values()];
}
export function originalContent(r:Pick<CaseRecord,'sourceRaw'>,f:Field){return r.sourceRaw?.[f.header];}
// Server-owned snapshots: clients cannot remove or rewrite preserved originals.
export function preserveCorrections(previous:CaseRecord,next:CaseRecord) {
 const result=structuredClone(next);result.sourceRaw=previous.sourceRaw?structuredClone(previous.sourceRaw):undefined;
 for(const f of fields(previous.kind).filter(f=>!f.system)){
  const old=previous.answers[f.id],a=result.answers[f.id];
  const clean=(x?:Answer)=>x?JSON.stringify({...x,corrected:undefined}):'';
  if(clean(old)!==clean(a)) {
   if(a)a.corrected=true;
   if(old&&(hasAnswer(old)||storedText(old).trim())){result.sourceRaw||={};if(result.sourceRaw[f.header]===undefined)result.sourceRaw[f.header]=(old.state==='recorded'?rawValue(old)+(old.upper?'–'+old.upper:'')+(old.unit?' '+old.unit:''):old.state.replaceAll('_',' ')+(storedText(old)?' · Retained saved text: '+storedText(old):''))+(old.details?' · '+old.details:'');}
  }else if(a){if(old?.corrected)a.corrected=true;else delete a.corrected;}
 }
 return result;
}
