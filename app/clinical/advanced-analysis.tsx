import { combinedCounts } from '../../lib/clinical/analytics';
import { useMemo, useState } from 'react';
import { fields, SOURCES, type RegistryKind } from '../../lib/clinical/catalog';
import { answerText, recordYear, type CaseRecord } from '../../lib/clinical/model';
export default function ClinicalAnalysis({ records }: {
    records: CaseRecord[];
}) {
    const [combined, setCombined] = useState(false), [shared, setShared] = useState<'material' | 'brand' | 'area' | 'outcome'>('material');
    const [kind, setKind] = useState<RegistryKind>('ravc'), [yearType, setYearType] = useState<'visit' | 'injection' | 'academic'>('visit'), [year, setYear] = useState(''), [variable, setVariable] = useState('ravc_K'), [group, setGroup] = useState(''), [countMode, setCountMode] = useState('records');
    const catalogue = fields(kind).filter(f => !f.system && (!f.private || f.id === 'ravc_L' || f.id === 'nodule_N')), years = [...new Set(records.map(r => recordYear(r, yearType)).filter(n => n !== null))].sort();
    const analysis = useMemo(() => { let rows = records.filter(r => r.kind === kind && (!year || String(recordYear(r, yearType)) === year)); const original = rows.length; if (countMode === 'linked') {
        const parent = new Map<string, string>();
        const root = (id: string): string => parent.has(id) ? root(parent.get(id)!) : id;
        for (const r of records)
            for (const linked of r.linkedCaseIds) {
                const a = root(r.id), b = root(linked);
                if (a !== b)
                    parent.set(a, b);
            }
        const seen = new Set<string>();
        rows = rows.filter(r => { const id = root(r.id); if (seen.has(id))
            return false; seen.add(id); return true; });
    } const cells = new Map<string, number>(); let missing = 0; const numbers: number[] = []; for (const r of rows) {
        const a = r.answers[variable], g = group ? r.answers[group] : undefined;
        if (!a || a.state !== 'recorded') {
            missing++;
            continue;
        }
        const values = Array.isArray(a.value) ? a.value : [a.value];
        for (const value of values) {
            const key = String(value) + '\u0000' + (group ? answerText(g) : 'All');
            cells.set(key, (cells.get(key) || 0) + 1);
        }
        if (!Array.isArray(a.value) && String(a.value).trim() && Number.isFinite(Number(a.value)))
            numbers.push(Number(a.value));
    } numbers.sort((a, b) => a - b); return { original, n: rows.length, missing, known: rows.length - missing, cells: [...cells].sort((a, b) => b[1] - a[1]), numbers }; }, [records, kind, yearType, year, variable, group, countMode]);
    return <section className="panel"><span className="eyebrow">PRIVATE · EXPLORATORY DESCRIPTION</span><h2>Clinical analysis</h2><p className="muted">Select fields and comparisons. Referral records describe this registry; they do not establish complication incidence or causal treatment effects.</p><label className="clinical-check"><input type="checkbox" checked={combined} onChange={e => setCombined(e.target.checked)}/>Combined view of compatible fields across both registries</label>{combined && (() => { const data = combinedCounts(records, shared, year ? Number(year) : undefined, yearType); return <section><label>Shared factor<select value={shared} onChange={e => setShared(e.target.value as any)}>{['material', 'brand', 'area', 'outcome'].map(f => <option key={f}>{f}</option>)}</select></label><p>{data.n} records; {data.recorded} recorded answers; {data.missing} missing/non-recorded. Linked episodes may have records in both columns; these are registry counts, not unique patients.</p><table><thead><tr><th>Answer</th><th>RAVC</th><th>Nodule</th></tr></thead><tbody>{data.rows.map(r => <tr key={r.label}><td>{r.label}</td><td>{r.ravc}</td><td>{r.nodule}</td></tr>)}</tbody></table></section>; })()}<div className="clinical-filter-grid"><label>Registry<select value={kind} onChange={e => { const k = e.target.value as RegistryKind; setKind(k); setVariable(k === 'ravc' ? 'ravc_K' : 'nodule_M'); setGroup(''); }}>{Object.entries(SOURCES).map(([k, v]) => <option key={k} value={k}>{v.title}</option>)}</select></label><label>Year definition<select value={yearType} onChange={e => { setYearType(e.target.value as any); setYear(''); }}><option value="visit">First RAMA/RAVC visit year</option><option value="injection">Injection year</option><option value="academic">Academic year (July–June)</option></select></label><label>Year<select value={year} onChange={e => setYear(e.target.value)}><option value="">All recorded years</option>{years.map(y => <option key={y}>{y}</option>)}</select></label><label>Count unit<select value={countMode} onChange={e => setCountMode(e.target.value)}><option value="records">Registry records</option><option value="linked">Linked episodes (one representative record)</option></select></label><label>Variable<select value={variable} onChange={e => setVariable(e.target.value)}>{catalogue.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}</select></label><label>Compare by<select value={group} onChange={e => setGroup(e.target.value)}><option value="">No grouping</option>{catalogue.filter(f => f.id !== variable).map(f => <option key={f.id} value={f.id}>{f.label}</option>)}</select></label></div><div className="clinical-stat-grid"><div><strong>{analysis.n}</strong><span>Included {countMode === 'linked' ? 'episodes' : 'records'}</span></div><div><strong>{analysis.known}</strong><span>Recorded answers</span></div><div><strong>{analysis.missing}</strong><span>Missing / non-recorded states</span></div></div>{countMode === 'linked' && <p className="banner">{analysis.original - analysis.n} linked record(s) excluded. A representative record is used; differing linked answers require case review.</p>}<p className="muted">{records.filter(r => r.kind === kind && recordYear(r, yearType) === null).length} record(s) have an unknown/unparsed year. Multiple-choice categories may total more than 100%.</p>{analysis.numbers.length > 0 && <p>Numeric values: n = {analysis.numbers.length}; median = {analysis.numbers.length % 2 ? analysis.numbers[(analysis.numbers.length - 1) / 2] : (analysis.numbers[analysis.numbers.length / 2 - 1] + analysis.numbers[analysis.numbers.length / 2]) / 2}; range = {analysis.numbers[0]}–{analysis.numbers.at(-1)}. Units follow the selected field; mixed units must be reviewed.</p>}<div className="table-scroll"><table><thead><tr><th>Answer</th><th>Group</th><th>Count</th><th>% of {analysis.known} recorded answers</th></tr></thead><tbody>{analysis.cells.map(([key, n]) => <tr key={key}><td>{key.split('\u0000')[0]}</td><td>{key.split('\u0000')[1]}</td><td>{n}</td><td>{analysis.known ? (100 * n / analysis.known).toFixed(1) : '—'}%</td></tr>)}</tbody></table></div>{!analysis.n && <p className="empty">No cases match these filters.</p>}</section>;
}
