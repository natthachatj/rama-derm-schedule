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
    const [record, setRecord] = useState(initial), [form, setForm] = useState<CaseForm>({ kind: initial.kind, answers: structuredClone(initial.answers), events: structuredClone(initial.events), outcomes: initial.outcomes ? structuredClone(initial.outcomes) : undefined }), [step, setStep] = useState(0), [dirty, setDirty] = useState(false), [saving, setSaving] = useState(false), [error, setError] = useState(''), [errors, setErrors] = useState<{
        field: string;
        message: string;
    }[]>([]), [reason, setReason] = useState(''), [confirmed, setConfirmed] = useState(false), [savedAt, setSavedAt] = useState('');
    const sequence = useRef(0), revision = useRef(initial.revision), savingRef = useRef(false), current = useRef(form);
    current.current = form;
    const sections = [...new Set(fields(form.kind).filter(f => !f.system).map(f => f.section))].sort(), steps = [...sections.map(n => sectionTitles[n]), 'Dated events', 'Outcome & follow-up', 'Review & submit'], review = step === steps.length - 1;
    const needs = owner ? caseAttention(form) : attention(form);
    useEffect(()=>{if(!focusField)return; const issue=caseAttention(form).find(i=>i.field===focusField); if(!issue)return; setStep(issue.section==='events'?sections.length:issue.section==='outcomes'?sections.length+1:sections.indexOf(Number(issue.section))); jumpToField(focusField);},[focusField]);
    const editableDraft = record.status === 'draft';
    function update(next: CaseForm) { sequence.current++; setForm(next); setDirty(true); setConfirmed(false); }
    async function save(submit = false) { if (savingRef.current)
        return false; const snapshot = current.current, seq = sequence.current; let validation: ReturnType<typeof validateForm>; try { validation = validateForm(snapshot, submit); } catch (e) { setError((e as any).issues?.[0]?.message || (e as Error).message || 'Check the entered information.'); return false; } if (validation.errors.length) {
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
    } update({ kind: form.kind, answers, events: [{ id: crypto.randomUUID(), type: 'Treatment', date: '2026-08-15', datePrecision: 'day', title: 'Fictional management event', details: 'Synthetic data for form testing only.', amount: '10', unit: 'units', response: 'Improved' }] }); setError(''); }
    return <section className={'panel clinical-editor ' + (mobilePreview ? 'clinical-mobile-preview' : '')}><div className="panel-head"><div><span className="eyebrow">{preview ? 'FICTIONAL TEST FORM' : editableDraft ? 'PRIVATE DRAFT' : 'OWNER EDIT'}</span><h2>{SOURCES[form.kind].title}</h2><p className="muted">Information only. Upload images and videos yourself in Google Drive after submission.</p></div><button className="button" disabled={saving} onClick={() => void leave()}><ArrowLeft size={15}/>Back</button></div>{preview && <div className="banner"><CheckCircle2 size={17}/><span>Fellow preview — test mode. No real spreadsheet, folder, PDF or statistics will be changed.</span><button className="button small" onClick={demo}>Fill fictional example</button><button className="button small" onClick={() => setMobilePreview(!mobilePreview)}>{mobilePreview ? 'Desktop layout' : 'Mobile layout'}</button></div>}<div className="clinical-progress" aria-label="Form progress">{steps.map((title, i) => <button key={title} className={i === step ? 'active' : ''} onClick={() => { if (!saving)
        setStep(i); }} aria-current={i === step ? 'step' : undefined}><b>{i + 1}</b><span>{title}{needs.some(e => e.section === (i < sections.length ? String(sections[i]) : i === sections.length ? 'events' : 'outcomes')) && <span className="clinical-dot" aria-label="Needs attention"/>}</span></button>)}</div><p className="clinical-save-state" role="status">{saving ? 'Saving…' : dirty ? 'Unsaved changes · automatic draft save after 12 seconds of inactivity' : savedAt ? 'Saved at ' + savedAt : 'Draft stored privately; only you and the clinical owner can access it.'}</p>
 {error && <button className="button small" onClick={onClose}>Return to workspace without saving local changes</button>}{error && <div className="banner warning" role="alert"><AlertTriangle size={17}/><div>{error}{errors.length > 1 && <details><summary>{errors.length} items need attention</summary>{errors.map((e, i) => <button className="clinical-error-link" key={i} onClick={() => { const f = fields(form.kind).find(f => f.id === e.field); setStep(f ? sections.indexOf(f.section) : e.field === 'outcomes' ? sections.length + 1 : sections.length); }}>{e.message}</button>)}</details>}</div></div>}
 <AttentionList form={form} owner={owner && !editableDraft} extraChoices={extraChoices} onJump={e=>{setStep(e.section === 'events' ? sections.length : e.section === 'outcomes' ? sections.length+1 : sections.indexOf(Number(e.section))); jumpToField(e.field);}}/>
 {editableDraft && <><button type="button" className="button clinical-trash-link" disabled={saving} onClick={()=>setTrashConfirm(true)}><Trash2 size={15}/>Delete draft</button>{trashConfirm && <div className="clinical-leave-shade"><section role="alertdialog" aria-modal="true" aria-label="Move draft to trash" className="clinical-leave-dialog"><h3>Move this draft to trash?</h3><p>Draft reference: {record.id}. Unsaved entries will be discarded. Only the clinical owner can restore this draft. No Drive files will be deleted.</p><button className="button" disabled={saving} onClick={()=>setTrashConfirm(false)}>Keep draft</button><button className="button" disabled={saving} onClick={async()=>{savingRef.current=true;setSaving(true);try{await clinicalApi('action',{action:'deleteDraft',id:record.id,revision:revision.current},preview);(onDeleted || onClose)();}catch(e){setError((e as Error).message);setTrashConfirm(false);}finally{savingRef.current=false;setSaving(false);}}}>Move to trash</button></section></div>}</>}
 {!review && step < sections.length && <div className="clinical-fields"><h3>{steps[step]}</h3><ClinicalFields form={form} section={sections[step]} extraChoices={extraChoices} issues={needs} onChange={(id,answer)=>update({...form,answers:{...form.answers,[id]:answer}})}/></div>}
 {step === sections.length && <div id="field-events"><EventEditor events={form.events} onChange={events=>update({...form,events})}/></div>}
 {step === sections.length + 1 && <div id="field-outcomes"><OutcomeEditor value={form.outcomes} onChange={outcomes => update({ ...form, outcomes })}/></div>}
 {review && <div><h3>Review your information</h3><p className="muted">After submission you receive a case reference only. The clinical owner handles later corrections and follow-up.</p>{sections.map(n => <details className="clinical-review-section" key={n} open={n === 0}><summary>{sectionTitles[n]}</summary><dl>{fields(form.kind).filter(f => f.section === n && visible(f, form.answers)).map(f => <div key={f.id}><dt>{f.label}{f.required ? ' *' : ''}</dt><dd>{answerText(form.answers[f.id])}</dd></div>)}</dl></details>)}<p>{form.events.length} dated event(s) · {form.outcomes?.followups.length || 0} structured follow-up assessment(s)</p><button className="button small" onClick={() => setStep(sections.length + 1)}>Review outcome assessments</button><button className="button" onClick={() => { const result = validateForm(form, true); setErrors(result.errors); setError(result.errors[0]?.message || ''); if (!result.errors.length)
        setError('Completeness checks passed. Review the answers, then confirm below.'); }}><CheckCircle2 size={16}/>Check completeness</button><label className="clinical-check"><input type="checkbox" checked={confirmed} onChange={e => { if (e.target.checked) {
        const result = validateForm(form, true);
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
export function ClinicalField({ field: f, value, onChange, extraChoices, error, errorMessage }: {
    field: Field;
    value?: Answer;
    onChange: (a: Answer) => void;
    extraChoices: string[];
    error: boolean;
    errorMessage?: string;
}) {
    const container = useRef<HTMLDivElement>(null);
    const a = value || { state: 'not_recorded', value: '' };
    const options = [...new Set([...(f.options || []), ...extraChoices])];
    const showInput = a.state === 'recorded' || a.state === 'not_recorded';
    const legacyState = !showInput && a.state !== 'not_applicable';
    const inputId = 'answer-' + f.id;
    function recordValue(value: Answer['value']) { onChange({ ...a, state: 'recorded', value }); }
    function startRecording() {
        // Mount the input and focus in the same tap so mobile keyboards open.
        flushSync(() => onChange({ ...a, state: 'recorded' }));
        container.current?.querySelector<HTMLElement>('[data-answer-input]')?.focus();
    }
    return <div id={'field-' + f.id} ref={container} aria-invalid={error || undefined} aria-describedby={error ? inputId + '-error' : undefined} className={'clinical-field ' + (error ? 'invalid' : '')}>
        <label id={inputId + '-label'} htmlFor={inputId}>{error && <span className="clinical-dot" aria-label="Needs attention"/>}{f.label}{f.required && <span className="required"> *</span>}{f.private && <span className="tag">Private</span>}</label>
        <div className="clinical-answer-status" role="group" aria-label={'Information status: ' + f.label}>
            <button type="button" aria-pressed={a.state === 'recorded'} onClick={startRecording}>Record</button>
            {['ravc_sex','nodule_D'].includes(f.id) && <button type="button" aria-pressed={a.state==='unknown'} onClick={()=>onChange({...a,state:'unknown'})}>Unknown</button>}
            {['ravc_dissolution_total','nodule_CS'].includes(f.id) && <button type="button" aria-pressed={a.state==='unknown'} onClick={()=>onChange({...a,state:'unknown'})}>Dose unknown</button>}
            <button type="button" aria-pressed={a.state === 'not_applicable'} onClick={() => onChange({ ...a, state: 'not_applicable' })}>Not applicable</button>
        </div>
        {legacyState && <small>Saved answer: {stateLabels[a.state]}. Choose Record or Not applicable to change it.</small>}
        {showInput && <>
            {f.type === 'datetime' && <select aria-label={'Time precision: ' + f.label} value={a.precision || 'minute'} onChange={e => onChange({ ...a, precision: e.target.value as 'day' | 'minute', value: '' })}><option value="minute">Date and time known</option><option value="day">Date known; time unknown</option></select>}
            {f.type === 'choice' ? <select data-answer-input id={inputId} value={String(a.value)} onChange={e => recordValue(e.target.value)}><option value="">Choose an answer</option>{options.map(o => <option key={o}>{o}</option>)}{typeof a.value === 'string' && a.value && !options.includes(a.value) && <option>{a.value}</option>}</select>
                : f.type === 'multi' ? <div className="clinical-choice-list" role="group" aria-labelledby={inputId + '-label'}>{options.map(o => <label className="clinical-check" key={o}><input data-answer-input type="checkbox" checked={Array.isArray(a.value) ? a.value.includes(o) : a.value.split(', ').includes(o)} onChange={e => { const list = Array.isArray(a.value) ? a.value : a.value ? a.value.split(', ') : []; recordValue(e.target.checked ? [...new Set([...list, o])] : list.filter(x => x !== o)); }}/>{o}</label>)}</div>
                    : f.type === 'long' ? <textarea data-answer-input id={inputId} rows={3} maxLength={6000} placeholder="Enter details" value={String(a.value)} onChange={e => recordValue(e.target.value)}/>
                        : <input data-answer-input id={inputId} type={f.type === 'datetime' ? (a.precision === 'day' ? 'date' : 'datetime-local') : f.type === 'number' ? 'number' : f.type === 'date' ? 'date' : 'text'} inputMode={f.type === 'number' ? 'decimal' : undefined} min={f.min} max={f.max} step={f.type === 'number' ? 'any' : undefined} maxLength={6000} placeholder={f.type === 'number' ? 'Enter a number' : 'Enter answer'} value={String(a.value)} onChange={e => recordValue(e.target.value)}/>
            }
        </>}
        {error && <span id={inputId + '-error'} className="clinical-field-error">{errorMessage || 'Enter an answer or choose Not applicable.'}</span>}
        {a.state === 'recorded' && (String(a.value) === 'Other' || Array.isArray(a.value) && a.value.includes('Other')) && <small>Describe unusual details in a dated event, or ask the clinical owner to add a specific answer choice.</small>}
    </div>;
}

export function ClinicalFields({form,section,extraChoices,issues,onChange}:{form:CaseForm;section:number;extraChoices:Record<string,string[]>;issues:{field:string;message:string}[];onChange:(id:string,value:Answer)=>void}) {
 const all=fields(form.kind), render=(f:Field)=><ClinicalField key={f.id} field={f} value={form.answers[f.id]} extraChoices={extraChoices[f.id]||[]} error={issues.some(e=>e.field===f.id)} errorMessage={issues.find(e=>e.field===f.id)?.message} onChange={value=>onChange(f.id,value)}/>;
 const doseIds=['ravc_AC','ravc_AD','ravc_dissolution_total','ravc_dissolution_unit'];
 return <>{all.filter(f=>f.section===section&&visible(f,form.answers)&&!(form.kind==='ravc'&&doseIds.includes(f.id))).map(render)}{form.kind==='ravc'&&section===5&&<section className="clinical-dose-group" aria-label="Dissolution dose"><h3>Dissolution dose</h3><p>For one agent, enter its numerical total and unit together. If the dose is unavailable, choose Dose unknown. Use dated treatment entries for separate agents, routes or sessions.</p>{render(all.find(f=>f.id==='ravc_AC')!)}<DosePair form={form} issues={issues} extraChoices={extraChoices} onChange={onChange}/>{render(all.find(f=>f.id==='ravc_AD')!)}<p>Historical descriptions remain readable. Vials, mixture volumes and IU are not automatically converted. Event totals are kept separate from the case total.</p></section>}</>;
}

function DosePair({form,issues,extraChoices,onChange}:{form:CaseForm;issues:{field:string;message:string}[];extraChoices:Record<string,string[]>;onChange:(id:string,value:Answer)=>void}) {
 const id='ravc_dissolution_total',unitId='ravc_dissolution_unit',a=form.answers[id]||{state:'not_recorded',value:''},u=form.answers[unitId],show=['recorded','not_recorded'].includes(a.state),error=issues.find(e=>e.field===id),unitError=issues.find(e=>e.field===unitId),units=[...new Set([...(fields('ravc').find(f=>f.id===unitId)!.options||[]),...(extraChoices[unitId]||[])])];
 return <div id={'field-'+id} className="clinical-dose-entry"><div className="clinical-dose-status" role="group" aria-label="Information status: Structured total dose"><button type="button" aria-pressed={a.state==='recorded'} onClick={()=>{flushSync(()=>onChange(id,{...a,state:'recorded'}));document.getElementById('answer-'+id)?.focus();}}>Record dose</button><button type="button" aria-pressed={a.state==='unknown'} onClick={()=>onChange(id,{...a,state:'unknown'})}>Dose unknown</button><button type="button" aria-pressed={a.state==='not_applicable'} onClick={()=>onChange(id,{...a,state:'not_applicable'})}>Not applicable</button></div>{show?<div className="clinical-dose-pair"><label className={'clinical-dose-value '+(error?'invalid':'')} htmlFor={'answer-'+id}>{error&&<span className="clinical-dot"/>}Structured total dose<input data-answer-input id={'answer-'+id} type="number" min="0" step="any" inputMode="decimal" placeholder="e.g. 1500" aria-invalid={!!error} value={String(a.value)} onChange={e=>onChange(id,{state:'recorded',value:e.target.value})}/>{error&&<small className="clinical-field-error">{error.message}</small>}</label><label id={'field-'+unitId} className={'clinical-dose-value '+(unitError?'invalid':'')} htmlFor={'answer-'+unitId}>{unitError&&<span className="clinical-dot"/>}Dose unit<select data-answer-input id={'answer-'+unitId} aria-invalid={!!unitError} value={u?.state==='recorded'?String(u.value):''} onChange={e=>onChange(unitId,{state:'recorded',value:e.target.value})}><option value="">Choose unit</option>{units.filter(v=>!['Other','Multiple agents: see treatment events'].includes(v)).map(v=><option key={v}>{v}</option>)}{u?.state==='recorded'&&!units.includes(String(u.value))&&<option>{String(u.value)}</option>}</select>{unitError&&<small className="clinical-field-error">{unitError.message}</small>}</label></div>:<p className="muted">{a.state==='unknown'?'Dose unknown — no numerical total will be assumed.':a.state==='not_applicable'?'Dose not applicable.':stateLabels[a.state]}</p>}</div>;
}
