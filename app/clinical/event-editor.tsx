import {useEffect, useRef} from 'react';
import {NumericInput} from './numeric-input';
import { treatmentDoseTotals, doseUnits } from '../../lib/clinical/dose';
import {unknownTreatmentFields, type CaseEvent } from '../../lib/clinical/model';
export function newTreatmentEvent(category?: CaseEvent['category'], agent?: string): CaseEvent {
    return { id: crypto.randomUUID(), type: 'Treatment', date: '', datePrecision: 'unknown',
        title: category === 'medication' ? 'Prescribed medication' : category === 'dissolution' ? 'Dissolution treatment' : 'New treatment',
        details: '', category, agent };
}
export default function EventEditor({ events, onChange, category, agents = [] }: {
    events: CaseEvent[];
    onChange: (events: CaseEvent[]) => void;
    category?: 'medication' | 'dissolution';
    agents?: string[];
}) {
    const totals=treatmentDoseTotals(events);
    const addedEvent = useRef('');
    const editor = useRef<HTMLElement>(null);
    function addEvent(agent?: string) {
        const event = newTreatmentEvent(category, agent);
        addedEvent.current = event.id;
        onChange([...events, event]);
    }
    useEffect(() => {
        if (!addedEvent.current) return;
        const row = editor.current?.querySelector<HTMLElement>('[data-event-id="' + addedEvent.current + '"]');
        if (!row) return;
        addedEvent.current = '';
        row.focus({preventScroll:true});
        row.scrollIntoView({block:'start'});
    }, [events]);
    return <section ref={editor}>{!category&&<><h3>History & management timeline</h3><p className="muted">Record dated injections, investigations, treatments and follow-up. Keep uncertain dates explicit.</p></>}{events.map((event, i) => {
        if (category && (event.type !== 'Treatment' || event.category !== category)) return null;
        const update = (patch: Partial<CaseEvent>) => onChange(events.map(e => e.id === event.id ? { ...e, ...patch } : e));
        const unknown = new Set(event.unknownDetails || []);
        const unknownControl = (field: typeof unknownTreatmentFields[number], label: string, disabled: boolean) =>
            <label className="clinical-check"><input type="checkbox" checked={unknown.has(field)} disabled={disabled}
                onChange={e => update({unknownDetails:e.target.checked ? [...unknown,field] : [...unknown].filter(value=>value!==field)})}/>
                {label} unknown</label>;
        return <fieldset className="clinical-event" key={event.id} data-event-id={event.id} tabIndex={-1}><legend>{category === 'medication' ? 'Medication' : category === 'dissolution' ? event.agent || 'Dissolution' : 'Event ' + (i + 1)}</legend><div className="form-grid">{!category&&<label>Event type<select value={event.type} onChange={e => update({ type: e.target.value as CaseEvent['type'] })}>{['Injection','History','Investigation','Treatment','Follow-up'].map(t => <option key={t}>{t}</option>)}</select></label>}<label>Date precision<select value={event.datePrecision} onChange={e => update({ datePrecision: e.target.value as CaseEvent['datePrecision'], date: '' })}>{['day','month','year','unknown'].map(t => <option key={t}>{t}</option>)}</select></label>{event.datePrecision !== 'unknown' && <label>{event.category==='medication'?'Date started':event.category==='dissolution'?'Date performed':'Event date'}<input type={event.datePrecision === 'day' ? 'date' : event.datePrecision === 'month' ? 'month' : 'number'} value={event.date} onChange={e => update({ date: e.target.value })}/></label>}{event.category==='medication'&&<label>Date stopped (optional)<input type="date" value={event.stopDate || ''} onChange={e=>update({stopDate:e.target.value})}/></label>}{!category&&<label>Event title<input maxLength={160} value={event.title} onChange={e => update({ title: e.target.value })}/></label>}{event.type==='Injection'&&<><label>Injected material type<select value={event.material||''} onChange={e=>update({material:e.target.value})}><option value="">Choose material</option>{['HA','CaHA','PLLA','PCL','PMMA','Silicone','PN','PDO','Other'].map(m=><option key={m}>{m}</option>)}</select></label><label>Product brand (private)<input value={event.brand||''} maxLength={120} onChange={e=>update({brand:e.target.value})}/></label></>}{event.type==='Treatment'&&<>{!category&&<label>Treatment category<select value={event.category||''} onChange={e=>update({category:e.target.value as CaseEvent['category']})}><option value="">Choose category</option><option value="dissolution">Dissolution</option><option value="medication">Medication</option><option value="procedure">Procedure</option><option value="injection">Injection</option></select></label>}{event.category==='medication'?<label>Drug / agent<input value={event.agent||''} maxLength={120} onChange={e=>update({agent:e.target.value})}/></label>:<label>Agent<select value={event.agent||''} onChange={e=>update({agent:e.target.value})}><option value="">Choose agent</option>{['Hyaluronidase','Saline','Sodium thiosulfate','Other'].map(a=><option key={a}>{a}</option>)}{event.agent&&!['Hyaluronidase','Saline','Sodium thiosulfate','Other'].includes(event.agent)&&<option>{event.agent}</option>}</select></label>}<label>Route / technique<select value={event.route||''} onChange={e=>update({route:e.target.value})}><option value="">Choose route / technique</option>{['Intradermal','Subcutaneous','Intraarterial','Intralesional','Multiplane','Ultrasound guided','Oral','Topical','Intravenous','Intramuscular','Other'].map(r=><option key={r}>{r}</option>)}{event.route&&!['Intradermal','Subcutaneous','Intraarterial','Intralesional','Multiplane','Ultrasound guided','Oral','Topical','Intravenous','Intramuscular','Other'].includes(event.route)&&<option>{event.route}</option>}</select></label></>}<div className="clinical-dose-pair clinical-event-dose"><label>Dose / amount<NumericInput value={event.amount||''} onValue={amount=>update({amount})}/></label><label>Unit<select value={event.unit||''} onChange={e=>update({unit:e.target.value})}><option value="">Choose unit</option>{[...doseUnits,'g','mcg','tablets','applications','threads'].map(u=><option key={u}>{u}</option>)}{event.unit&&![...doseUnits,'g','mcg','tablets','applications','threads'].includes(event.unit)&&<option>{event.unit}</option>}</select></label></div>{event.category==='medication'&&<><label>Frequency<input value={event.frequency||''} maxLength={120} placeholder="e.g. twice daily" onChange={e=>update({frequency:e.target.value})}/></label><label>Duration<NumericInput value={event.duration||''} onValue={duration=>update({duration})}/></label><label>Duration unit<select value={event.durationUnit||''} onChange={e=>update({durationUnit:e.target.value as CaseEvent['durationUnit']})}><option value="">Choose unit</option>{['days','weeks','months','years'].map(u=><option key={u}>{u}</option>)}</select></label></>}</div>{event.type==='Treatment'&&['medication','dissolution'].includes(event.category||'')&&
            <div className="form-grid">
                {unknownControl('dose','Dose',!!(event.amount && event.unit) && !unknown.has('dose'))}
                {event.category==='medication'&&<>
                    {unknownControl('route','Route',!!event.route && !unknown.has('route'))}
                    {unknownControl('frequency','Frequency',!!event.frequency && !unknown.has('frequency'))}
                    {unknownControl('duration','Duration',!!(event.duration && event.durationUnit) && !unknown.has('duration'))}
                </>}
            </div>}<label>Details<textarea maxLength={6000} value={event.details} onChange={e => update({ details: e.target.value })}/></label><label>Response / outcome<textarea maxLength={2000} value={event.response || ''} onChange={e => update({ response: e.target.value })}/></label><button type="button" className="button small" onClick={() => onChange(events.filter(e => e.id !== event.id))}>Remove event</button></fieldset>;
    })}
    {category === 'dissolution' && agents.length > 1
        ? <div className="clinical-answer-status">{agents.map(agent =>
            <button key={agent} type="button" className="button" disabled={events.length >= 150}
                onClick={() => addEvent(agent)}>Add {agent} treatment</button>)}</div>
        : <button type="button" className="button" disabled={events.length >= 150}
            onClick={() => addEvent(agents[0])}>
            {category === 'medication' ? 'Add medication' : category === 'dissolution' ? 'Add dissolution treatment' : 'Add dated event'}
        </button>}
    {!category&&<>{totals.totals.length>0&&<section className="clinical-event-totals"><h4>Totals from dated treatment entries</h4>{totals.totals.map(t=><p key={t.agent+t.unit}>{t.agent}: {Number(t.amount.toPrecision(12))} {t.unit}</p>)}<p>Only matching agent and unit labels are added. No concentration conversions; these totals do not automatically replace the case total.</p></section>}{totals.incomplete>0&&<p className="banner warning">{totals.incomplete} treatment entries need an agent, valid amount or unit before contributing to these totals.</p>}</>}</section>;
}
