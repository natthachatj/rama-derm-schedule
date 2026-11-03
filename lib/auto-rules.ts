import {z} from 'zod';
export const autoRulesSchema=z.object({mode:z.enum(['topics','jc']),weekdays:z.array(z.number().int().min(0).max(6)).min(1).max(7)});
export type AutoRules=z.infer<typeof autoRulesSchema>;
