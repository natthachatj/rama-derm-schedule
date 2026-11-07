import { z } from 'zod';
const day = z.string().refine(v => !v || /^\d{4}-\d{2}-\d{2}$/.test(v) && !isNaN(Date.parse(v)) && new Date(v + 'T12:00Z').toISOString().slice(0, 10) === v, 'Choose a valid calendar date.');
export const sequelaeChoices = ['None', 'Scarring', 'Pigmentation', 'Tissue loss', 'Functional impairment', 'Other'] as const;
export const outcomesSchema = z.object({
    wound: z.enum(['yes', 'no', 'not_assessed', 'unknown']).default('not_assessed'),
    firstTreatment: day.default(''),
    severity: z.enum(['mild', 'moderate', 'severe', 'unknown']).default('unknown'),
    healing: z.object({ status: z.enum(['healed', 'healing', 'not_assessed', 'unknown', 'not_applicable']).default('not_assessed'), precision: z.enum(['exact', 'interval', 'unknown']).default('unknown'), date: day.default(''), from: day.default(''), to: day.default('') }).default({}),
    followups: z.array(z.object({ id: z.string().uuid(), date: day.refine(Boolean, 'Add the assessment date.'), healing: z.enum(['healed', 'not_healed', 'not_assessed']), assessment: z.enum(['assessed', 'not_assessed', 'unknown']), sequelae: z.array(z.enum(sequelaeChoices)).max(6), recurrence: z.enum(['yes', 'no', 'not_assessed']), notes: z.string().max(1000).default('') })).max(100).default([])
}).superRefine((o, ctx) => {
    const error = (message: string) => ctx.addIssue({ code: 'custom', message });
    if (o.wound !== 'yes' && ['healed', 'healing'].includes(o.healing.status)) error('Wound healing requires wound present = Yes.');
    if (o.wound === 'yes' && o.healing.status === 'not_applicable') error('For an actual wound, choose an assessed healing status or not assessed/unknown.');
    if (o.healing.status === 'healed') {
        if (o.healing.precision === 'exact' && !o.healing.date) error('Add the exact healing date.');
        if (o.healing.precision === 'interval' && (!o.healing.from || !o.healing.to || o.healing.from >= o.healing.to)) error('Add an ordered healing interval: last not healed, then first healed.');
        const earliest = o.healing.precision === 'exact' ? o.healing.date : o.healing.precision === 'interval' ? o.healing.from : '';
        if (o.firstTreatment && earliest && earliest < o.firstTreatment) error('Healing cannot precede the first RAVC treatment date.');
    }
    if (o.healing.status === 'healed' && o.healing.precision === 'interval' && o.followups.some(f => f.healing === 'not_healed' && f.date >= o.healing.to || f.healing === 'healed' && f.date <= o.healing.from)) error('A dated wound assessment conflicts with the healing interval.');
    if (new Set(o.followups.map(f => f.date)).size !== o.followups.length) error('Use one follow-up assessment per date.');
    for (const f of o.followups) {
        if (o.firstTreatment && f.date < o.firstTreatment) error('Follow-up cannot precede first RAVC treatment.');
        if (f.assessment === 'assessed' && !f.sequelae.length) error('For an assessed visit, select None or the sequelae found.');
        if (f.sequelae.includes('None') && f.sequelae.length > 1) error('None cannot be combined with other sequelae.');
        if (f.assessment !== 'assessed' && f.sequelae.length) error('Unassessed sequelae cannot contain findings.');
        if (o.wound !== 'yes' && f.healing !== 'not_assessed') error('Record wound present before assessing healing.');
        if (o.healing.status === 'healed' && o.healing.precision === 'exact' && f.healing === 'not_healed' && f.date >= o.healing.date) error('A not-healed assessment conflicts with the exact healing date. Review the dates.');
    }
});
export type Outcomes = z.infer<typeof outcomesSchema>;
export const emptyOutcomes = (): Outcomes => outcomesSchema.parse({});
