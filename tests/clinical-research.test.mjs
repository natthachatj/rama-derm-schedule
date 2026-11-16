import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { execFileSync } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
const dir = await mkdtemp(new URL('../.research-test-', import.meta.url));
await build({entryPoints:['lib/clinical/research.ts','lib/clinical/outcomes.ts','lib/clinical/model.ts','lib/clinical/research-export.ts','lib/clinical/service.ts','netlify/server/clinical/research.ts'],outdir:dir,outbase:'.',bundle:true,platform:'node',target:'node22',format:'esm',packages:'external'});
const load = path => import(pathToFileURL(`${dir}/${path}.js`));
const { analyze, defaultResearchConfig, episodes, comparisons, sequelaeOutcome, kaplanMeier, healingData, healingGroups, numericSummary, fisher, wilson, logistic } = await load('lib/clinical/research');
const { newRecord, defaultSettings, validateForm } = await load('lib/clinical/model');
const { emptyOutcomes, outcomesSchema } = await load('lib/clinical/outcomes');
const { researchExport, researchReport } = await load('lib/clinical/research-export');
const { createClinicalService } = await load('lib/clinical/service');
const { parseFolderLink, validateCaseFolder, saveResearchSnapshot, listResearchSnapshots } = await load('netlify/server/clinical/research');
const originalOwnerEmail = process.env.CLINICAL_OWNER_EMAIL; process.env.CLINICAL_OWNER_EMAIL = 'owner@example.test';
const parent='1fUqfMTRLxfcl_mSKeiLozlNDG1QYWo5P';
const config = patch => ({...defaultResearchConfig(), ...patch});
const answer = value => ({state:'recorded',value});
const date = n => new Date(Date.UTC(2026,0,1+n)).toISOString().slice(0,10);
function record(kind='ravc') { const r=newRecord(kind,'owner','f1',2026);r.status='submitted';r.answers[kind==='ravc'?'ravc_Q':'nodule_K']=answer('2026-01-01');return r; }
function follow(day, seq=['None']) { return { id:crypto.randomUUID(), date:date(day), healing:'not_assessed',assessment:'assessed',sequelae:seq,recurrence:'not_assessed',notes:'' }; }
function endpoint(seq=['None'],day=90) { const r=record();r.outcomes={...emptyOutcomes(),firstTreatment:date(0),followups:[follow(day,seq)]};return r; }
const ep = r => ({id:r.id,members:[r],date:'2026-01-01'});
after(async()=>{ if(originalOwnerEmail===undefined) delete process.env.CLINICAL_OWNER_EMAIL; else process.env.CLINICAL_OWNER_EMAIL=originalOwnerEmail; await rm(dir,{recursive:true,force:true}); });
test('episode graph deduplicates transitive links deterministically, excludes drafts, applies inclusive dates and category filters',()=>{
 const a=record(),b=record('nodule'),c=record();a.linkedCaseIds=[b.id];b.linkedCaseIds=[c.id];c.answers.ravc_Q=answer('2025-12-31');a.answers.ravc_K=answer('HA');b.answers.nodule_M=answer('Cross-linked HA filler');const draft=record();draft.status='draft';const missing=record();missing.answers={};
 assert.equal(episodes([a,b,c,draft,missing],config({})).selected.length,2);
 assert.equal(episodes([a,b,c,missing],config({from:'2026-01-01',to:'2026-12-31'})).selected.length,0);
 const data=analyze([a,b,missing],config({from:'2026-01-01',to:'2026-01-01',selection:{factor:'material',value:'HA'}}));assert.equal(data.n,1);assert.equal(data.linked,1);assert.equal(data.unknownDates,1);assert.equal(data.distributions.find(d=>d.factor==='material').rows[0].count,1);
});
test('demographic summaries keep missing states separate, reject conflicting linked ages and do not interpret blank as zero',()=>{
 const a=record(),b=record(),c=record(),d=record();a.answers.ravc_D=answer('');b.answers.ravc_D={state:'not_applicable',value:''};c.answers.ravc_D={state:'unknown',value:''};d.answers.ravc_D=answer('40');const r=analyze([a,b,c,d],config({})),age=r.distributions.find(x=>x.factor==='age');assert.equal(age.known,1);assert.equal(age.numeric.median,40);assert.equal(age.missingStates['not applicable'],1);assert.equal(age.missingStates.unknown,1);
 const e=record();e.answers.ravc_D=answer('50');d.linkedCaseIds=[e.id];assert.equal(analyze([d,e],config({})).distributions.find(x=>x.factor==='age').conflicting,1);
});
test('primary endpoint selects closest assessed day 90, ties earlier, includes 60 and 120 and never treats unassessed as absent',()=>{
 const r=endpoint(['Scarring'],100);r.outcomes.followups.push(follow(80,['None']),follow(90,['None']));r.outcomes.followups[2].assessment='not_assessed';r.outcomes.followups[2].sequelae=[];
 assert.equal(sequelaeOutcome(ep(r),'any').value,0);assert.equal(sequelaeOutcome(ep(r),'any').day,80);
 for(const day of [60,120])assert.equal(sequelaeOutcome(ep(endpoint(['Scarring'],day)),'Scarring').value,1);
 for(const day of [59,121])assert.equal(sequelaeOutcome(ep(endpoint(['Scarring'],day)),'Scarring').value,null);
 const other=endpoint(['Scarring']);assert.equal(sequelaeOutcome({id:r.id,members:[r,other],date:date(0)},'any').value,null);
});
test('structured outcomes reject impossible dates, contradictory sequelae and wound states while legacy records remain valid',()=>{
 assert.equal(validateForm({kind:'ravc',answers:{},events:[]}).errors.length,0);
 const o=emptyOutcomes();o.firstTreatment='2026-02-30';assert.equal(outcomesSchema.safeParse(o).success,false);
 const r=endpoint(['None','Scarring']);assert.equal(outcomesSchema.safeParse(r.outcomes).success,false);
 const x=emptyOutcomes();x.healing.status='healed';assert.equal(outcomesSchema.safeParse(x).success,false);
 const y=emptyOutcomes();y.wound='yes';y.firstTreatment=date(10);y.healing={status:'healed',precision:'interval',date:'',from:date(9),to:date(20)};assert.equal(outcomesSchema.safeParse(y).success,false);
});
test('healing includes exact events and last confirmed unhealed censoring, excludes interval dates and non-wounds',()=>{
 const a=record();a.outcomes={...emptyOutcomes(),wound:'yes',firstTreatment:date(0),healing:{status:'healed',precision:'exact',date:date(10),from:'',to:''}};
 const b=record();b.outcomes={...emptyOutcomes(),wound:'yes',firstTreatment:date(0),healing:{...emptyOutcomes().healing,status:'healing'},followups:[{...follow(20),healing:'not_healed'}]};
 const c=structuredClone(a);c.id=crypto.randomUUID();c.outcomes.healing={status:'healed',precision:'interval',date:'',from:date(5),to:date(15)};
 const d=record();d.outcomes=emptyOutcomes();const data=healingData([a,b,c,d].map(ep));assert.equal(data.included.length,2);assert.equal(data.excluded.length,2);assert.deepEqual(data.included.map(x=>[x.time,x.event]),[[10,true],[20,false]]);
});
test('Kaplan-Meier handles ties, censoring and median not reached with valid confidence bounds',()=>{
 const km=kaplanMeier([{id:'a',time:5,event:true},{id:'b',time:5,event:false},{id:'c',time:10,event:true}]);assert.equal(km.curve[0].atRisk,3);assert.ok(Math.abs(km.curve[0].proportionHealed-1/3)<1e-12);assert.equal(km.median,10);assert.equal(km.curve[1].proportionHealed,1);assert.ok(km.curve.every(p=>p.low<=p.proportionHealed && p.high>=p.proportionHealed));
 assert.equal(kaplanMeier([{id:'x',time:30,event:false}]).median,null);assert.equal(kaplanMeier([]).n,0);
});
test('numerical summaries, Wilson intervals and Fisher exact match reference fixtures',()=>{
 const s=numericSummary([1,2,3,4]);assert.equal(s.mean,2.5);assert.equal(s.median,2.5);assert.equal(s.q1,1.75);assert.ok(Math.abs(s.sd-1.2909944487358056)<1e-12);
 assert.ok(Math.abs(fisher(1,9,11,3)-.0027594561852200836)<1e-10);const ci=wilson(5,10);assert.ok(Math.abs(ci[0]-.236593090512564)<1e-10);assert.equal(wilson(0,0),null);
});
test('group comparisons use group denominators, flag mixed groups and return risk difference without causal claims',()=>{
 const cases=[];for(let i=0;i<20;i++){const r=endpoint(i<5?['Scarring']:['None']);r.answers.ravc_sex=answer(i<10?'Female':'Male');cases.push(r)}const c=comparisons(cases.map(ep),config({group:'sex'}));assert.equal(c.rows[0].n,10);assert.equal(c.rows[0].yes,5);assert.equal(c.rows[1].yes,0);assert.equal(c.test.difference,.5);assert.ok(c.test.differenceCI[0]>0);
});
test('adjusted model recovers known aggregate odds ratio and withholds sparse or separated estimates',()=>{
 const cases=[];for(let age of [30,40])for(let i=0;i<100;i++){const r=endpoint(i<(age===30?20:40)?['Scarring']:['None']);r.answers.ravc_D=answer(String(age));cases.push(ep(r));}
 const m=logistic(cases,config({mode:'factors',adjust:['age']}));assert.equal(m.error,'');assert.ok(Math.abs(m.rows[0].oddsRatio-Math.pow((.4/.6)/(.2/.8),.1))<1e-6);
 assert.match(logistic(cases.slice(0,20),config({adjust:['age']})).error,/Not enough/);
 const sep=cases.map((e,i)=>{const r=structuredClone(e.members[0]);r.outcomes.followups[0].sequelae=i<100?['None']:['Scarring'];return ep(r)});assert.match(logistic(sep,config({adjust:['age']})).error,/unstable|withheld/);
});
test('owner summaries do not leak to fellows, and manual folder linking enforces role, revision and audit',async()=>{
 let r=endpoint(),validated=0;const stored=[];r.answers.ravc_B=answer('PRIVATE-HN');const repo={list:async()=>[r],all:async()=>[r],get:async()=>r,settings:async()=>defaultSettings,put:async x=>{stored.push(x);r=x}};
 const make=owner=>createClinicalService({actor:async()=>({principal:'x',owner,memberships:[{year:2026,id:'f1'}]}),repository:repo,lock:async fn=>fn(),process:async r=>r});
 const fellow=await make(false).list();assert.equal(fellow[0].summary,undefined);assert.equal(fellow[0].answers,undefined);assert.ok((await make(true).list())[0].summary);
 await assert.rejects(make(false).folder(r.id,r.revision,'folder123456',async()=>validated++),/owner/);assert.equal(validated,0);
 const linked=await make(true).folder(r.id,r.revision,'folder123456',async()=>validated++);assert.equal(linked.folderId,'folder123456');assert.equal(validated,1);assert.equal(stored.length,1);
});
test('Drive links reject files, non-Google origins, shared folders, destination root and unrelated ancestry',async()=>{
 assert.equal(parseFolderLink('https://drive.google.com/drive/folders/case_folder_123?usp=sharing'),'case_folder_123');for(const v of ['https://evil.test/drive/folders/case_folder_123','https://drive.google.com/file/d/case_folder_123/view'])assert.throws(()=>parseFolderLink(v));
 const permissions=[{type:'user',role:'owner',emailAddress:'owner@example.test'}];const google={request:async()=>({mimeType:'application/vnd.google-apps.folder',parents:[parent],permissions})};await validateCaseFolder(google,'case_folder_123','case1');await assert.rejects(validateCaseFolder(google,parent,'case1'),/individual/);
 await assert.rejects(validateCaseFolder({request:async()=>({mimeType:'application/vnd.google-apps.folder',parents:[parent],permissions:[{type:'anyone'}]})},'case_folder_123','case1'),/private/);
 await assert.rejects(validateCaseFolder({request:async()=>({mimeType:'application/vnd.google-apps.folder',parents:[],permissions})},'case_folder_123','case1'),/inside/);
});
test('saved research snapshots are immutable, retry idempotently and never create Drive folders',async()=>{
 let tab=false,rows=[],writes=0;const google={request:async(path,method)=>{assert.ok(path.startsWith('sheets/'));if(method==='POST'){tab=true;return {}}return {sheets:tab?[{properties:{title:'Registry Research'}}]:[]}},values:async()=>rows,append:async(_id,_range,newRows)=>{writes++;rows.push(...newRows)}};
 assert.deepEqual(await listResearchSnapshots(google),[]);const r=endpoint(),input={id:crypto.randomUUID(),name:'Study',config:config({})};const s=await saveResearchSnapshot(google,[r],input,'owner');assert.equal(s.result.sources[0].revision,r.revision);r.revision++;r.answers.ravc_K=answer('HA');const same=await saveResearchSnapshot(google,[r],input,'owner');assert.deepEqual(same,s);assert.equal(writes,1);assert.equal((await listResearchSnapshots(google)).length,1);
});
test('research exports contain only anonymous aggregates, preserve editable PPTX objects and produce PDF/CSV',async()=>{
 const r=endpoint(['Scarring']);r.answers.ravc_K=answer('PRIVATE-NAME HN123 http://private.example');r.answers.ravc_L=answer('PRIVATE-BRAND');const result=analyze([r],config({mode:'describe',variable:'material'})), report=researchReport(result);assert.ok(!JSON.stringify(report).includes('PRIVATE'));assert.ok(!JSON.stringify(report).includes(r.id));
 const csv=await researchExport(result,'csv',defaultSettings);assert.ok(!new TextDecoder().decode(csv).includes('PRIVATE'));const pdf=await researchExport(result,'pdf',defaultSettings);assert.equal(Buffer.from(pdf).subarray(0,4).toString(),'%PDF');const pptx=await researchExport(result,'pptx',defaultSettings);assert.equal(Buffer.from(pptx).subarray(0,2).toString(),'PK');
});

test('healing group log-rank matches a hand-calculated two-patient fixture',()=>{
 const make=(time,sex)=>{const r=record();r.answers.ravc_sex=answer(sex);r.outcomes={...emptyOutcomes(),wound:'yes',firstTreatment:date(0),healing:{status:'healed',precision:'exact',date:date(time),from:'',to:''}};return ep(r)};
 const r=healingGroups([make(1,'Female'),make(2,'Male')],'sex');assert.equal(r.groups.length,2);assert.ok(Math.abs(r.logRank.chiSquare-1)<1e-12);assert.ok(Math.abs(r.logRank.p-.31731050786291415)<2e-7);
});
test('PPTX contains editable charts and tables rather than rasterized result slides',async()=>{
 const r=endpoint();r.answers.ravc_K=answer('HA');const bytes=await researchExport(analyze([r],config({mode:'describe',variable:'material'})),'pptx',defaultSettings),path=dir+'/editable.pptx';await writeFile(path,bytes);
 const info=JSON.parse(execFileSync('python3',['-c',"import zipfile,json,sys; z=zipfile.ZipFile(sys.argv[1]); names=z.namelist(); print(json.dumps({'charts':sum(n.startswith('ppt/charts/chart') and n.endswith('.xml') for n in names),'tables':sum(b'<a:tbl>' in z.read(n) for n in names if n.startswith('ppt/slides/slide') and n.endswith('.xml')),'embeddings':sum(n.startswith('ppt/embeddings/') for n in names)}))",path],{encoding:'utf8'}));assert.ok(info.charts>0);assert.ok(info.tables>0);assert.ok(info.embeddings>0);
});
