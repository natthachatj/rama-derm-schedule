import { getStore } from '@netlify/blobs';
import { createHash } from 'node:crypto';
import { defaultSettings, type CaseRecord, type ClinicalSettings } from '../../../lib/clinical/model';
import type { ClinicalRepository } from '../../../lib/clinical/repository';
export function previewRepository(principal: string): ClinicalRepository { const store = getStore({ name: 'rama-derm-clinical-fictional-preview', consistency: 'strong' }), key = createHash('sha256').update(principal).digest('hex'); const load = async () => await store.get(key, { type: 'json' }) as {
    records: CaseRecord[];
    versions: CaseRecord[];
    settings: ClinicalSettings;
} | null || { records: [], versions: [], settings: structuredClone(defaultSettings) }; return { list: async () => (await load()).records, all: async () => (await load()).records, get: async (id) => (await load()).records.find(r => r.id === id) || null, put: async (r, actor, action) => { const data = await load(); data.records = data.records.filter(x => x.id !== r.id).concat(r); data.versions.push({ ...r, history: [{ at: r.updated, actor, action, revision: r.revision }] }); await store.setJSON(key, data); }, revisions: async (id) => (await load()).versions.filter(r => r.id === id), removeDraft: async (id) => { const data = await load(); data.records = data.records.filter(r => r.id !== id); await store.setJSON(key, data); }, settings: async () => (await load()).settings, saveSettings: async (settings) => { const data = await load(); data.settings = settings; await store.setJSON(key, data); } }; }
