export type RegistryKind = 'ravc' | 'nodule';
export const SOURCES = { ravc: { title: 'RAVC complication case', sheetId: '1T9eHLdm84bHKy3uoRY5dsXLEGc_izKhaN3HhtcVd2XI', tab: 'Form Responses 1' }, nodule: { title: 'Injectable-related nodule', sheetId: '13xdpgSqdTvoBkxuYJwYVoMLZRbXXB1KR9sh7SRYNck0', tab: 'Form Responses 1' } } as const;
export const DRIVE_PARENT = '1fUqfMTRLxfcl_mSKeiLozlNDG1QYWo5P';
export const FORM_VERSION = 5;
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
    units?: string[];
    unit?: string;
    integer?: boolean;
    range?: boolean;
    help?: string;
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
const numbers = new Set(['ravc_D', 'ravc_AE', 'ravc_AF', 'ravc_AG', 'nodule_C', 'nodule_L', 'nodule_O', 'nodule_AC', 'nodule_AG', 'nodule_AK', 'nodule_AL', 'nodule_AV', 'nodule_AX', 'nodule_BF', 'nodule_CN', 'nodule_CP', 'nodule_CS']);
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
    if (kind === 'ravc') { const description = base.find(f=>f.id==='ravc_AD')!; description.type='long'; description.required=false; description.label='Dissolution dose / treatment description (original text)'; }
    if (kind === 'ravc')
        base.push({ id:'ravc_dissolution_total', header:'Structured dissolution total dose', label:'Structured total dose', section:5, type:'number', min:0, required:false, extra:true }, { id: 'ravc_dissolution_unit', header: 'Structured dissolution dose unit', label: 'Dose unit', section: 5, type: 'choice', options: ['IU', 'units', 'mg', 'mL', 'vials', 'Multiple agents: see treatment events', 'Other'], required: true, extra: true, condition: { field: 'ravc_dissolution_total', values: ['*'] } }, { id: 'ravc_complication_type', header: 'Complication type', label: 'Complication type', section: 2, type: 'choice', options: ['Vascular complication', 'Nodule', 'Inflammatory reaction', 'Other'], required: true, extra: true });
    if (kind === 'nodule') {
        base.find(f => f.id === 'nodule_CS')!.condition = { field: 'nodule_hyal', values: ['Yes'] };
        base.push({ id: 'nodule_hyal', header: 'Hyaluronidase used', label: 'Hyaluronidase used?', section: 5, type: 'choice', options: yesNo, required: true, extra: true }, { id: 'nodule_hyal_sessions', header: 'Hyaluronidase sessions', label: 'Hyaluronidase sessions', section: 5, type: 'number', min: 0, required: true, extra: true, condition: { field: 'nodule_hyal', values: ['Yes'] } }, { id: 'nodule_hyal_technique', header: 'Hyaluronidase technique', label: 'Hyaluronidase technique', section: 5, type: 'text', required: true, extra: true, condition: { field: 'nodule_hyal', values: ['Yes'] } });
    }
    if (kind === 'ravc') base.push({ id: 'ravc_sex', header: 'Sex at birth', label: 'Sex at birth', section: 0, type: 'choice', options: ['Female', 'Male', 'Intersex', 'Other'], required: false, extra: true });
    return configureFields(kind, base);
}
export const fieldById = (kind: RegistryKind, id: string) => fields(kind).find(f => f.id === id);

function configureFields(kind: RegistryKind, base: Field[]) {
 const find=(id:string)=>base.find(f=>f.id===kind+'_'+id)!;
 const add=(id:string,label:string,section:number,type:Field['type'],options?:string[],required=false)=>{base.push({id:kind+'_'+id,header:label,label,section,type,options,required,extra:true,min:type==='number'?0:undefined});return base.at(-1)!;};
 const options=(id:string,values:string[])=>{const f=find(id);f.options=[...new Set([...(f.options||[]),...values])];};
 const quantity=(id:string,units:string[],integer=false,range=false)=>Object.assign(find(id),{units,integer,range});
 if(kind==='ravc') {
  quantity('D',['years']);quantity('AE',['sessions'],true);quantity('AF',['sessions'],true);quantity('AG',['sessions'],true);
  find('AE').help='Sessions, cycles and treatment days are separate counts. Keep the original description in notes.';
  for(const [prefix,title] of [['dissolution','Filler dissolution'],['led','LED'],['hbot','HBOT']]) {
   add(prefix+'_status',title+' treatment status',5,'choice',['Performed','Not performed','Equipment unavailable','Ongoing','Other'],true);
   const days=add(prefix+'_days',title+' treatment days',5,'number');days.unit='days';days.integer=true;
   if(prefix==='hbot')add(prefix+'_hours','HBOT total hours',5,'number').unit='hours';
   else if(prefix==='dissolution')add(prefix+'_cycles','Filler dissolution total cycles',5,'number').integer=true;
   add(prefix+'_notes',title+' treatment notes',5,'long');
  }
  options('U',['Skin Tightness','Skin discoloration','Ecchymosis','Numbing sensation','Pustules']);
  options('V',['Purpura','Pustule','Discoloration','Telangiectasia','Erosion']);
  options('W',['Scalp','Periorbital area','Lip','Mandible']);options('AB',['Ultrasound-guided','Intervention']);
  Object.assign(find('AI'),{type:'long',options:undefined,required:false,label:'Original outcome / sequelae description'});
  add('response','Overall clinical response',6,'choice',['Resolved','Improved','Unchanged','Worsened','Other'],true);
  add('sequelae','Residual sequelae',6,'multi',['None','Pigmentation','Atrophic scar','Hypertrophic scar','Hair loss','Tissue loss','Functional impairment','Other'],true);
  add('followup_status','Follow-up status',6,'choice',['Ongoing','Completed','Lost to follow-up','Other'],true);
 } else {
  quantity('C',['years']);quantity('L',['days','weeks','months','years']);quantity('AC',['days','weeks','months','years']);
  quantity('O',['mL','threads','mg','vials','Other']);quantity('AK',['nodules'],true,true);quantity('AL',['cm']);quantity('AV',['lesions'],true,true);quantity('AX',['mm']);
  quantity('CN',['days','weeks','months','years']);quantity('CP',['sessions'],true);quantity('CS',['units','IU']);
  Object.assign(find('BF'),{type:'choice',options:['0 – Avascular','1 – Minimal','2 – Moderate','3 – Marked']});
  options('M',['HA (Hyaluronic Acid)','PN','PDO']); options('Q',['Medial cheek','Lateral cheek','Undereye','NLF','Marionette line']);options('R',['Medial cheek','Lateral cheek','Undereye','NLF','Marionette line']);
  options('S',['Subcutaneous layer','Intramuscular layer','Subdermal']);find('S').type='multi';
  options('AD',['Early (1–14 days)','Delayed (2 wk–1 yr)','Late (>1 yr)']);
  options('AF',['Asymptomatic','Pain / tenderness','Palpable nodule','Erythema']);options('AO',['None']);options('AP',['Partially fixed']);
  options('AR',['Product deposit','Foreign body granuloma','Hypersensitivity reaction']);options('AU',['B-mode (Greyscale)']);options('AZ',['Well-defined','Ill-defined']);
  Object.assign(find('BB'),{type:'long',options:undefined,required:false,label:'Original internal structure description'});
  add('homogeneity','Ultrasound homogeneity',3,'choice',['Homogeneous','Heterogeneous','Mixed','Other'],true);
  add('composition','Ultrasound solid / cystic composition',3,'choice',['Solid','Cystic','Mixed','Other'],true);
  options('BE',['Internal']);options('BH',['Thickened dermis']);options('BI',['No abnormal nodes']);options('BJ',['None']);
  Object.assign(find('BO'),{type:'multi'});options('BO',['Lymphocytic infiltrate','Plasmacytic infiltrate']);
  const pathology:Record<string,string[]>={BP:['None','Foreign body granuloma'],BQ:['Absent','Filler material (amorphous)'],BR:['None','Focal','Extensive'],BS:['None','Mild','Moderate','Severe'],BT:['None','Perivascular inflammation'],BU:['None','Present','Absent','Suspected']};
  for(const [id,values] of Object.entries(pathology))find(id).options=[...values,'Other'];
  options('CD',['No growth']);find('CF').options=['Not performed','Done – negative','Done – positive','Pending','Other'];
  find('CG').condition={field:'nodule_CF',values:['Done – positive']};
  options('CH',['Foreign body granuloma']);options('CJ',['Procedural intervention','Watchful waiting']);
  options('CM',['Not prescribed','Corticosteroid oral','ILKA']);options('CO',['Sterile water - mechanical disruption - U/S-guided','Intralesional steroid','Hyaluronidase - U/S-guided','Not done']);options('CT',['Standard dressings']);
  options('CV',['Minimal response (≤50% improvement)','Partial response (>50% improvement)','Complete resolution']);options('CW',['Excellent (no deformity)','Good (minimal deformity)']);
  // These investigations depend on their own performance status, not whether a biopsy was performed.
  find('CC').condition=undefined;find('CF').condition=undefined;find('CH').condition={field:'nodule_BK',values:['Yes']};find('CI').condition={field:'nodule_BK',values:['Yes']};
  options('CZ',['Yes – specify below']);find('DA').condition={field:'nodule_CZ',values:['Yes','Yes – specify below']};find('DB').condition=find('DA').condition;
  find('W').help='Prior or coexisting products can be recorded even when no prior filler is confirmed.';find('W').condition=undefined;
  find('hyal').required=true;
 }

 const condition=(id:string,parent:string,values:string[])=>{find(id).condition={field:kind+'_'+parent,values};};
 const gate=(id:string,label:string,section:number)=>add(id,label,section,'choice',['Performed','Not performed'],true);
 const numeric=(id:string,label:string,section:number,unit:string,integer=false)=>Object.assign(add(id,label,section,'number',undefined,true),{unit,integer});
 if(kind==='ravc'){
  for(const [prefix,count] of [['dissolution','AE'],['led','AF'],['hbot','AG']]){
   const enabled=['Performed','Ongoing'];
   for(const id of [count,prefix+'_days',prefix+'_notes',...(prefix==='hbot'?[prefix+'_hours']:prefix==='dissolution'?[prefix+'_cycles','AC','AB','AD','dissolution_total']:[])])condition(id,prefix+'_status',enabled);
  }
  find('dissolution_total').required=true;
  find('AF').label='Total LED sessions';find('AG').label='Total HBOT sessions';
  find('AE').label='Total filler dissolution sessions';
  find('M').label='Original injection description';find('M').required=false;
  add('injection_site','Injection site',1,'multi',regions,true);
  add('injection_technique','Injection technique',1,'multi',['Needle','Cannula','Bolus','Linear threading','Fanning','Other'],true);
  add('injection_plane','Injection plane',1,'multi',['Intradermal','Subdermal','Subcutaneous','Supraperiosteal','Intramuscular','Other'],true);
  Object.assign(numeric('injection_amount','Injected product amount',1,'mL'),{units:['mL','mg','threads','Other'],unit:undefined});
  gate('medical_status','Medical treatment status',5);condition('AH','medical_status',['Performed']);find('AH').required=false;find('AH').label='Original medication description';
 }else{
  find('AW').label='Original ultrasound dimensions description';find('AW').required=false;
  numeric('us_length','Ultrasound lesion length',3,'cm');numeric('us_width','Ultrasound lesion width',3,'cm');
  find('CY').label='Original time-to-resolution description';find('CY').required=false;
  Object.assign(numeric('resolution_duration','Time to resolution',6,'days'),{units:['days','weeks','months','years'],unit:undefined});condition('resolution_duration','CV',['Resolved','Complete resolution']);
  gate('medical_status','Medical treatment status',5);for(const id of ['CL','CM','CN'])condition(id,'medical_status',['Performed']);find('CL').required=false;find('CL').label='Original medication description';
  gate('procedure_status','Procedural treatment status',5);for(const id of ['CO','CP','CQ','CR'])condition(id,'procedure_status',['Performed']);
  condition('hyal_sessions','hyal',['Yes']);condition('hyal_technique','hyal',['Yes']);
  condition('CE','CD',['Positive']);
  gate('stains_status','Special stains performed?',4);condition('stains_status','BK',['Yes']);
  add('stains_selected','Select stains performed',4,'multi',['PAS','Ziehl-Neelsen (AFB)','Gram','GMS','Fite','Alcian blue','Other'],true);condition('stains_selected','stains_status',['Performed']);
  for(const [id,name] of [['BV','PAS'],['BW','Ziehl-Neelsen (AFB)'],['BX','Gram'],['BY','GMS'],['BZ','Fite'],['CA','Alcian blue'],['CB','Other']])condition(id,'stains_selected',[name]);
  gate('complications_status','Treatment complications present?',6);condition('DC','complications_status',['Performed']);condition('DD','complications_status',['Performed']);find('complications_status').options=['Yes','No'];find('DC').condition!.values=['Yes'];find('DD').condition!.values=['Yes'];
  gate('imaging_status','Additional imaging performed?',7);for(const id of ['DG','DH'])condition(id,'imaging_status',['Performed']);
  gate('labs_status','Laboratory investigations performed?',7);for(const id of ['DI','DJ'])condition(id,'labs_status',['Performed']);
  for(const id of ['T','CR']){find(id).required=false;find(id).label='Original '+(id==='T'?'injection':'ultrasound-guided')+' needle description';}
 }
 // Device dimensions are distinct from free-text device descriptions.
 for(const [id,title,section] of (kind==='ravc'?[['injection','Injection device',1]]:[['injection','Injection device',1],['procedure','Procedure device',5]]) as [string,string,number][]){
  add(id+'_device',title+' type',section,'choice',['Needle','Cannula','Other'],false);
  numeric(id+'_gauge',title+' gauge',section,'G');find(id+'_gauge').required=false;find(id+'_gauge').integer=true;
  numeric(id+'_length',title+' length',section,'mm');find(id+'_length').required=false;
  if(id==='procedure')for(const suffix of ['device','gauge','length'])condition(id+'_'+suffix,'procedure_status',['Performed']);
 }

 for(const f of base) {
  if(f.type==='number'&&!f.units&&f.unit===undefined) f.help ||= 'Enter a numerical value. Use an explicit information status when unavailable.';
  if(f.id!=='nodule_BF'&&f.type==='choice'&&f.options&&!f.options.includes('Other')&&!['Yes','No'].every(v=>f.options!.includes(v)))f.options.push('Other');
 }
 return base;
}
