import {iaSchema, iaErrors, decimal} from './intraarterial';
import { z } from 'zod';
import { conditionMet, malformed, chronology, reviewIssues, retainedText } from './review';
import { outcomesSchema } from './outcomes';
import { fields, FORM_VERSION, type RegistryKind, type Field } from './catalog';
export const answerStates = ['recorded', 'none', 'unknown', 'not_assessed', 'not_applicable', 'not_recorded'] as const;
export const stateLabels: Record<string, string> = { recorded: 'Recorded', none: 'None', unknown: 'Unknown', not_assessed: 'Not assessed', not_applicable: 'Not applicable', not_recorded: 'Not recorded' };
export const answerSchema = z.object({ state: z.enum(answerStates), value: z.union([z.string().max(6000), z.array(z.string().max(300)).max(30)]).default(''), precision: z.enum(['day', 'minute']).optional(), unit:z.string().max(40).optional(), upper:z.string().max(40).optional(), details:z.string().max(2000).optional(), sequenceException:z.string().max(1500).optional(), corrected:z.boolean().optional() });
export type Answer = z.infer<typeof answerSchema>;
export const unknownTreatmentFields = ['dose', 'route', 'frequency', 'duration'] as const;
export const eventSchema = z.object({ id: z.string().uuid(), type: z.enum(['Injection', 'History', 'Investigation', 'Treatment', 'Follow-up']), date: z.string().max(10), datePrecision: z.enum(['day', 'month', 'year', 'unknown']), title: z.string().trim().max(160), stopDate:z.string().max(10).optional(), unknownDetails:z.array(z.enum(unknownTreatmentFields)).max(4).optional(), details: z.string().max(6000), amount: z.string().max(100).optional(), unit: z.string().max(40).optional(), response: z.string().max(2000).optional(), agent:z.string().max(120).optional(), route:z.string().max(120).optional(), category:z.enum(['medication','procedure','dissolution','injection']).optional(), material:z.string().max(120).optional(),brand:z.string().max(120).optional(),frequency:z.string().max(120).optional(), duration:z.string().max(40).optional(), durationUnit:z.enum(['days','weeks','months','years']).optional() }).refine(event => event.type === 'Treatment' || !!event.title, {path:['title'], message:'Add a title to the dated event.'});
export type CaseEvent = z.infer<typeof eventSchema>;
export const formSchema = z.object({ kind: z.enum(['ravc', 'nodule']), answers: z.record(answerSchema), events: z.array(eventSchema).max(150), timelineStatus: z.enum(['recorded','none','pending']).optional(), intraarterial: iaSchema.optional(), outcomes: outcomesSchema.optional() });
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
    trashedAt?: string;
    trashedBy?: string;
    submittedAt?: string;
    reviewedAt?: string;
    source?: {
        spreadsheet: string;
        sheet: string;
        row: number;
        fingerprint: string;
    };
    historical: boolean;
    remindersHidden?: boolean;
    managementUnavailable?: { at: string; actor: string };

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
export const answerText = (a?: Answer):string => {
 if(!a)return 'Not recorded';
 const value=a.state==='recorded'?(Array.isArray(a.value)?a.value.join(', '):a.value)+(a.upper?'–'+a.upper:'')+(a.unit?' '+a.unit:''):stateLabels[a.state];
 return value+(retainedText(a)?' · Retained saved text: '+retainedText(a):'')+(a.details?' · '+a.details:'');
};
export function visible(f: Field, answers: Record<string, Answer>) {return !f.system&&(answers[f.id]?.state==='recorded'&&f.type==='number'||!!answers[f.id]?.details?.trim()||conditionMet(f,answers)||!!retainedText(answers[f.id]).trim()||answers[f.id]?.state==='recorded' && (Array.isArray(answers[f.id].value)?answers[f.id].value.length>0:!!String(answers[f.id].value).trim()));}
export function dissolutionAgents(form: CaseForm): string[] {
    const answer = form.answers.ravc_AC;
    if (form.kind !== 'ravc' || answer?.state !== 'recorded') return [];
    const values = Array.isArray(answer.value) ? answer.value : [answer.value];
    return [...new Set(values.map(v => v.trim()).filter(v => v && !/^(none|no|not applicable|-)$/i.test(v)))];
}
export const treatmentDetailsPending = 'Treatment details pending';
export function validateForm(input: unknown, submit = false, extraChoices:Record<string,string[]> = {}, historical = false, managementExempt = false) {
    const f = formSchema.parse(input), allowed = new Set(fields(f.kind).filter(x => !x.system).map(x => x.id));
    for (const k of Object.keys(f.answers))
        if (!allowed.has(k))
            throw Error('Unexpected form field.');
    const errors: {
        field: string;
        message: string;
    }[] = [];
    if(f.kind==='ravc') for(const message of iaErrors(f.intraarterial,submit,historical))errors.push({field:'intraarterial',message});
    else if(f.intraarterial)errors.push({field:'intraarterial',message:'Intraarterial records belong to the RAVC registry.'});
    const deferred: typeof errors = [];
    const missingTreatment = (field: string, message: string) => {
        if (submit) (f.timelineStatus === 'pending' && !historical ? deferred : errors).push({ field, message });
    };
    const agents = dissolutionAgents(f);
    const separateDoses = !historical && agents.length > 1;
    if (separateDoses) {
        for (const key of ['ravc_dissolution_total', 'ravc_dissolution_unit']) {
            const answer = f.answers[key];
            if (answer) f.answers[key] = { ...answer, state: 'not_applicable' };
        }
    }
    for (const field of fields(f.kind)) {
        if (separateDoses && ['ravc_dissolution_total', 'ravc_dissolution_unit'].includes(field.id)) continue;
        if (!visible(field, f.answers))
            continue;
        const a = f.answers[field.id];
        if (submit && field.required && (!a || a.state === 'not_recorded' || a.state === 'recorded' && (!a.value.length || typeof a.value === 'string' && !a.value.trim()))) {
            const message = `${field.label}: provide an answer or explicitly choose an appropriate information status.`;
            if (field.id === 'ravc_dissolution_total') missingTreatment(field.id, message);
            else errors.push({ field: field.id, message });
            continue;
        }
        if (!a || a.state !== 'recorded')
            continue;
        const text = Array.isArray(a.value) ? a.value.join(', ') : a.value;
        if(submit && a.unit==='Other' && !(a.details||'').trim())errors.push({field:field.id,message:field.label+': describe the Other unit in notes.'});
        if(submit && field.options && (Array.isArray(a.value)?a.value:field.type==='multi'?String(a.value).split(', '):[a.value]).some(v=>![...field.options!,...(extraChoices[field.id]||[])].includes(v)))errors.push({field:field.id,message:field.label+': select a supported choice, or use Other with details.'});
        if(submit && field.condition && !conditionMet(field,f.answers) && text.trim())errors.push({field:field.id,message:field.label+': saved details conflict with the parent answer. Review both answers before submitting.'});
        const problem=malformed(field,a);
        if(problem)errors.push({field:field.id,message:field.label+': '+problem});
        if(submit && field.units && a.state==='recorded' && !a.unit)errors.push({field:field.id,message:field.label+': select the quantity unit.'});
        if(submit && field.options && (Array.isArray(a.value)?a.value:[a.value]).includes('Other') && !(a.details||'').trim())errors.push({field:field.id,message:field.label+': describe Other in the notes.'});
    }
    if (f.kind === 'ravc') {
        const total = f.answers.ravc_dissolution_total, unit = f.answers.ravc_dissolution_unit;
        if (separateDoses) {
            const documented = new Set(f.events.filter(e => e.type === 'Treatment' && e.category === 'dissolution' &&
                (e.unknownDetails?.includes('dose') || (e.amount && decimal(e.amount) && e.unit)))
                .map(e => e.agent?.trim().toLowerCase()));
            if (agents.some(agent => !documented.has(agent.toLowerCase()))) {
                missingTreatment('ravc_dissolution_total', 'Add a Dissolution entry for each selected agent, with its own dose and unit or Dose unknown.');
            }
        } else {
            if (total?.state === 'recorded' && String(total.value).trim() && (!unit || unit.state !== 'recorded' || !String(unit.value).trim() || ['Other','Multiple agents: see treatment events'].includes(String(unit.value)))) {
                errors.push({field:'ravc_dissolution_unit',message:'Dose unit: choose a unit for the recorded numerical total.'});
            }
            if (agents.length > 0 && !(total && ['recorded','unknown'].includes(total.state)) &&
                !(f.answers.ravc_AD?.state === 'recorded' && String(f.answers.ravc_AD.value).trim()) &&
                !f.events.some(e => e.type === 'Treatment' && e.agent && ((e.amount && e.unit) || e.unknownDetails?.includes('dose')))) {
                missingTreatment('ravc_dissolution_total','Record a dissolution dose, document it in a treatment entry, or select Unknown.');
            }
            if (historical && total?.state === 'recorded' && agents.length > 1) {
                errors.push({field:'ravc_dissolution_total',message:'Several dissolution agents are selected. Record separate doses in treatment events; do not combine them into one total.'});
            }
        }
    }
    if(submit)for(const issue of reviewIssues(f,extraChoices).filter(i=>i.message.includes('positive session count')))errors.push({field:issue.field,message:issue.message});
    for(const issue of chronology(f))errors.push({field:issue.field,message:issue.message});
    for (const e of f.events) {
        if (e.datePrecision === 'unknown') {
            if (e.date)
                errors.push({ field: 'events', message: 'An unknown event date must be empty.' });
        }
        else if ((e.date || submit || e.type !== 'Treatment') && !(e.datePrecision === 'day' ? /^\d{4}-\d{2}-\d{2}$/.test(e.date) && validDay(e.date) : e.datePrecision === 'month' ? /^\d{4}-(0[1-9]|1[0-2])$/.test(e.date) : /^\d{4}$/.test(e.date)))
            if (!e.date && e.type === 'Treatment') missingTreatment('events', 'Set a treatment date or choose Unknown.');
            else errors.push({ field: 'events', message: `${e.title}: date does not match its precision.` });
        if (e.stopDate && (!validDay(e.stopDate) || (e.date && e.stopDate.slice(0,e.date.length) < e.date))) {
            errors.push({field:'events',message:'Medication stop date must be valid and on or after the start date.'});
        }
        if (submit && !e.title.trim()) {
            if (e.type === 'Treatment') missingTreatment('events', 'Add a title to the treatment entry.');
            else errors.push({field:'events',message:'Add a title to the dated event.'});
        }
        if (e.amount && (!decimal(e.amount) || Number(e.amount) < 0))
            errors.push({ field: 'events', message: `${e.title}: enter a nonnegative numerical amount.` });
        if (e.duration && !decimal(e.duration)) errors.push({field:'events',message:e.title+': enter a nonnegative numerical duration.'});
        if (e.type === 'Treatment' && e.category === 'medication') {
            const unknown = new Set(e.unknownDetails);
            if (!e.agent?.trim() || (!unknown.has('dose') && (!e.amount || !e.unit)) ||
                (!unknown.has('route') && !e.route) || (!unknown.has('frequency') && !e.frequency?.trim()) ||
                (!unknown.has('duration') && (!e.duration || !e.durationUnit))) {
                missingTreatment('events', 'For each medication, enter its name and fill in or mark unknown its dose, route, frequency and duration.');
            }
        } else if (e.amount && !e.unit) {
            if (e.type === 'Treatment' && e.category === 'dissolution') missingTreatment('events', 'Select a unit for the recorded dissolution dose.');
            else errors.push({ field: 'events', message: `${e.title}: add a dose/amount unit.` });
        }
        if (e.type === 'Treatment' && e.category === 'dissolution' && (!e.agent?.trim() || (!e.amount && !e.unknownDetails?.includes('dose')))) {
            missingTreatment('events', 'Enter the dissolution agent and its dose, or mark the dose unknown.');
        }
    }
    if (!(historical && managementExempt)) {
        const status = f.answers[f.kind + '_medical_status'];
        if (status?.state === 'recorded' && status.value === 'Performed' &&
            !f.events.some(e => e.type === 'Treatment' && e.category === 'medication')) {
            missingTreatment('events', 'Add a medication entry for prescribed medical treatment.');
        }
    }
    if(submit && !(historical && managementExempt)) {
        const treatments=f.events.filter(e=>e.type==='Treatment');
        if(f.timelineStatus==='none' && (treatments.length || Object.entries(f.answers).some(([key,a])=>key.endsWith('_status')&&a.state==='recorded'&&a.value==='Performed') || f.intraarterial?.status==='performed'))errors.push({field:'events',message:'No treatment performed conflicts with recorded treatment. Review management status and timeline.'});
        else if(f.timelineStatus!=='none' && !treatments.some(e=>e.details.trim() || e.agent?.trim()))missingTreatment('events','Add treatment details or explicitly select No treatment performed.');
    }
    const get = (k: string) => { const a = f.answers[k]; return a?.state === 'recorded' && typeof a.value === 'string' ? a.value : ''; };
    if (f.outcomes?.firstTreatment) { const onset = get(f.kind === 'ravc' ? 'ravc_P' : 'nodule_AB').slice(0, 10); if (validDay(onset) && f.outcomes.firstTreatment < onset) errors.push({ field: 'outcomes', message: 'First RAVC treatment cannot precede symptom onset. Check the dates.' }); }
    return { form: f, errors, deferred: [...new Map(deferred.map(issue => [issue.message, issue])).values()] };
}
export function validDay(date: string) { return /^\d{4}-\d{2}-\d{2}$/.test(date) && !isNaN(Date.parse(date)) && new Date(date + 'T12:00Z').toISOString().slice(0, 10) === date; }
export function recordYear(r: CaseRecord, definition: 'visit' | 'injection' | 'academic' = 'visit') { const a = r.answers[r.kind === 'ravc' ? (definition === 'injection' ? 'ravc_O' : 'ravc_Q') : (definition === 'injection' ? 'nodule_J' : 'nodule_K')]; const d = a?.state === 'recorded' && typeof a.value === 'string' ? a.value : ''; if (!/^\d{4}-\d{2}-\d{2}/.test(d))
    return null; const n = Number(d.slice(0, 4)); return definition === 'academic' && Number(d.slice(5, 7)) < 7 ? n - 1 : n; }
export function newRecord(kind: RegistryKind, owner: string, fellow: string, year: number, now = new Date().toISOString()): CaseRecord { return { ...emptyForm(kind), id: crypto.randomUUID(), presentationCode: 'PRES-' + crypto.randomUUID().slice(0, 8).toUpperCase(), owner, fellow, year, status: 'draft', revision: 0, formVersion: FORM_VERSION, created: now, updated: now, historical: false, processing: 'draft', linkedCaseIds: [] }; }
export function safeReceipt(r: CaseRecord) { return { id: r.id, kind: r.kind, status: r.status, created: r.created, submittedAt: r.submittedAt, revision: r.revision, processing: r.status === 'draft' ? 'draft' : r.processing }; }
