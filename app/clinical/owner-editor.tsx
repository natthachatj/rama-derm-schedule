import { useSavebarInset } from './use-savebar-inset';
import AttentionList, { jumpToField } from './attention';
import { caseAttention, legacyReview } from '../../lib/clinical/usability';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Save, ArrowLeft, AlertTriangle } from 'lucide-react';
import { fields, SOURCES } from '../../lib/clinical/catalog';
import { answerText, visible, type Answer, type CaseRecord } from '../../lib/clinical/model';
import { editChanges, editSectionTitle, type EditConflict, type EditSection } from '../../lib/clinical/edit';
import { emptyOutcomes } from '../../lib/clinical/outcomes';
import { ClinicalFields } from './form';
import EventEditor from './event-editor';
import OutcomeEditor from './outcome-editor';
import { clinicalApi } from './api';
export default function OwnerEditor({ initial, section: initialSection, focusField, extraChoices, onCancel, onSaved }: { initial: CaseRecord; section: EditSection; focusField?: string; extraChoices: Record<string, string[]>; onCancel: () => void; onSaved: (record: CaseRecord, section: EditSection) => void }) {
    const savebarInset = useSavebarInset();
    const base = useRef(structuredClone(initial));
    const [section, setSection] = useState(initialSection), [newVisitId] = useState(() => crypto.randomUUID());
    const [draft, setDraft] = useState<CaseRecord>(() => { const r = structuredClone(initial); if (initialSection === 'followup') { r.outcomes ||= emptyOutcomes(); r.outcomes.followups.push({ id: newVisitId, date: new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 10), healing: 'not_assessed', assessment: 'not_assessed', sequelae: [], recurrence: 'not_assessed', notes: '' }); } return r; });
    const [note, setNote] = useState(''), [saving, setSaving] = useState(false), [error, setError] = useState(''), [errors, setErrors] = useState<{field:string;message:string}[]>([]), [conflict, setConflict] = useState<EditConflict>(), [resolutions, setResolutions] = useState<Record<string, 'mine'|'latest'>>({}), [leaving, setLeaving] = useState(false);
    const container = useRef<HTMLElement>(null), busy = useRef(false), allowLeave = useRef(false), pendingTarget = useRef<HTMLElement | null>(null);
    const changes = useMemo(() => editChanges(base.current, draft, section), [draft, section]), dirty = changes.length > 0;
    const sections = [...[...new Set(fields(initial.kind).filter(f => !f.system).map(f => String(f.section) as EditSection))].sort((a, b) => Number(a) - Number(b)), 'events', 'outcomes'] as EditSection[];
    useEffect(() => {
        const unload = (e: BeforeUnloadEvent) => { if (dirty && !allowLeave.current) { e.preventDefault(); e.returnValue = ''; } };
        const navigate = (e: MouseEvent) => { const target = e.target instanceof Element ? e.target.closest<HTMLElement>('a[href],button') : null; if (dirty && !allowLeave.current && target && !container.current?.contains(target)) { e.preventDefault(); e.stopImmediatePropagation(); pendingTarget.current = target; setLeaving(true); } };
        window.addEventListener('beforeunload', unload); document.addEventListener('click', navigate, true);
        return () => { window.removeEventListener('beforeunload', unload); document.removeEventListener('click', navigate, true); };
    }, [dirty]);
    function update(next: CaseRecord) { setDraft(next); setConflict(undefined); setResolutions({}); setError(''); setErrors([]); }
    function cancel() { if (saving) return; pendingTarget.current = null; if (dirty) setLeaving(true); else onCancel(); }
    function discard() { allowLeave.current = true; const target = pendingTarget.current; if (target?.isConnected) { target.click(); queueMicrotask(() => { allowLeave.current = false; }); setLeaving(false); } else onCancel(); }
    async function save() {
        if (busy.current || !dirty) return;
        busy.current = true; setSaving(true); setError(''); setErrors([]);
        try {
            const result = await clinicalApi('action', { action: 'edit', id: initial.id, edit: { section, baseRevision: base.current.revision, changes, note, resolutions, resolveRevision: conflict?.revision } });
            if (result.conflict) { setConflict(result.conflict); setResolutions({}); setError('Some information was also changed elsewhere. Your entries are still here. Choose which values to keep below.'); return; }
            allowLeave.current = true; onSaved(result.record, section);
        } catch (e) { setError((e as Error).message || 'Could not save. Your changes are still here.'); setErrors((e as any).validation || []); }
        finally { busy.current = false; setSaving(false); }
    }
    useEffect(() => { if (focusField) jumpToField(focusField); }, [focusField]);
    const needs = [...caseAttention(draft),...legacyReview(draft,extraChoices)];
    const unresolved = conflict?.items.some(i => !resolutions[i.key]);
    return <section ref={container} className="panel clinical-editor clinical-owner-editor"><div className="panel-head"><div><span className="eyebrow">OWNER EDIT · SECTION ONLY</span><h2>{editSectionTitle(section)}</h2><p className="muted">{SOURCES[initial.kind].title} · {initial.presentationCode}</p></div><button className="button" disabled={saving} onClick={cancel}><ArrowLeft size={16}/>Back to case</button></div>
        {initialSection !== 'followup' && <label>Edit section<select value={section} disabled={dirty || saving} onChange={e => { setSection(e.target.value as EditSection); setError(''); setConflict(undefined); }}>{sections.map(s => <option value={s} key={s}>{editSectionTitle(s)}</option>)}</select>{dirty && <small>Save or cancel these changes before selecting another section.</small>}</label>}
        <p className="clinical-save-state" role="status">{saving ? 'Saving your changes…' : dirty ? 'Unsaved changes · save when you are ready' : 'No changes yet'}</p>
        {error && <div className="banner warning" role="alert"><AlertTriangle size={17}/><div>{error}<p>Your unsaved entries have been kept on this page.</p>{errors.length > 0 && <ul>{errors.map((e, i) => <li key={i}>{e.message}</li>)}</ul>}</div></div>}
        <AttentionList form={draft} owner extraChoices={extraChoices} canJump={i=>!dirty || i.section===section} onJump={i=>{setSection(i.section);jumpToField(i.field);}}/>
        {conflict && <section className="clinical-conflicts" aria-label="Resolve changed information"><h3>Choose the values to save</h3><p>Other saved information will be preserved. If the case changes again, we will check again before saving.</p>{conflict.items.map(item => <fieldset key={item.key} disabled={saving}><legend>{item.label}</legend><label className="clinical-conflict-choice"><input type="radio" name={'resolve-' + item.key} checked={resolutions[item.key] === 'mine'} onChange={() => setResolutions({ ...resolutions, [item.key]: 'mine' })}/><span><strong>Use my value</strong><pre>{displayValue(item.mine)}</pre></span></label><label className="clinical-conflict-choice"><input type="radio" name={'resolve-' + item.key} checked={resolutions[item.key] === 'latest'} onChange={() => setResolutions({ ...resolutions, [item.key]: 'latest' })}/><span><strong>Keep latest saved value</strong><pre>{displayValue(item.latest)}</pre></span></label></fieldset>)}</section>}
        <fieldset className="clinical-owner-fields" disabled={saving}>
        {/^[0-7]$/.test(section) && <div className="clinical-fields"><ClinicalFields originals={initial.sourceRaw} form={draft} section={Number(section)} extraChoices={extraChoices} issues={needs} onChange={(id,value)=>update({...draft,answers:{...draft.answers,[id]:value}})}/></div>}
        {section === 'events' && <div id="field-events"><EventEditor events={draft.events} onChange={events => update({ ...draft, events })}/></div>}
        {(section === 'outcomes' || section === 'followup') && <div id="field-outcomes"><OutcomeEditor value={draft.outcomes} onlyFollowup={section === 'followup' ? newVisitId : undefined} onChange={outcomes => update({ ...draft, outcomes })}/></div>}
        {section === 'followup' && <p className="muted">For healing-time analysis, record the actual healing date in Outcome & follow-up when known; an examination showing a healed wound is not automatically its exact healing date.</p>}
        <label>Additional explanation (optional)<textarea rows={2} maxLength={1000} value={note} onChange={e => setNote(e.target.value)} placeholder="Only add a note if you want to explain the change."/></label><p className="muted">Edit history automatically records the fields changed, your identity and the time. You do not need to type an edit reason.</p>
        </fieldset>
        <div className="clinical-owner-savebar" style={{bottom:savebarInset}}><span role="status">{saving ? 'Saving…' : error ? 'Not saved · your entries are kept' : dirty ? 'Unsaved changes' : 'No changes yet'}</span><button className="button" disabled={saving} onClick={cancel}>Cancel</button><button className="button primary" disabled={!dirty || saving || !!unresolved} onClick={() => void save()}><Save size={16}/>{saving ? 'Saving…' : conflict ? 'Save chosen values' : error ? 'Retry save' : section === 'followup' ? 'Save follow-up' : 'Save changes'}</button></div>
        {leaving && <div className="clinical-leave-shade"><section className="clinical-leave-dialog" role="alertdialog" aria-modal="true" aria-label="Unsaved clinical changes"><h3>You have unsaved changes</h3><p>Keep editing, or discard your local changes and leave. Nothing will be discarded unless you choose it.</p><button className="button primary" onClick={() => { pendingTarget.current = null; setLeaving(false); }}>Keep editing</button><button className="button" onClick={discard}>Discard changes & leave</button></section></div>}
    </section>;
}
function displayValue(value: unknown): string {
    if (value === null || value === undefined) return 'Removed / not recorded';
    if (typeof value !== 'object') return String(value).replaceAll('_', ' ');
    if (Array.isArray(value)) return value.map(displayValue).join(', ');
    if ('state' in value) return answerText(value as Answer);
    return Object.entries(value).filter(([key, val]) => key !== 'id' && val !== '' && val !== undefined).map(([key, val]) => key.replace(/([A-Z])/g, ' $1') + ': ' + displayValue(val)).join('\n');
}
