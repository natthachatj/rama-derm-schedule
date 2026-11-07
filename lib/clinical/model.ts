import { z } from 'zod';
import { outcomesSchema } from './outcomes';
import { fields, FORM_VERSION, type RegistryKind, type Field } from './catalog';
export const answerStates = ['recorded', 'none', 'unknown', 'not_assessed', 'not_applicable', 'not_recorded'] as const;
export const stateLabels: Record<string, string> = { recorded: 'Recorded', none: 'None', unknown: 'Unknown', not_assessed: 'Not assessed', not_applicable: 'Not applicable', not_recorded: 'Not recorded' };
export const answerSchema = z.object({ state: z.enum(answerStates), value: z.union([z.string().max(6000), z.array(z.string().max(300)).max(30)]).default(''), precision: z.enum(['day', 'minute']).optional() });
export type Answer = z.infer<typeof answerSchema>;
export const eventSchema = z.object({ id: z.string().uuid(), type: z.enum(['Injection', 'History', 'Investigation', 'Treatment', 'Follow-up']), date: z.string().max(10), datePrecision: z.enum(['day', 'month', 'year', 'unknown']), title: z.string().trim().min(1).max(160), details: z.string().max(6000), amount: z.string().max(100).optional(), unit: z.string().max(40).optional(), response: z.string().max(2000).optional() });
export type CaseEvent = z.infer<typeof eventSchema>;
export const formSchema = z.object({ kind: z.enum(['ravc', 'nodule']), answers: z.record(answerSchema), events: z.array(eventSchema).max(150), outcomes: outcomesSchema.optional() });
export type CaseForm = z.infer<typeof formSchema>;
export type CaseRecord = CaseForm & {
    id: string;
    presentationCode: string;
    owner: string;
    fellow: string;
    year: number;
    status: 'draft' | 'submitted' | 'approved';
    revision: number;
    formVersion: number;
    created: string;
    updated: string;
    submittedAt?: string;
    reviewedAt?: string;
    source?: {
        spreadsheet: string;
        sheet: string;
        row: number;
        fingerprint: string;
    };
    historical: boolean;
    sourceRaw?: Record<string, string>;
    folderId?: string;
    pdfId?: string;
    processing: 'draft' | 'pending' | 'complete' | 'failed';
    processingError?: string;
    linkedCaseIds: string[];
    history?: {
        at: string;
        actor: string;
        action: string;
        revision: number;
    }[];
};
export const settingsSchema = z.object({ font: z.enum(['Sarabun', 'Arial', 'Aptos', 'Tahoma']), titleColor: z.string().regex(/^[0-9A-Fa-f]{6}$/), bodyColor: z.string().regex(/^[0-9A-Fa-f]{6}$/), background: z.string().regex(/^[0-9A-Fa-f]{6}$/), titleSize: z.number().min(24).max(42), bodySize: z.number().min(14).max(24), footer: z.string().max(120), disabledFellows: z.array(z.string().max(100)).max(500), extraChoices: z.record(z.array(z.string().trim().min(1).max(100)).max(50)) });
export type ClinicalSettings = z.infer<typeof settingsSchema>;
export const defaultSettings: ClinicalSettings = { font: 'Sarabun', titleColor: '16376B', bodyColor: '24334A', background: 'FFFFFF', titleSize: 30, bodySize: 18, footer: 'RAMA Dermatology · information-only case summary', disabledFellows: [], extraChoices: {} };
export const emptyForm = (kind: RegistryKind): CaseForm => ({ kind, answers: {}, events: [] });
export const answerText = (a?: Answer) => !a ? 'Not recorded' : a.state === 'recorded' ? Array.isArray(a.value) ? a.value.join(', ') : a.value : stateLabels[a.state];
export function visible(f: Field, answers: Record<string, Answer>) { if (f.system)
    return false; if (!f.condition)
    return true; const a = answers[f.condition.field]; return a?.state === 'recorded' && (f.condition.values.includes('*') || f.condition.values.includes(String(a.value))); }
export function validateForm(input: unknown, submit = false) {
    const f = formSchema.parse(input), allowed = new Set(fields(f.kind).filter(x => !x.system).map(x => x.id));
    for (const k of Object.keys(f.answers))
        if (!allowed.has(k))
            throw Error('Unexpected form field.');
    const errors: {
        field: string;
        message: string;
    }[] = [];
    for (const field of fields(f.kind)) {
        if (!visible(field, f.answers))
            continue;
        const a = f.answers[field.id];
        if (submit && field.required && (!a || a.state === 'not_recorded' || a.state === 'recorded' && (!a.value.length || typeof a.value === 'string' && !a.value.trim()))) {
            errors.push({ field: field.id, message: `${field.label}: provide an answer or explicitly choose an appropriate information status.` });
            continue;
        }
        if (!a || a.state !== 'recorded')
            continue;
        const text = Array.isArray(a.value) ? a.value.join(', ') : a.value;
        if (field.type === 'number' && (text.trim() === '' || !Number.isFinite(Number(text)) || Number(text) < (field.min ?? 0) || Number(text) > (field.max ?? 1e9)))
            errors.push({ field: field.id, message: `${field.label}: enter a valid number${field.max !== undefined ? ' from ' + (field.min ?? 0) + ' to ' + field.max : ''}.` });
        if (field.type === 'date' || field.type === 'datetime') {
            const pattern = field.type === 'date' || a.precision === 'day' ? /^\d{4}-\d{2}-\d{2}$/ : /^\d{4}-\d{2}-\d{2}T([01]\d|2[0-3]):[0-5]\d$/;
            if (!pattern.test(text) || !validDay(text.slice(0, 10)))
                errors.push({ field: field.id, message: `${field.label}: choose a valid date.` });
        }
    }
    for (const e of f.events) {
        if (e.datePrecision === 'unknown') {
            if (e.date)
                errors.push({ field: 'events', message: 'An unknown event date must be empty.' });
        }
        else if (!(e.datePrecision === 'day' ? /^\d{4}-\d{2}-\d{2}$/.test(e.date) && validDay(e.date) : e.datePrecision === 'month' ? /^\d{4}-(0[1-9]|1[0-2])$/.test(e.date) : /^\d{4}$/.test(e.date)))
            errors.push({ field: 'events', message: `${e.title}: date does not match its precision.` });
        if (e.amount && (!Number.isFinite(Number(e.amount)) || Number(e.amount) < 0))
            errors.push({ field: 'events', message: `${e.title}: enter a nonnegative numerical amount.` });
        if (e.amount && !e.unit)
            errors.push({ field: 'events', message: `${e.title}: add a dose/amount unit.` });
    }
    const get = (k: string) => { const a = f.answers[k]; return a?.state === 'recorded' && typeof a.value === 'string' ? a.value : ''; };
    const injection = get(f.kind === 'ravc' ? 'ravc_O' : 'nodule_J'), visit = get(f.kind === 'ravc' ? 'ravc_Q' : 'nodule_K');
    if (injection && visit && injection.slice(0, 10) > visit.slice(0, 10))
        errors.push({ field: f.kind === 'ravc' ? 'ravc_Q' : 'nodule_K', message: 'First RAMA/RAVC visit cannot precede the recorded injection date. Check the dates.' });
    if (f.outcomes?.firstTreatment) { const onset = get(f.kind === 'ravc' ? 'ravc_P' : 'nodule_AB').slice(0, 10); if (validDay(onset) && f.outcomes.firstTreatment < onset) errors.push({ field: 'outcomes', message: 'First RAVC treatment cannot precede symptom onset. Check the dates.' }); }
    return { form: f, errors };
}
export function validDay(date: string) { return /^\d{4}-\d{2}-\d{2}$/.test(date) && !isNaN(Date.parse(date)) && new Date(date + 'T12:00Z').toISOString().slice(0, 10) === date; }
export function recordYear(r: CaseRecord, definition: 'visit' | 'injection' | 'academic' = 'visit') { const a = r.answers[r.kind === 'ravc' ? (definition === 'injection' ? 'ravc_O' : 'ravc_Q') : (definition === 'injection' ? 'nodule_J' : 'nodule_K')]; const d = a?.state === 'recorded' && typeof a.value === 'string' ? a.value : ''; if (!/^\d{4}-\d{2}-\d{2}/.test(d))
    return null; const n = Number(d.slice(0, 4)); return definition === 'academic' && Number(d.slice(5, 7)) < 7 ? n - 1 : n; }
export function newRecord(kind: RegistryKind, owner: string, fellow: string, year: number, now = new Date().toISOString()): CaseRecord { return { ...emptyForm(kind), id: crypto.randomUUID(), presentationCode: 'PRES-' + crypto.randomUUID().slice(0, 8).toUpperCase(), owner, fellow, year, status: 'draft', revision: 0, formVersion: FORM_VERSION, created: now, updated: now, historical: false, processing: 'draft', linkedCaseIds: [] }; }
export function safeReceipt(r: CaseRecord) { return { id: r.id, kind: r.kind, status: r.status, created: r.created, submittedAt: r.submittedAt, revision: r.revision, processing: r.status === 'draft' ? 'draft' : r.processing }; }
