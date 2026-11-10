import FacialReference from './facial-reference';
import IntraarterialEditor, {IntraarterialSummary} from './intraarterial-editor';
import {setConditionalAnswer, treatmentGroups, orderedFields} from '../../lib/clinical/conditional';
import { QuantityInput, DateInput } from './quantity-field';
import { reviewIssues, chronology, malformed, retainedText, storedText, meaningfulOriginal } from '../../lib/clinical/review';
import TimelineStatus from './timeline-status';
import EventEditor from './event-editor';
import AttentionList, { jumpToField } from './attention';
import { attention, caseAttention } from '../../lib/clinical/usability';
import { useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { ArrowLeft, ArrowRight, Save, Plus, Trash2, CheckCircle2, AlertTriangle } from 'lucide-react';
import { fields, sectionTitles, SOURCES, type Field } from '../../lib/clinical/catalog';
import { stateLabels, answerText, visible, validateForm, type Answer, type CaseRecord, type CaseEvent, type CaseForm } from '../../lib/clinical/model';
import { clinicalApi } from './api';
import OutcomeEditor from './outcome-editor';
export default function ClinicalForm({ initial, preview = false, owner = false, extraChoices = {}, focusField, onClose, onSaved, onDeleted }: {
    initial: CaseRecord;
    focusField?: string;
    preview?: boolean;
    owner?: boolean;
    extraChoices?: Record<string, string[]>;
    onClose: () => void;
    onSaved: () => void;
    onDeleted?: () => void;
}) {
    const [mobilePreview, setMobilePreview] = useState(false), [trashConfirm, setTrashConfirm] = useState(false);
    const [record, setRecord] = useState(initial), [form, setForm] = useState<CaseForm>({ kind: initial.kind, answers: structuredClone(initial.answers), events: structuredClone(initial.events), timelineStatus:initial.timelineStatus, intraarterial:initial.intraarterial, outcomes: initial.outcomes ? structuredClone(initial.outcomes) : undefined }), [step, setStep] = useState(0), [dirty, setDirty] = useState(false), [saving, setSaving] = useState(false), [error, setError] = useState(''), [errors, setErrors] = useState<{
        field: string;
        message: string;
    }[]>([]), [reason, setReason] = useState(''), [confirmed, setConfirmed] = useState(false), [savedAt, setSavedAt] = useState('');
    const sequence = useRef(0), revision = useRef(initial.revision), savingRef = useRef(false), current = useRef(form);
    current.current = form;
    const sections = [...new Set(fields(form.kind).filter(f => !f.system).map(f => f.section))].sort(), steps = [...sections.map(n => sectionTitles[n]), 'Dated events', 'Outcome & follow-up', 'Review & submit'], review = step === steps.length - 1;
    const needs = [...(owner ? caseAttention({...form,historical:record.historical,managementUnavailable:record.managementUnavailable} as CaseRecord) : attention({...form,historical:record.historical,managementUnavailable:record.managementUnavailable} as CaseRecord)), ...reviewIssues(form,extraChoices)];
    useEffect(()=>{if(!focusField)return; const issue=[...caseAttention({...form,historical:record.historical,managementUnavailable:record.managementUnavailable} as CaseRecord),...reviewIssues(form,extraChoices)].find(i=>i.field===focusField); if(!issue)return; setStep(issue.section==='events'?sections.length:issue.section==='outcomes'?sections.length+1:sections.indexOf(Number(issue.section))); jumpToField(focusField);},[focusField]);
    const editableDraft = record.status === 'draft';
    function update(next: CaseForm) { sequence.current++; setForm(next); setDirty(true); setConfirmed(false); }
    async function save(submit = false) { if (savingRef.current)
        return false; const snapshot = current.current, seq = sequence.current; let validation: ReturnType<typeof validateForm>; try { validation = validateForm(snapshot, submit,extraChoices,record.historical,!!record.managementUnavailable); } catch (e) { setError((e as any).issues?.[0]?.message || (e as Error).message || 'Check the entered information.'); return false; } if (validation.errors.length) {
        setErrors(validation.errors);
        setError(validation.errors[0].message);
        return false;
    } setSaving(true); savingRef.current = true; setError(''); try {
        const result = await clinicalApi('action', { action: submit ? 'submit' : 'save', id: record.id, revision: revision.current, form: snapshot, reason }, preview);
        if (submit) {
            onSaved();
            onClose();
            return true;
        }
        revision.current = result.record.revision;
        setRecord(result.record);
        if (seq === sequence.current)
            setDirty(false);
        setSavedAt(new Date().toLocaleTimeString('en-GB'));
        return true;
    }
    catch (e) {
        setError(e instanceof Error ? e.message : 'Unable to save draft.');
        setErrors((e as any).validation || []);
        return false;
    }
    finally {
        setSaving(false);
        savingRef.current = false;
    } }
    const saveRef = useRef(save);
    saveRef.current = save;
    useEffect(() => { if (!dirty || !editableDraft || trashConfirm)
        return; const timer = setTimeout(() => void saveRef.current(), 12000); return () => clearTimeout(timer); }, [form, dirty, editableDraft, trashConfirm]);
    useEffect(() => { const warn = (e: BeforeUnloadEvent) => { if (dirty) {
        e.preventDefault();
        e.returnValue = '';
    } }; window.addEventListener('beforeunload', warn); return () => window.removeEventListener('beforeunload', warn); }, [dirty]);
    async function leave() { if (dirty && !await save())
        return; onClose(); }
    function demo() { const answers: Record<string, Answer> = {}; for (const f of fields(form.kind).filter(f => !f.system)) {
        answers[f.id] = { state: 'not_applicable', value: '' };
        if (f.condition)
            continue;
        if (f.options?.includes('No'))
            answers[f.id] = { state: 'recorded', value: 'No' };
    } const set = (key: string, value: string) => answers[key] = { state: 'recorded', value }; if (form.kind === 'ravc') {
        set('ravc_B', 'FICTIONAL-HN-001');
        set('ravc_C', 'Fictional patient');
        set('ravc_D', '45');
        set('ravc_K', 'HA');
        set('ravc_L', 'Fictional brand');
        set('ravc_O', '2026-08-01T09:00');
        set('ravc_P', '2026-08-01T10:00');
        set('ravc_Q', '2026-08-02T09:00');
        answers.ravc_W = { state: 'recorded', value: ['Nose'] };
        set('ravc_AI', 'Improved');
        set('ravc_complication_type', 'Vascular complication');
    }
    else {
        set('nodule_B', 'FICTIONAL-HN-002');
        set('nodule_C', '35');
        set('nodule_M', 'HA');
        set('nodule_J', '2026-08-01');
        set('nodule_K', '2026-08-15');
        set('nodule_CV', 'Improved');
    } update({ kind: form.kind, answers, intraarterial:form.kind==='ravc'?{status:'not_performed',days:[]}:undefined, events: [{ id: crypto.randomUUID(), type: 'Treatment', date: '2026-08-15', datePrecision: 'day', title: 'Fictional management event', details: 'Synthetic data for form testing only.', amount: '10', unit: 'units', response: 'Improved' }] }); setError(''); }
    return <section className={'panel clinical-editor ' + (mobilePreview ? 'clinical-mobile-preview' : '')}><div className="panel-head"><div><span className="eyebrow">{preview ? 'FICTIONAL TEST FORM' : editableDraft ? 'PRIVATE DRAFT' : 'OWNER EDIT'}</span><h2>{SOURCES[form.kind].title}</h2><p className="muted">Information only. Upload images and videos yourself in Google Drive after submission.</p></div><button className="button" disabled={saving} onClick={() => void leave()}><ArrowLeft size={15}/>Back</button></div>{preview && <div className="banner"><CheckCircle2 size={17}/><span>Fellow preview — test mode. No real spreadsheet, folder, PDF or statistics will be changed.</span><button className="button small" onClick={demo}>Fill fictional example</button><button className="button small" onClick={() => setMobilePreview(!mobilePreview)}>{mobilePreview ? 'Desktop layout' : 'Mobile layout'}</button></div>}<div className="clinical-progress" aria-label="Form progress">{steps.map((title, i) => <button key={title} className={i === step ? 'active' : ''} onClick={() => { if (!saving)
        setStep(i); }} aria-current={i === step ? 'step' : undefined}><b>{i + 1}</b><span>{title}{needs.some(e => e.section === (i < sections.length ? String(sections[i]) : i === sections.length ? 'events' : 'outcomes')) && <span className="clinical-dot" aria-label="Needs attention"/>}</span></button>)}</div><p className="clinical-save-state" role="status">{saving ? 'Saving…' : dirty ? 'Unsaved changes · automatic draft save after 12 seconds of inactivity' : savedAt ? 'Saved at ' + savedAt : 'Draft stored privately; only you and the clinical owner can access it.'}</p>
 {error && <button className="button small" onClick={onClose}>Return to workspace without saving local changes</button>}{error && <div className="banner warning" role="alert"><AlertTriangle size={17}/><div>{error}{errors.length > 1 && <details><summary>{errors.length} items need attention</summary>{errors.map((e, i) => <button className="clinical-error-link" key={i} onClick={() => { const f = fields(form.kind).find(f => f.id === e.field); setStep(e.field==='intraarterial'?sections.indexOf(5):f ? sections.indexOf(f.section) : e.field === 'outcomes' ? sections.length + 1 : sections.length); }}>{e.message}</button>)}</details>}</div></div>}
 <AttentionList form={{...form,historical:record.historical,managementUnavailable:record.managementUnavailable} as CaseRecord} owner={owner && !editableDraft} extraChoices={extraChoices} onJump={e=>{setStep(e.section === 'events' ? sections.length : e.section === 'outcomes' ? sections.length+1 : sections.indexOf(Number(e.section))); jumpToField(e.field);}}/>
 {editableDraft && <><button type="button" className="button clinical-trash-link" disabled={saving} onClick={()=>setTrashConfirm(true)}><Trash2 size={15}/>Delete draft</button>{trashConfirm && <div className="clinical-leave-shade"><section role="alertdialog" aria-modal="true" aria-label="Move draft to trash" className="clinical-leave-dialog"><h3>Move this draft to trash?</h3><p>Draft reference: {record.id}. Unsaved entries will be discarded. Only the clinical owner can restore this draft. No Drive files will be deleted.</p><button className="button" disabled={saving} onClick={()=>setTrashConfirm(false)}>Keep draft</button><button className="button" disabled={saving} onClick={async()=>{savingRef.current=true;setSaving(true);try{await clinicalApi('action',{action:'deleteDraft',id:record.id,revision:revision.current},preview);(onDeleted || onClose)();}catch(e){setError((e as Error).message);setTrashConfirm(false);}finally{savingRef.current=false;setSaving(false);}}}>Move to trash</button></section></div>}</>}
 {!review && step < sections.length && <div className="clinical-fields"><h3>{steps[step]}</h3><ClinicalFields historical={record.historical} onIntraarterial={intraarterial=>update({...form,intraarterial})} originals={record.sourceRaw} form={form} section={sections[step]} extraChoices={extraChoices} issues={needs} onChange={(id,answer)=>update({...form,answers:setConditionalAnswer(form.kind,form.answers,id,answer)})}/></div>}
 {step === sections.length && <div id="field-events"><TimelineStatus value={form.timelineStatus} onChange={timelineStatus=>update({...form,timelineStatus})}/><EventEditor events={form.events} onChange={events=>update({...form,events})}/></div>}
 {step === sections.length + 1 && <div id="field-outcomes"><OutcomeEditor value={form.outcomes} onChange={outcomes => update({ ...form, outcomes })}/></div>}
 {review && <div><h3>Review your information</h3><p className="muted">After submission you receive a case reference only. The clinical owner handles later corrections and follow-up.</p>{sections.map(n => <details className="clinical-review-section" key={n} open={n === 0}><summary>{sectionTitles[n]}</summary><dl>{fields(form.kind).filter(f => f.section === n && visible(f, form.answers)).map(f => <div key={f.id}><dt>{f.label}{f.required ? ' *' : ''}</dt><dd>{answerText(form.answers[f.id])}</dd></div>)}</dl></details>)}{form.kind==='ravc'&&<IntraarterialSummary value={form.intraarterial} historical={record.historical}/>}<p>{form.events.length} dated event(s) · {form.outcomes?.followups.length || 0} structured follow-up assessment(s)</p><button className="button small" onClick={() => setStep(sections.length + 1)}>Review outcome assessments</button><button className="button" onClick={() => { const result = validateForm(form, true,extraChoices,record.historical,!!record.managementUnavailable); setErrors(result.errors); setError(result.errors[0]?.message || ''); if (!result.errors.length)
        setError('Completeness checks passed. Review the answers, then confirm below.'); }}><CheckCircle2 size={16}/>Check completeness</button><label className="clinical-check"><input type="checkbox" checked={confirmed} onChange={e => { if (e.target.checked) {
        const result = validateForm(form, true,extraChoices,record.historical,!!record.managementUnavailable);
        setErrors(result.errors);
        setError(result.errors[0]?.message || '');
        setConfirmed(!result.errors.length);
    }
    else
        setConfirmed(false); }}/>I have reviewed the information and completed the required fields or marked them not applicable.</label></div>}
 {!editableDraft && <label>Reason for this clinical edit<textarea required minLength={3} maxLength={1000} value={reason} onChange={e => setReason(e.target.value)}/></label>}
 <div className="clinical-form-actions"><button className="button" disabled={saving || step === 0} onClick={() => setStep(n => n - 1)}><ArrowLeft size={15}/>Previous</button><button className="button" disabled={saving || !editableDraft && reason.trim().length < 3} onClick={() => void save()}><Save size={15}/>{editableDraft ? 'Save draft' : 'Save clinical edit'}</button>{review && editableDraft ? <button className="button primary" disabled={saving || !confirmed} onClick={() => void save(true)}>Submit case <CheckCircle2 size={15}/></button> : !review && <button className="button primary" disabled={saving} onClick={async () => { if (editableDraft && dirty && !await save())
        return; setStep(n => n + 1); }}>Next <ArrowRight size={15}/></button>}</div></section>;
}
export function ClinicalField({ field: f, value, onChange, extraChoices, error, errorMessage, original, sequence }: {
    field: Field;
    value?: Answer;
    onChange: (a: Answer) => void;
    extraChoices: string[];
    error: boolean;
    errorMessage?: string;
    original?: string;
    sequence?: {signature:string;message:string};
}) {
    const container = useRef<HTMLDivElement>(null);
    const a = value || { state: 'not_recorded', value: '' };
    const saved=Array.isArray(a.value)?a.value:String(a.value).split(', ').filter(Boolean);
    const options = [...new Set([...(f.options || []), ...extraChoices, ...(f.type==='multi'?saved:[])])];
    const problem=malformed(f,a);
    const hiddenOriginal=!a.corrected&&((a.state!=='recorded'&&(meaningfulOriginal(retainedText(a))||meaningfulOriginal(original||'')))||!storedText(a).trim()&&meaningfulOriginal(original||''));
    const needsReview=hiddenOriginal||!!problem||!!sequence||!!errorMessage&&!/information not recorded|provide an answer/.test(errorMessage);
    const isDoseUnit=f.id==='ravc_dissolution_unit',isGate=f.type==='choice'&&(f.id.endsWith('_status')||['nodule_BK','nodule_CC','nodule_CF','nodule_CZ','nodule_hyal'].includes(f.id));
    const showInput = isDoseUnit || isGate || a.state === 'recorded' || a.state === 'not_recorded';
    const legacyState = !showInput && a.state !== 'not_applicable';
    const inputId = 'answer-' + f.id;
    function recordValue(value: Answer['value']) { onChange({ ...a, state: 'recorded', value }); }
    function startRecording() {
        // Mount the input and focus in the same tap so mobile keyboards open.
        flushSync(() => onChange({ ...a, state: 'recorded' }));
        container.current?.querySelector<HTMLElement>('[data-answer-input]')?.focus();
    }
    return <div id={'field-' + f.id} ref={container} aria-invalid={error || undefined} aria-describedby={error ? inputId + '-error' : undefined} className={'clinical-field ' + (error ? needsReview?'needs-review':'invalid' : '')}>
        <label id={inputId + '-label'} htmlFor={inputId}>{error && <span className="clinical-dot" aria-label="Needs attention"/>}{f.label}{f.required && <span className="required"> *</span>}{f.private && <span className="tag">Private</span>}</label>
        {f.id==='ravc_X'&&<FacialReference/>}
        {(needsReview||!!retainedText(a).trim()||original!==undefined)&&<details className="clinical-original-panel" open={needsReview||!!retainedText(a).trim()}><summary>{needsReview?'● Needs review — original content preserved':'Original content / correction history'}</summary>{original!==undefined&&<><strong>Original source answer</strong><pre>{original||'No answer in the original source'}</pre></>}{!!storedText(a)&&<><strong>{a.state==='recorded'?'Current saved / entered answer':'Retained saved text — status: '+stateLabels[a.state]}</strong><pre>{storedText(a)}</pre></>}{needsReview&&<p>{problem||sequence?.message||errorMessage||(hiddenOriginal?'Original text is retained behind the saved status. Review both manually.':'')}</p>}<p>Correct the structured answer below. Original source content is retained after saving.</p></details>}
        {f.help&&<p className="muted">{f.help}</p>}
        {!isDoseUnit&&!isGate&&<label className="clinical-information-status">Information status<select aria-label={'Information status: '+f.label} value={a.state} onChange={e=>{if(e.target.value==='recorded')startRecording();else onChange({...a,state:e.target.value as Answer['state']});}}><option value="not_recorded">Choose information status</option><option value="recorded">Value known</option><option value="unknown">Unknown</option>{!['ravc_sex','nodule_D','ravc_D','nodule_C'].includes(f.id)&&<><option value="not_assessed">{/dimension|depth|size|length|width/i.test(f.label)?'Not measured':'Not assessed'}</option><option value="none">None / not performed</option></>}<option value="not_applicable">Not applicable</option></select></label>}
        {isDoseUnit&&!['recorded','not_recorded'].includes(a.state)&&<small>Saved unit status: {stateLabels[a.state]}. Select a unit only for a recorded total.</small>}
        {legacyState && <small>Saved answer: {stateLabels[a.state]}. Choose Record or Not applicable to change it.</small>}
        {showInput && <>

            {f.type === 'number' ? <QuantityInput field={f} answer={a} onChange={onChange}/> : (f.type==='date'||f.type==='datetime') ? <DateInput field={f} answer={a} onChange={onChange}/> : f.type === 'choice' ? <select data-answer-input id={inputId} value={isGate&&a.state!=='recorded'?'__'+a.state:isDoseUnit&&a.state!=='recorded'?'':String(a.value)} onChange={e => {if(isGate&&e.target.value.startsWith('__'))onChange({...a,state:e.target.value.slice(2) as Answer['state']});else recordValue(e.target.value);}}><option value="">Choose an answer</option>{isGate&&<><option value="__not_recorded">Select status</option><option value="__unknown">Unknown</option><option value="__not_assessed">Not assessed</option><option value="__none">None / not performed</option><option value="__not_applicable">Not applicable</option></>}{options.map(o => <option key={o}>{o}</option>)}{typeof a.value === 'string' && a.value && !options.includes(a.value) && <option>{a.value}</option>}</select>
                : f.type === 'multi' ? <div className="clinical-choice-list" role="group" aria-labelledby={inputId + '-label'}>{options.map(o => <label className="clinical-check" key={o}><input data-answer-input type="checkbox" checked={Array.isArray(a.value) ? a.value.includes(o) : a.value.split(', ').includes(o)} onChange={e => { const list = Array.isArray(a.value) ? a.value : a.value ? a.value.split(', ') : []; recordValue(e.target.checked ? [...new Set([...list, o])] : list.filter(x => x !== o)); }}/>{o}</label>)}</div>
                    : f.type === 'long' ? <textarea data-answer-input id={inputId} rows={3} maxLength={6000} placeholder="Enter details" value={String(a.value)} onChange={e => recordValue(e.target.value)}/>
                        : <input data-answer-input id={inputId} type="text" maxLength={6000} placeholder="Enter answer" value={String(a.value)} onChange={e => recordValue(e.target.value)}/>
            }
        </>}
        {error && <span id={inputId + '-error'} className="clinical-field-error">{errorMessage || 'Enter an answer or choose Not applicable.'}</span>}
        {!isDoseUnit&&<details open={!!a.details||saved.includes('Other')}><summary>Notes / Other details (optional)</summary><label>Notes / Other details<textarea rows={2} maxLength={2000} value={a.details||''} placeholder="Explain Other, an unavailable treatment, an estimate, or a date exception" onChange={e=>onChange({...a,details:e.target.value})}/></label></details>}
        {sequence&&<button type="button" className="button small" disabled={(a.details||'').trim().length<3} onClick={()=>onChange({...a,sequenceException:[...(a.sequenceException?.split('\n')||[]),sequence.signature].join('\n')})}>Confirm this date exception with my explanation</button>}
    </div>;
}

export function ClinicalFields({form,section,extraChoices,issues,onChange,originals,historical=false,onIntraarterial}:{form:CaseForm;historical?:boolean;onIntraarterial?:(v:NonNullable<CaseForm['intraarterial']>)=>void;originals?:Record<string,string>;section:number;extraChoices:Record<string,string[]>;issues:{field:string;message:string}[];onChange:(id:string,value:Answer)=>void}) {
 const all=orderedFields(form.kind), show=(f:Field)=>visible(f,form.answers)||!form.answers[f.id]?.corrected&&meaningfulOriginal(originals?.[f.header]||''), render=(f:Field)=><ClinicalField key={f.id} field={f} value={form.answers[f.id]} original={originals?.[f.header]} sequence={chronology(form).find(x=>x.field===f.id)} extraChoices={extraChoices[f.id]||[]} error={issues.some(e=>e.field===f.id)} errorMessage={issues.find(e=>e.field===f.id)?.message} onChange={value=>onChange(f.id,value)}/>;
 const grouped=new Set(form.kind==='ravc'&&section===5?treatmentGroups.flatMap(g=>[g.status,...g.ids]):[]);
 return <>{form.kind==='ravc'&&section===5&&<>{treatmentGroups.map(g=>{const children=g.ids.map(id=>all.find(f=>f.id===id)!).filter(Boolean),shown=children.filter(show),status=form.answers[g.status],closed=status?.state==='none'||status?.state==='not_applicable'||status?.state==='recorded'&&['Not performed','Equipment unavailable'].includes(String(status.value));return <section key={g.status} className="clinical-treatment-group"><h3>{g.title}</h3>{render(all.find(f=>f.id===g.status)!)}{closed?<>{shown.length>0&&<details><summary>Preserved treatment details / original content</summary>{shown.map(render)}</details>}</>:shown.map(render)}{closed&&<details><summary>Remaining fields: Not applicable</summary><dl>{children.filter(f=>!show(f)).map(f=><div key={f.id}><dt>{f.label}</dt><dd>Not applicable</dd></div>)}</dl></details>}</section>;})}{onIntraarterial&&<IntraarterialEditor value={form.intraarterial} historical={historical} onChange={onIntraarterial}/>}</>}{all.filter(f=>f.section===section&&show(f)&&!grouped.has(f.id)).map(render)}</>;
}
