import { useState } from 'react';
import { Download, Eye, ShieldCheck } from 'lucide-react';
import { sectionTitles } from '../../lib/clinical/catalog';
import type { CaseRecord } from '../../lib/clinical/model';
import { clinicalApi, downloadExport } from './api';
export default function ClinicalExport({ record, onClose }: {
    record: CaseRecord;
    onClose: () => void;
}) { const [anonymous, setAnonymous] = useState(true), [sections, setSections] = useState([0, 1, 2, 3, 4, 5, 6, 7]), [summary, setSummary] = useState(''), [reviewed, setReviewed] = useState(false), [model, setModel] = useState<any>(), [busy, setBusy] = useState(false), [error, setError] = useState(''); const payload = { id: record.id, anonymous, sections, summary, reviewed }; function invalidate() { setModel(undefined); setReviewed(false); } async function preview() { setBusy(true); setError(''); try {
    setModel((await clinicalApi('export', { ...payload, format: 'preview' })).model);
}
catch (e) {
    setError(String((e as Error).message));
}
finally {
    setBusy(false);
} } async function download(format: string) { setBusy(true); setError(''); try {
    await downloadExport({ ...payload, format });
}
catch (e) {
    setError((e as Error).message);
}
finally {
    setBusy(false);
} } return <section className="panel clinical-editor"><div className="panel-head"><div><span className="eyebrow">INFORMATION ONLY</span><h2>Case export creator</h2></div><button className="button" onClick={onClose}>Back to case</button></div><p className="muted">PDF and PowerPoint contain submitted information only. Insert images and videos yourself afterward.</p><label className="clinical-check"><input type="checkbox" checked={anonymous} onChange={e => { setAnonymous(e.target.checked); invalidate(); }}/><ShieldCheck size={16}/>Anonymous presentation copy (default)</label>{!anonymous && <p className="banner warning">Private patient information will be included. Keep this export private.</p>}<fieldset><legend>Include sections</legend><div className="clinical-choice-list">{sectionTitles.map((s, i) => <label className="clinical-check" key={s}><input type="checkbox" checked={sections.includes(i)} onChange={e => { setSections(e.target.checked ? [...sections, i] : sections.filter(n => n !== i)); invalidate(); }}/>{s}</label>)}</div></fieldset><label>Reviewed summary text (optional)<textarea rows={5} maxLength={12000} value={summary} onChange={e => { setSummary(e.target.value); invalidate(); }}/></label><button className="button" disabled={busy || !sections.length} onClick={() => void preview()}><Eye size={16}/>Preview export</button>{model && <div className="clinical-export-preview"><h3>{model.title}</h3><p>{model.code} · {model.note}</p>{model.sections.map((s: any, i: number) => <section key={i}><h4>{s.title}</h4><dl>{s.rows.map(([label, text]: string[], j: number) => <div key={j}><dt>{label}</dt><dd>{text}</dd></div>)}</dl></section>)}</div>}<label className="clinical-check"><input type="checkbox" disabled={!model} checked={reviewed} onChange={e => setReviewed(e.target.checked)}/>I reviewed this exact preview, including free text, for patient identifiers, referrer names and product brands.</label>{error && <p className="banner warning" role="alert">{error}</p>}<div className="modal-actions"><button className="button primary" disabled={busy || !reviewed || !model} onClick={() => void download('pdf')}><Download size={16}/>A4 PDF</button><button className="button primary" disabled={busy || !reviewed || !model} onClick={() => void download('pptx')}><Download size={16}/>Editable PPTX</button></div></section>; }
