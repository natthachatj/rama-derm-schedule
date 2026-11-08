import type { CaseRecord, ClinicalSettings } from './model';
import type { RegistryKind } from './catalog';
export type RecordIndex = Pick<CaseRecord, 'id' | 'kind' | 'owner' | 'fellow' | 'year' | 'status' | 'revision' | 'created' | 'updated' | 'historical' | 'processing'> & {
    submittedAt?: string;
    trashedAt?: string;
    searchText?: string;
};
export interface ClinicalRepository {
    list(): Promise<RecordIndex[]>;
    all(): Promise<CaseRecord[]>;
    get(id: string): Promise<CaseRecord | null>;
    put(record: CaseRecord, actor: string, action: string): Promise<void>;
    revisions(id: string): Promise<CaseRecord[]>;
    removeDraft(id: string): Promise<void>;
    settings(): Promise<ClinicalSettings>;
    saveSettings(settings: ClinicalSettings): Promise<void>;
}
export type ImportCandidate = {
    kind: RegistryKind;
    row: number;
    fingerprint: string;
    answers: Record<string, import('./model').Answer>;
    sourceRaw: Record<string, string>;
    existingId?: string;
    warnings: string[];
};
