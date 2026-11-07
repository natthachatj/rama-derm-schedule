import { z } from 'zod';
import { type CaseRecord, validDay } from './model';
import { normalizeMaterial } from './analytics';
export const RESEARCH_VERSION = '1.0.0';
export const factorLabels = { material: 'Material type', area: 'Affected area', complication: 'Complication type', treatment: 'Treatment', outcome: 'Clinical outcome', sex: 'Sex at birth', age: 'Age (years)', delay: 'Treatment delay (days)', severity: 'Initial wound severity', month: 'First visit month' };
export type Factor = keyof typeof factorLabels;
export const researchConfigSchema = z.object({ registry: z.enum(['both', 'ravc', 'nodule']).default('both'), from: z.string().default(''), to: z.string().default(''), mode: z.enum(['describe', 'compare', 'factors', 'healing']).default('describe'), variable: z.enum(['material', 'area', 'complication', 'treatment', 'outcome', 'sex', 'age', 'delay', 'severity', 'month']).default('material'), group: z.enum(['material', 'area', 'complication', 'treatment', 'sex', 'severity']).default('severity'), outcome: z.enum(['any', 'Scarring', 'Pigmentation', 'Tissue loss', 'Functional impairment', 'Other']).default('any'), adjust: z.array(z.enum(['age', 'delay', 'severity'])).max(3).default([]), selection: z.object({ factor: z.enum(['material', 'area', 'complication', 'treatment', 'outcome', 'sex', 'age', 'delay', 'severity', 'month']), value: z.string().min(1).max(300) }).optional() }).superRefine((c, ctx) => { if (c.from && !validDay(c.from) || c.to && !validDay(c.to) || c.from && c.to && c.from > c.to) ctx.addIssue({ code: 'custom', message: 'Choose a valid, ordered first-visit date range.' }); if (new Set(c.adjust).size !== c.adjust.length) ctx.addIssue({ code: 'custom', message: 'Choose each factor once.' }); });
export type ResearchConfig = z.infer<typeof researchConfigSchema>;
export const defaultResearchConfig = (): ResearchConfig => researchConfigSchema.parse({});
export const days = (from: string, to: string) => Math.round((Date.parse(to.slice(0, 10) + 'T00:00Z') - Date.parse(from.slice(0, 10) + 'T00:00Z')) / 86400000);
export function text(r: CaseRecord, key: string) { const a = r.answers[key]; return a?.state === 'recorded' && typeof a.value === 'string' ? a.value.trim() : ''; }
export function visitDate(r: CaseRecord) { const v = text(r, r.kind === 'ravc' ? 'ravc_Q' : 'nodule_K').slice(0, 10); return validDay(v) ? v : ''; }
export function caseSummary(r: CaseRecord) {
    const val = (key: string) => { const a = r.answers[key]; return a?.state === 'recorded' && a.value.length ? Array.isArray(a.value) ? a.value.join(', ') : a.value : 'Not recorded'; };
    const ravc = r.kind === 'ravc';
    return { visit: visitDate(r) || 'Visit date not recorded', age: val(ravc ? 'ravc_D' : 'nodule_C'), sex: val(ravc ? 'ravc_sex' : 'nodule_D'), complication: ravc ? val('ravc_complication_type') : 'Injectable-related nodule', material: val(ravc ? 'ravc_K' : 'nodule_M'), area: val(ravc ? 'ravc_W' : 'nodule_R'), treatment: ravc ? [val('ravc_AB'), val('ravc_AC'), text(r, 'ravc_AE') ? text(r, 'ravc_AE') + ' sessions' : ''].filter(v => v && v !== 'Not recorded').join(' · ') || val('ravc_AH') : [val('nodule_CM'), val('nodule_CO')].filter(v => v !== 'Not recorded').join(' · ') || 'Not recorded', outcome: val(ravc ? 'ravc_AI' : 'nodule_CV'), followup: r.outcomes?.followups.map(f => f.date).sort().at(-1) || (ravc ? text(r, 'ravc_R') : '') || 'Not recorded' };
}
export type Episode = { id: string; members: CaseRecord[]; date: string };
export function episodes(records: CaseRecord[], config: ResearchConfig) {
    const submitted = records.filter(r => r.status !== 'draft'), parent = new Map(submitted.map(r => [r.id, r.id]));
    const root = (id: string): string => { const p = parent.get(id)!; if (p === id) return id; const v = root(p); parent.set(id, v); return v; };
    for (const r of submitted) for (const id of r.linkedCaseIds) if (parent.has(id)) { const a = root(r.id), b = root(id); if (a !== b) parent.set(b, a < b ? a : b), parent.set(a, a < b ? a : b); }
    const groups = new Map<string, CaseRecord[]>();
    for (const r of submitted) { const id = root(r.id); groups.set(id, [...(groups.get(id) || []), r]); }
    const eligible = [...groups].map(([id, members]) => ({ id, members: members.filter(r => config.registry === 'both' || r.kind === config.registry).sort((a, b) => a.id.localeCompare(b.id)), date: members.map(visitDate).filter(Boolean).sort()[0] || '' })).filter(e => e.members.length);
    const unknownDates = eligible.filter(e => !e.date).length;
    const dated = eligible.filter(e => !(config.from || config.to) || e.date && (!config.from || e.date >= config.from) && (!config.to || e.date <= config.to));
    const selected = dated.filter(e => !config.selection || distribution([e], config.selection.factor).rows.some(r => r.label === config.selection!.value));
    return { selected, unknownDates, matched: eligible.length, dateExcluded: eligible.length - dated.length, categoryExcluded: dated.length - selected.length, linked: selected.reduce((n, e) => n + e.members.length - 1, 0) };
}
function rawValues(r: CaseRecord, key: string): string[] { const a = r.answers[key]; if (!a) return []; if (a.state !== 'recorded') return []; return (Array.isArray(a.value) ? a.value : [a.value]).map(v => v.trim()).filter(Boolean); }
export function factorValues(e: Episode, factor: Factor): string[] {
    const all: string[] = [];
    for (const r of e.members) {
        const ravc = r.kind === 'ravc', o = r.outcomes;
        if (factor === 'month') { if (e.date) all.push(e.date.slice(0, 7)); continue; }
        if (factor === 'complication' && !ravc) { all.push('Injectable-related nodule'); continue; }
        if (factor === 'severity') { if (o && o.severity !== 'unknown') all.push(o.severity); continue; }
        if (factor === 'delay') { const onset = text(r, ravc ? 'ravc_P' : 'nodule_AB').slice(0, 10); if (o?.firstTreatment && validDay(onset) && days(onset, o.firstTreatment) >= 0) all.push(String(days(onset, o.firstTreatment))); continue; }
        const keys: Partial<Record<Factor, string[]>> = { age: [ravc ? 'ravc_D' : 'nodule_C'], sex: [ravc ? 'ravc_sex' : 'nodule_D'], material: [ravc ? 'ravc_K' : 'nodule_M'], area: [ravc ? 'ravc_W' : 'nodule_R'], complication: ['ravc_complication_type'], treatment: ravc ? ['ravc_AB', 'ravc_AC'] : ['nodule_CM', 'nodule_CO'], outcome: [ravc ? 'ravc_AI' : 'nodule_CV'] };
        const values = (keys[factor] || []).flatMap(k => rawValues(r, k)).map(v => factor === 'material' ? normalizeMaterial(v) : v);
        if (factor === 'treatment' && values.length) all.push([...new Set(values)].sort().join(' + ')); else all.push(...values);
    }
    return [...new Set(all)];
}
export function quantile(sorted: number[], p: number) { if (!sorted.length) return null; const at = (sorted.length - 1) * p, low = Math.floor(at); return sorted[low] + (sorted[Math.ceil(at)] - sorted[low]) * (at - low); }
export function numericSummary(values: number[]) { const v = values.filter(Number.isFinite).sort((a, b) => a - b), n = v.length, mean = n ? v.reduce((a, b) => a + b, 0) / n : null; return { n, mean, sd: n > 1 ? Math.sqrt(v.reduce((s, x) => s + (x - mean!) ** 2, 0) / (n - 1)) : null, median: quantile(v, .5), q1: quantile(v, .25), q3: quantile(v, .75), min: v[0] ?? null, max: v.at(-1) ?? null }; }
export function distribution(items: Episode[], factor: Factor) {
    let missing = 0, conflicting = 0; const missingStates: Record<string, number> = {};
    const missingKeys: Partial<Record<Factor, { ravc: string; nodule: string }>> = { age: {ravc:'ravc_D',nodule:'nodule_C'}, sex: {ravc:'ravc_sex',nodule:'nodule_D'}, material: {ravc:'ravc_K',nodule:'nodule_M'}, area: {ravc:'ravc_W',nodule:'nodule_R'}, complication: {ravc:'ravc_complication_type',nodule:'nodule_AR'}, outcome: {ravc:'ravc_AI',nodule:'nodule_CV'}, treatment: {ravc:'ravc_AB',nodule:'nodule_CM'} };
    const addMissing = (label: string) => missingStates[label] = (missingStates[label] || 0) + 1;
    const counts = new Map<string, number>(), numbers: number[] = [];
    for (const e of items) { const v = factorValues(e, factor); if (!v.length) { missing++; const key = missingKeys[factor]; const states = [...new Set(e.members.map(r => key ? r.answers[key[r.kind]]?.state || 'not_recorded' : 'not_recorded'))]; addMissing(states.length === 1 ? states[0].replaceAll('_', ' ') : 'Mixed missing states'); continue; } if (['age', 'delay', 'sex', 'severity'].includes(factor) && v.length !== 1) { missing++; conflicting++; addMissing('Conflicting linked answers'); continue; }
        if (factor === 'age' || factor === 'delay') { const n = Number(v[0]); if (!Number.isFinite(n) || n < 0 || factor === 'age' && n > 120) { missing++; addMissing('Invalid numerical value'); continue; } numbers.push(n); const label = factor === 'age' ? (n < 20 ? '<20' : n >= 60 ? '60+' : `${Math.floor(n / 10) * 10}–${Math.floor(n / 10) * 10 + 9}`) : (n < 1 ? '<1 day' : n <= 3 ? '1–3 days' : n <= 7 ? '4–7 days' : '>7 days'); counts.set(label, (counts.get(label) || 0) + 1); }
        else for (const label of v) counts.set(label, (counts.get(label) || 0) + 1);
    }
    return { factor, label: factorLabels[factor], known: items.length - missing, missing, conflicting, missingStates, rows: [...counts].map(([label, count]) => ({ label, count })).sort((a, b) => factor === 'month' || factor === 'age' ? a.label.localeCompare(b.label) : b.count - a.count || a.label.localeCompare(b.label)), numeric: numericSummary(numbers) };
}
// Only structured, dated assessments contribute to the primary endpoint.
export function sequelaeOutcome(e: Episode, target: ResearchConfig['outcome']) {
    const observations = e.members.flatMap(r => { const o = r.outcomes; if (!o?.firstTreatment) return []; return o.followups.filter(f => f.assessment === 'assessed').map(f => ({ r, f, day: days(o.firstTreatment, f.date) })).filter(v => v.day >= 60 && v.day <= 120).sort((a, b) => Math.abs(a.day - 90) - Math.abs(b.day - 90) || a.day - b.day).slice(0, 1); });
    if (!observations.length) return { value: null, reason: 'No assessed sequelae visit within days 60–120' };
    // Conflicting linked endpoint observations are flagged rather than choosing a convenient answer.
    const values = observations.map(v => target === 'any' ? v.f.sequelae.some(s => s !== 'None') : v.f.sequelae.includes(target));
    if (new Set(values).size > 1) return { value: null, reason: 'Conflicting linked outcome assessments' };
    return { value: values[0] ? 1 : 0, reason: '', day: observations[0].day };
}
export function wilson(yes: number, n: number): [number, number] | null { if (!n) return null; const z = 1.959963984540054, p = yes / n, denom = 1 + z * z / n, mid = (p + z * z / (2 * n)) / denom, half = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / denom; return [Math.max(0, mid - half), Math.min(1, mid + half)]; }
export function fisher(a: number, b: number, c: number, d: number) {
    const factorials = [0]; for (let i = 1; i <= a + b + c + d; i++) factorials.push(factorials[i - 1] + Math.log(i));
    const logFact = (n: number) => factorials[n];
    const choose = (n: number, k: number) => logFact(n) - logFact(k) - logFact(n - k), n = a + b + c + d, row = a + b, col = a + c;
    const prob = (x: number) => Math.exp(choose(col, x) + choose(n - col, row - x) - choose(n, row));
    const observed = prob(a); let p = 0; for (let x = Math.max(0, row - (n - col)); x <= Math.min(row, col); x++) { const v = prob(x); if (v <= observed * (1 + 1e-10)) p += v; } return Math.min(1, p);
}
export function comparisons(items: Episode[], config: ResearchConfig) {
    const groups = new Map<string, { label: string; yes: number; n: number }>(), excluded: { id: string; reason: string }[] = [];
    for (const e of items) { const result = sequelaeOutcome(e, config.outcome), values = factorValues(e, config.group); if (result.value === null || values.length !== 1) { excluded.push({ id: e.id, reason: result.reason || 'Group missing or multiple categories; choose a single-valued factor' }); continue; } const label = values[0], g = groups.get(label) || { label, yes: 0, n: 0 }; g.n++; g.yes += result.value; groups.set(label, g); }
    const rows = [...groups.values()].sort((a, b) => a.label.localeCompare(b.label)).map(g => ({ ...g, ci: wilson(g.yes, g.n) }));
    let test: { p: number; difference: number; differenceCI: [number, number]; first: string; second: string } | null = null;
    if (rows.length === 2) { const [a, b] = rows, p1 = a.yes / a.n, p2 = b.yes / b.n, delta = p1 - p2; test = { p: fisher(a.yes, a.n - a.yes, b.yes, b.n - b.yes), difference: delta, differenceCI: [delta - Math.sqrt((p1 - a.ci![0]) ** 2 + (b.ci![1] - p2) ** 2), delta + Math.sqrt((a.ci![1] - p1) ** 2 + (p2 - b.ci![0]) ** 2)], first: a.label, second: b.label }; }
    return { rows, excluded, test };
}
export type HealingObservation = { id: string; time: number; event: boolean };
export function healingData(items: Episode[]) {
    const included: HealingObservation[] = [], excluded: { id: string; reason: string }[] = [];
    for (const e of items) {
        const candidates = e.members.filter(r => r.kind === 'ravc' && r.outcomes?.wound === 'yes');
        if (candidates.length !== 1) { excluded.push({ id: e.id, reason: candidates.length ? 'Multiple wound records in one episode: reconcile first' : 'No structured RAVC wound assessment' }); continue; }
        const o = candidates[0].outcomes!;
        if (!o.firstTreatment) { excluded.push({ id: e.id, reason: 'First RAVC treatment date missing' }); continue; }
        if (o.healing.status === 'healed') {
            if (o.healing.precision !== 'exact' || !validDay(o.healing.date)) { excluded.push({ id: e.id, reason: o.healing.precision === 'interval' ? 'Healing known only within an interval; excluded from exact-date curve' : 'Exact healing date unknown' }); continue; }
            const time = days(o.firstTreatment, o.healing.date); if (time < 0) { excluded.push({ id: e.id, reason: 'Healing date precedes treatment' }); continue; }
            included.push({ id: e.id, time, event: true });
        } else {
            const last = o.followups.filter(f => f.healing === 'not_healed').map(f => f.date).sort().at(-1);
            if (!last || o.followups.some(f => f.healing === 'healed')) { excluded.push({ id: e.id, reason: 'Last confirmed not-healed date missing or healing record needs review' }); continue; }
            const time = days(o.firstTreatment, last); if (time >= 0) included.push({ id: e.id, time, event: false });
        }
    }
    return { included, excluded };
}
export function kaplanMeier(observations: HealingObservation[]) {
    let survival = 1, greenwood = 0, median: number | null = null;
    const curve: { day: number; atRisk: number; healed: number; censored: number; proportionHealed: number; low: number; high: number }[] = [];
    for (const day of [...new Set(observations.map(o => o.time))].sort((a, b) => a - b)) {
        const atRisk = observations.filter(o => o.time >= day).length, healed = observations.filter(o => o.time === day && o.event).length, censored = observations.filter(o => o.time === day && !o.event).length;
        survival *= 1 - healed / atRisk;
        if (atRisk > healed) greenwood += healed / (atRisk * (atRisk - healed));
        let low = 1 - survival, high = low;
        if (survival > 0 && survival < 1) { const se = Math.sqrt(greenwood) / Math.abs(Math.log(survival)), center = Math.log(-Math.log(survival)); low = 1 - Math.exp(-Math.exp(center - 1.95996398454 * se)); high = 1 - Math.exp(-Math.exp(center + 1.95996398454 * se)); }
        if (median === null && survival <= .5) median = day;
        curve.push({ day, atRisk, healed, censored, proportionHealed: 1 - survival, low, high });
    }
    return { n: observations.length, healed: observations.filter(o => o.event).length, censored: observations.filter(o => !o.event).length, median, curve };
}
export function healingGroups(items: Episode[], factor: ResearchConfig['group']) {
    const data = healingData(items), groups = new Map<string, HealingObservation[]>(); let missingGroup = 0;
    for (const observation of data.included) { const e = items.find(e => e.id === observation.id)!, values = factorValues(e, factor); if (values.length !== 1) { missingGroup++; continue; } groups.set(values[0], [...(groups.get(values[0]) || []), observation]); }
    const rows = [...groups].sort(([a], [b]) => a.localeCompare(b)).map(([label, observations]) => ({ label, ...kaplanMeier(observations) }));
    let logRank: { chiSquare: number; p: number } | null = null;
    if (groups.size === 2) {
        const [a, b] = [...groups.values()], all = [...a, ...b]; let observedMinusExpected = 0, variance = 0;
        for (const time of [...new Set(all.filter(o => o.event).map(o => o.time))]) {
            const n1 = a.filter(o => o.time >= time).length, n2 = b.filter(o => o.time >= time).length, n = n1 + n2;
            const d1 = a.filter(o => o.event && o.time === time).length, d2 = b.filter(o => o.event && o.time === time).length, d = d1 + d2;
            observedMinusExpected += d1 - d * n1 / n;
            if (n > 1) variance += n1 * n2 * d * (n - d) / (n * n * (n - 1));
        }
        if (variance > 0) { const chiSquare = observedMinusExpected ** 2 / variance, x = Math.sqrt(chiSquare / 2), t = 1 / (1 + .3275911 * x), erf = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - .284496736) * t + .254829592) * t * Math.exp(-x * x); logRank = { chiSquare, p: Math.max(0, Math.min(1, 1 - erf)) }; }
    }
    return { groups: rows, missingGroup, logRank };
}
function inverse(a: number[][]): number[][] | null {
    const n = a.length, m = a.map((row, i) => [...row, ...Array.from({ length: n }, (_, j) => Number(i === j))]);
    for (let k = 0; k < n; k++) { let best = k; for (let i = k + 1; i < n; i++) if (Math.abs(m[i][k]) > Math.abs(m[best][k])) best = i; if (Math.abs(m[best][k]) < 1e-10) return null; [m[k], m[best]] = [m[best], m[k]]; const v = m[k][k]; for (let j = 0; j < 2 * n; j++) m[k][j] /= v; for (let i = 0; i < n; i++) if (i !== k) { const v = m[i][k]; for (let j = 0; j < 2 * n; j++) m[i][j] -= v * m[k][j]; } }
    return m.map(row => row.slice(n));
}
export function logistic(items: Episode[], config: ResearchConfig) {
    const selected = config.adjust, x: number[][] = [], y: number[] = [], excluded: { id: string; reason: string }[] = [];
    if (!selected.length) return { error: 'Choose one to three clinically justified factors.', n: 0, events: 0, rows: [], excluded };
    for (const e of items) { const outcome = sequelaeOutcome(e, config.outcome), values = selected.map(f => factorValues(e, f)); if (outcome.value === null || values.some(v => v.length !== 1)) { excluded.push({ id: e.id, reason: outcome.reason || 'Missing or conflicting factor values' }); continue; }
        const row = values.map((v, i) => selected[i] === 'severity' ? ({ mild: 0, moderate: 1, severe: 2 }[v[0]] ?? NaN) : Number(v[0]));
        if (row.some(v => !Number.isFinite(v))) { excluded.push({ id: e.id, reason: 'Invalid numerical factor' }); continue; } x.push([1, ...row]); y.push(outcome.value);
    }
    const n = y.length, events = y.reduce((a, b) => a + b, 0), base = { n, events, rows: [] as { factor: string; oddsRatio: number; low: number; high: number }[], excluded };
    // Conservative guardrail, not a guarantee of model adequacy.
    if (Math.min(events, n - events) < 10 * selected.length || n < 30) return { ...base, error: `Not enough assessed outcomes for this model: ${events} with and ${n - events} without the selected sequela. Need at least 30 complete episodes and 10 in each outcome category per selected factor.` };
    const means = selected.map((_, j) => x.reduce((s, r) => s + r[j + 1], 0) / n), scales = means.map((mean, j) => Math.sqrt(x.reduce((s, r) => s + (r[j + 1] - mean) ** 2, 0) / n));
    if (scales.some(s => s < 1e-8)) return { ...base, error: 'A factor has no variation in these cases. Choose another factor.' };
    const design = x.map(r => [1, ...means.map((m, j) => (r[j + 1] - m) / scales[j])]), size = selected.length + 1, beta = Array(size).fill(0); let cov: number[][] | null = null, converged = false;
    for (let iteration = 0; iteration < 60; iteration++) {
        const h = Array.from({ length: size }, () => Array(size).fill(0)), score = Array(size).fill(0);
        for (let i = 0; i < n; i++) { const eta = design[i].reduce((s, v, j) => s + v * beta[j], 0), p = 1 / (1 + Math.exp(-Math.max(-35, Math.min(35, eta)))), w = p * (1 - p); for (let j = 0; j < size; j++) { score[j] += design[i][j] * (y[i] - p); for (let k = 0; k < size; k++) h[j][k] += design[i][j] * w * design[i][k]; } }
        cov = inverse(h); if (!cov) break;
        const delta = cov.map(row => row.reduce((s, v, j) => s + v * score[j], 0)); for (let j = 0; j < size; j++) beta[j] += delta[j];
        if (Math.max(...beta.map(Math.abs)) > 25) break;
        if (Math.max(...delta.map(Math.abs)) < 1e-8) { converged = true; break; }
    }
    if (!converged || !cov) return { ...base, error: 'The model is unstable or groups separate perfectly. Results are withheld; simplify the model and seek statistical review.' };
    const rows = selected.map((f, j) => { const b = beta[j + 1] / scales[j], se = Math.sqrt(cov![j + 1][j + 1]) / scales[j]; return { factor: factorLabels[f] + (f === 'severity' ? ' (per step: mild → moderate → severe)' : f === 'age' ? ' (per year)' : ' (per day)'), oddsRatio: Math.exp(b), low: Math.exp(b - 1.95996398454 * se), high: Math.exp(b + 1.95996398454 * se) }; });
    if (rows.some(r => !Number.isFinite(r.high) || r.high / r.low > 1e8)) return { ...base, error: 'Estimates are too unstable to interpret. Results are withheld.' };
    return { ...base, rows, error: '' };
}
export function analyze(records: CaseRecord[], input: unknown) {
    const config = researchConfigSchema.parse(input), cohort = episodes(records, config), items = cohort.selected;
    const factors = Object.keys(factorLabels) as Factor[];
    const distributions = factors.map(f => distribution(items, f));
    const comparison = comparisons(items, config), healing = healingData(items), km = kaplanMeier(healing.included), model = config.mode === 'factors' ? logistic(items, config) : null;
    return { version: RESEARCH_VERSION, config, n: items.length, assessedOutcomes: items.filter(e => sequelaeOutcome(e, 'any').value !== null).length, linked: cohort.linked, unknownDates: cohort.unknownDates, dateExcluded: cohort.dateExcluded, categoryExcluded: cohort.categoryExcluded, distributions, comparison, healing: { ...km, excluded: healing.excluded, ...healingGroups(items, config.group) }, model, sources: items.flatMap(e => e.members.map(r => ({ id: r.id, revision: r.revision }))), episodes: items.map(e => ({ id: e.id, ids: e.members.map(r => r.id) })) };
}
export type ResearchResult = ReturnType<typeof analyze>;
export type ResearchSnapshot = { id: string; name: string; created: string; actor: string; result: ResearchResult };
