export type RegistryKind = 'ravc' | 'nodule';
export const SOURCES = { ravc: { title: 'RAVC complication case', sheetId: '1T9eHLdm84bHKy3uoRY5dsXLEGc_izKhaN3HhtcVd2XI', tab: 'Form Responses 1' }, nodule: { title: 'Injectable-related nodule', sheetId: '13xdpgSqdTvoBkxuYJwYVoMLZRbXXB1KR9sh7SRYNck0', tab: 'Form Responses 1' } } as const;
export const DRIVE_PARENT = '1fUqfMTRLxfcl_mSKeiLozlNDG1QYWo5P';
export const FORM_VERSION = 1;
export const sectionTitles = ['Patient & referral', 'Injection & history', 'Symptoms & examination', 'Ultrasound', 'Pathology & microbiology', 'Management', 'Follow-up & outcome', 'Other investigations'];
export type Field = {
    id: string;
    header: string;
    label: string;
    section: number;
    type: 'text' | 'long' | 'number' | 'date' | 'datetime' | 'choice' | 'multi';
    options?: string[];
    required: boolean;
    private?: boolean;
    system?: boolean;
    extra?: boolean;
    condition?: {
        field: string;
        values: string[];
    };
    min?: number;
    max?: number;
};
export const column = (index: number) => { let value = '', n = index + 1; while (n) {
    n--;
    value = String.fromCharCode(65 + n % 26) + value;
    n = Math.floor(n / 26);
} return value; };
const ravc = `Timestamp|HN|ชื่อ นามสกุล|Age|U/D|สถานที่ Refer Case|ชื่อคลินิก/สถานพยาบาล|แพทย์ที่ Refer Case|ชื่อ-นามสกุล แพทย์ที่ Refer Case|เบอร์โทรติดต่อผู้ refer case|Product ที่ใช้|Brand product ที่ใช้|Technique/ตำแหน่งที่ฉีด/Depth/ปริมาณที่ฉีด|Initial Management|วันและเวลาที่ฉีดสารเติมเต็ม|วันและเวลาที่มีอาการครั้งแรก|วันและเวลาที่เข้ารับบริการ RAVC ครั้งแรก|วันสุดท้ายที่มา F/U|Fellow ที่รับผิดชอบเคส|Attending Staff|Presenting Symptoms|Presenting Signs|Worst Area|Necrotic Area Involvement (Detailed)|Other organ involvement|Ultrasound evaluation (before 1st dissolution at RAMA)|Ultrasound evaluation (at Follow-up visits)|Dissolution Technique Used|Dissolution substance used|Total amount of dissolution agent used|Total sessions of filler dissolution|Total sessions of LED|Total sessions of HBOT|Medications|Final Outcome|Upload Case Summary File|Merged Doc ID - RAVC Case Summary|Merged Doc URL - RAVC Case Summary|Link to merged Doc - RAVC Case Summary|Document Merge Status - RAVC Case Summary`.split('|');
const nodule = `Timestamp|HN|Age at Presentation (years)|Sex at Birth|Ethnicity / Race|Received treatment from which location?|Referring Doctor|H/O of Injected Material(s) - Please list Product/Substance, Brand Name, Volume (mL), Date of Last Injection, and No. of Sessions|Main Chief Complaint|Date of last injection|Date of RAMA OPD visit|Approximate duration (days)| Injection Details: Main Product used|Brand(s) of product used|Amount of Product used (mL)|Area of Injection (Detailed)|Area of all Injection (Selection)|Area of problem (Selection)|Injection Depth / Plane|Needle used|Injection Technique| Prior Treatments / Co-exposures: Prior Filler at Same Site?|Type of Prior / co-existing product(s) (if applicable)|Concurrent Neurotoxin?|Prior Laser / Energy Device at Site?|Prior Surgery at Site?|Other Relevant Exposures|Nodule Onset & Symptoms: Date of First Noticing Nodule (DD/MM/YYYY)|Time to Onset after Injection (days)|Onset Timing Classification|Triggering Event|Symptoms at Presentation (Select all that apply)|Pain Score (NRS 0–10)|Systemic Symptoms|Nodule Characteristics (Clinical Examination): Detailed Anatomical Site(s) Affected|Side|Number of Nodules|Size – Largest Dimension (cm)|Consistency|Skin Surface|Tenderness|Mobility|Overlying Skin Changes|Clinical Classification: Nodule Type (Clinical Impression)|Operator / Sonographer|Ultrasound System / Machine|Modes Used (Select all that apply)|Nodule Morphology on B-Mode: Number of Lesions on US|Lesion Dimensions (cm) - Length, Width|Depth from Skin Surface (mm)|Shape|Margins|Internal Echogenicity|Internal Structure|Posterior Acoustic Features|Foreign Material Echoes|Doppler Assessment: Internal Vascularity (Color/Power Doppler)|Vascularity Grade (0 - Avascular, 3 - Marked)|Surrounding Tissue: Perinodular Soft Tissue Changes|Skin / Dermis Involvement|Lymph Node Status|Deep Structure Involvement|Skin Biopsy done?|Biopsy / Aspiration Details: Procedure Performed|Site of Biopsy / Sample|Surgical patho no.|Microscopic / Histopathological Findings: Inflammatory Pattern|Granuloma Formation|Foreign Material Identified|Necrosis|Fibrosis|Vascular Changes|Biofilm Evidence|Special Stains & Immunohistochemistry - Results and Interpretation [PAS (Periodic Acid-Schiff)]|Special Stains & Immunohistochemistry - Results and Interpretation [Ziehl-Neelsen (AFB)]|Special Stains & Immunohistochemistry - Results and Interpretation [Gram Stain]|Special Stains & Immunohistochemistry - Results and Interpretation [GMS (Gomori Methenamine Silver)]|Special Stains & Immunohistochemistry - Results and Interpretation [Fite stain]|Special Stains & Immunohistochemistry - Results and Interpretation [Alcian blue pH2.5]|Special Stains & Immunohistochemistry - Results and Interpretation [Other]|Microbiology / Culture: Culture Performed?|Culture Result|Organism(s) Identified|PCR / Molecular Testing|Organism on PCR (if positive)|Final Histopathological Diagnosis: Category selection|Final Histopathological Diagnosis: as described |Initial Management: Initial Management Strategy|Date Treatment Initiated (DD/MM/YYYY)|Medical Treatment - Please specify Drug/Agent, Dose, Route, Duration, and Response for each agent used.|Medication Used|Total duration of medical treatment (months)|Procedural Interventions: Procedure(s) Performed (Select all that apply)|Total session of physical treatment (sessions)|U/S-guided technique used|Needle used for U/S|Total amount of Hyaluronidase used (units) if applicable|Adjunct & Supportive Treatments: Wound Care|SECTION 7 — CLINICAL OUTCOME & FOLLOW-UP|Overall Treatment Response: Final Clinical Outcome|Aesthetic Outcome|Skin Changes at Resolution (Select all that apply)|Time to Resolution (if applicable)|Recurrence?|Date of Recurrence (DD/MM/YYYY)|Treatment on Recurrence|Complications of Treatment: Treatment-Related Complications (Select all that apply)|Complication Details|Summary of Clinical Course & Final Outcome Notes|SECTION 8 — SUPPLEMENTARY INVESTIGATIONS (if performed)|Imaging (beyond US)|Imaging Date & Findings Summary|Laboratory Investigations|Significant abnormal lab results`.split('|');
const materials = ['HA', 'Cross-linked HA filler', 'Non-cross-linked HA', 'CaHA', 'PLLA', 'PCL', 'PMMA', 'Silicone', 'Other'];
const regions = ['Forehead', 'Glabella', 'Temple', 'Nose', 'Cheek', 'Nasolabial fold', 'Lips', 'Chin', 'Jawline', 'Neck', 'Body', 'Other'];
const symptoms = ['Pain', 'Swelling', 'Redness', 'Blanching', 'Discoloration', 'Nodule', 'Ulceration', 'Visual symptoms', 'Other'];
const choices: Record<string, string[]> = { ravc_K: materials, ravc_U: symptoms, ravc_V: ['Blanching', 'Livedo', 'Erythema', 'Edema', 'Necrosis', 'Nodule', 'Ulceration', 'Other'], ravc_W: regions, ravc_AB: ['Ultrasound guided', 'Blind injection', 'Subcutaneous', 'Intraarterial', 'Other'], ravc_AC: ['Hyaluronidase', 'Saline', 'Sodium thiosulfate', 'Other'], ravc_AI: ['Resolved', 'Improved', 'Unchanged', 'Worsened', 'Lost to follow-up', 'Ongoing treatment', 'Other'], nodule_D: ['Female', 'Male', 'Intersex', 'Other'], nodule_M: materials, nodule_Q: regions, nodule_R: regions, nodule_S: ['Intradermal', 'Subcutaneous', 'Supraperiosteal', 'Intramuscular', 'Other'], nodule_U: ['Needle injection', 'Cannula injection', 'Bolus', 'Linear threading', 'Fanning', 'Other'], nodule_AD: ['Immediate', 'Early onset', 'Delayed onset', 'Other'], nodule_AF: symptoms, nodule_AJ: ['Left', 'Right', 'Bilateral', 'Midline', 'Multiple sites'], nodule_AM: ['Soft', 'Firm', 'Hard', 'Fluctuant', 'Mixed'], nodule_AO: ['Tender', 'Non-tender', 'Variable'], nodule_AR: ['Inflammatory', 'Non-inflammatory', 'Mixed', 'Other'], nodule_AU: ['B-mode', 'Color Doppler', 'Power Doppler', 'Spectral Doppler', 'Elastography', 'Other'], nodule_AY: ['Oval', 'Round', 'Irregular', 'Other'], nodule_AZ: ['Well defined', 'Ill defined', 'Mixed'], nodule_BA: ['Anechoic', 'Hypoechoic', 'Isoechoic', 'Hyperechoic', 'Heterogeneous', 'Mixed'], nodule_BB: ['Solid', 'Cystic', 'Mixed', 'Other'], nodule_BE: ['Present', 'Absent', 'Peripheral only', 'Internal and peripheral'], nodule_CH: ['Foreign body reaction', 'Infection', 'Inflammatory reaction', 'Fibrosis', 'Other'], nodule_CM: ['Antibiotic', 'Corticosteroid', 'Anti-inflammatory', 'Other'], nodule_CO: ['Observation', 'Aspiration', 'Injection', 'Excision', 'Drainage', 'Other'], nodule_CV: ['Resolved', 'Improved', 'Unchanged', 'Worsened', 'Ongoing treatment', 'Lost to follow-up', 'Other'] };
Object.assign(choices, { nodule_AN: ['Normal', 'Erythematous', 'Ulcerated', 'Draining', 'Other'], nodule_AP: ['Mobile', 'Fixed', 'Partially mobile'], nodule_AQ: ['None', 'Erythema', 'Pigmentation', 'Ulceration', 'Other'], nodule_BC: ['None', 'Enhancement', 'Shadowing', 'Mixed'], nodule_BG: ['None', 'Edema', 'Inflammation', 'Collection', 'Other'], nodule_BH: ['Not involved', 'Involved', 'Other'], nodule_BI: ['Normal', 'Enlarged', 'Not visualized', 'Other'], nodule_BJ: ['Not involved', 'Fascia', 'Muscle', 'Vessel', 'Other'], nodule_BO: ['Acute', 'Chronic', 'Mixed', 'Granulomatous', 'Other'], nodule_CD: ['Positive', 'Negative', 'Pending', 'Contaminated', 'Other'], nodule_CJ: ['Observation', 'Medical treatment', 'Procedure', 'Combined', 'Other'], nodule_CW: ['Excellent', 'Good', 'Fair', 'Poor', 'Other'], nodule_CT: ['None', 'Standard wound care', 'Advanced dressing', 'Other'] });
const yesNo = ['Yes', 'No'];
for (const key of ['V', 'X', 'Y', 'Z', 'BK', 'CC', 'CF', 'CZ', 'BP', 'BQ', 'BR', 'BS', 'BT', 'BU'])
    choices['nodule_' + key] = yesNo;
const multi = new Set(['ravc_U', 'ravc_V', 'ravc_W', 'ravc_AB', 'ravc_AC', 'nodule_Q', 'nodule_R', 'nodule_U', 'nodule_AF', 'nodule_AU', 'nodule_CM', 'nodule_CO']);
const numbers = new Set(['ravc_D', 'ravc_AD', 'ravc_AE', 'ravc_AF', 'ravc_AG', 'nodule_C', 'nodule_L', 'nodule_O', 'nodule_AC', 'nodule_AG', 'nodule_AK', 'nodule_AL', 'nodule_AV', 'nodule_AX', 'nodule_BF', 'nodule_CN', 'nodule_CP', 'nodule_CS']);
const dateFields = new Set(['ravc_R', 'nodule_J', 'nodule_K', 'nodule_AB', 'nodule_CK', 'nodule_DA']);
const privateFields = new Set(['ravc_B', 'ravc_C', 'ravc_F', 'ravc_G', 'ravc_H', 'ravc_I', 'ravc_J', 'ravc_L', 'ravc_AJ', 'nodule_B', 'nodule_F', 'nodule_G', 'nodule_N', 'nodule_BN']);
function section(kind: RegistryKind, i: number) { if (kind === 'ravc')
    return i < 10 ? 0 : i < 17 ? 1 : i < 18 ? 6 : i < 20 ? 0 : i < 25 ? 2 : i < 27 ? 3 : i < 34 ? 5 : 6; return i < 7 ? 0 : i < 27 ? 1 : i < 44 ? 2 : i < 62 ? 3 : i < 87 ? 4 : i < 98 ? 5 : i < 110 ? 6 : 7; }
export function fields(kind: RegistryKind): Field[] {
    const base: Field[] = (kind === 'ravc' ? ravc : nodule).map((header, i) => {
        const id = kind + '_' + column(i);
        let condition: Field['condition'];
        if (kind === 'nodule') {
            if (i >= 63 && i <= 79)
                condition = { field: 'nodule_BK', values: ['Yes'] };
            if (i === 81 || i === 82)
                condition = { field: 'nodule_CC', values: ['Yes'] };
            if (i === 84)
                condition = { field: 'nodule_CF', values: ['Yes'] };
            if (i === 104 || i === 105)
                condition = { field: 'nodule_CZ', values: ['Yes'] };
            if (i === 22)
                condition = { field: 'nodule_V', values: ['Yes'] };
        }
        const system = i === 0 || (kind === 'ravc' && i >= 36) || (kind === 'nodule' && (i === 98 || i === 109));
        const optional = (kind === 'ravc' && [4, 9, 35].includes(i)) || (kind === 'nodule' && [4, 26, 65, 86, 107, 108].includes(i));
        return { id, header, label: kind === 'ravc' ? ({ B: 'HN', C: 'Patient name', D: 'Age (years)', E: 'Underlying conditions', F: 'Referral source category', G: 'Referring clinic / hospital', H: 'Referring clinician category', I: 'Referring clinician name', J: 'Referring clinician phone', K: 'Material type', L: 'Product brand', M: 'Injection site, technique, depth and amount', N: 'Initial management', O: 'Injection date/time (ICT)', P: 'Symptom onset date/time (ICT)', Q: 'First RAVC visit date/time (ICT)', R: 'Last follow-up date', S: 'Responsible fellow', T: 'Attending clinician' } as Record<string, string>)[column(i)] || header : header.trim(), section: section(kind, i), type: numbers.has(id) ? 'number' : dateFields.has(id) ? 'date' : kind === 'ravc' && i >= 14 && i <= 16 ? 'datetime' : choices[id] ? multi.has(id) ? 'multi' : 'choice' : /Details|Findings|Summary|History|Management|Treatment|evaluation|Technique\/|H\/O|Medications/i.test(header) ? 'long' : 'text', options: choices[id], required: !system && !optional, private: privateFields.has(id), system, condition, min: numbers.has(id) ? 0 : undefined, max: ['ravc_D', 'nodule_C'].includes(id) ? 120 : id === 'nodule_AG' ? 10 : id === 'nodule_BF' ? 3 : undefined };
    });
    if (kind === 'ravc')
        base.push({ id: 'ravc_dissolution_unit', header: 'Dissolution amount unit', label: 'Dissolution amount unit', section: 5, type: 'choice', options: ['units', 'mg', 'mL', 'Multiple agents: see treatment events', 'Other'], required: true, extra: true, condition: { field: 'ravc_AD', values: ['*'] } }, { id: 'ravc_complication_type', header: 'Complication type', label: 'Complication type', section: 2, type: 'choice', options: ['Vascular complication', 'Nodule', 'Inflammatory reaction', 'Other'], required: true, extra: true });
    if (kind === 'nodule') {
        base.find(f => f.id === 'nodule_CS')!.condition = { field: 'nodule_hyal', values: ['Yes'] };
        base.push({ id: 'nodule_hyal', header: 'Hyaluronidase used', label: 'Hyaluronidase used?', section: 5, type: 'choice', options: yesNo, required: true, extra: true }, { id: 'nodule_hyal_sessions', header: 'Hyaluronidase sessions', label: 'Hyaluronidase sessions', section: 5, type: 'number', min: 0, required: true, extra: true, condition: { field: 'nodule_hyal', values: ['Yes'] } }, { id: 'nodule_hyal_technique', header: 'Hyaluronidase technique', label: 'Hyaluronidase technique', section: 5, type: 'text', required: true, extra: true, condition: { field: 'nodule_hyal', values: ['Yes'] } });
    }
    return base;
}
export const fieldById = (kind: RegistryKind, id: string) => fields(kind).find(f => f.id === id);
