import {SOURCES} from '../../../lib/clinical/catalog';
import {emptyIA,iaTotals,iaErrors,iaSchema} from '../../../lib/clinical/intraarterial';
import type {CaseRecord} from '../../../lib/clinical/model';
import type {GoogleClient} from './google';
export const iaSummaryHeaders=['IA treatment status','IA sessions (treatment days)','IA hyaluronidase total (IU)','IA dose completeness'];
export function iaSummary(r:CaseRecord){const ia=r.intraarterial||emptyIA(r.historical),t=iaTotals(ia);return [ia.status,t.sessions??'',t.units??'',ia.status==='performed'?(t.incomplete?'Incomplete':'Complete'):'Not applicable'];}
export const iaTabs=[{title:'Registry IA Days',headers:['Case ID','Treatment day ID','Treatment date','Ultrasound guidance','Day notes','Documented dose (IU)','Dose completeness','Revision','Active']},{title:'Registry IA Injections',headers:['Case ID','Injection ID','Treatment day ID','Injected artery','Other artery','Hyaluronidase (IU)','Dose status','Revision','Active']}];
/** Atomic, idempotent keyed projection. Never deletes rows or touches the response tab. */
export async function syncIATabs(google:GoogleClient,r:CaseRecord){
 if(r.kind!=='ravc'||!r.intraarterial)return;
 iaSchema.parse(r.intraarterial);const errors=iaErrors(r.intraarterial,false,r.historical);if(errors.length)throw Error(errors[0]);
 const spreadsheet=SOURCES.ravc.sheetId,meta=await google.request(`sheets/v4/spreadsheets/${spreadsheet}?fields=sheets(properties)`);
 const missing=iaTabs.filter(t=>!meta.sheets.some((s:any)=>s.properties.title===t.title));
 if(!r.intraarterial.days.length&&missing.length===iaTabs.length)return;
 if(missing.length)await google.request(`sheets/v4/spreadsheets/${spreadsheet}:batchUpdate`,'POST',{requests:missing.map(t=>({addSheet:{properties:{title:t.title,gridProperties:{rowCount:1000,columnCount:9,frozenRowCount:1}}}}))});
 const fresh=missing.length?await google.request(`sheets/v4/spreadsheets/${spreadsheet}?fields=sheets(properties)`):meta,requests:any[]=[];
 const cells=(values:(string|number|boolean)[])=>({values:values.map(v=>({userEnteredValue:typeof v==='number'?{numberValue:v}:typeof v==='boolean'?{boolValue:v}:{stringValue:v}}))});
 for(const tab of iaTabs){const sheet=fresh.sheets.find((s:any)=>s.properties.title===tab.title);if(!sheet)throw Error('IA sheet setup did not complete. Retry synchronization.');const id=sheet.properties.sheetId;const existing:unknown[][]=missing.includes(tab)?[]:await google.values(spreadsheet,`'${tab.title}'!A1:I`);
  if(existing.length&&tab.headers.some((h,i)=>existing[0][i]!==h))throw Error('IA tab headers have changed. Review them before synchronization.');
  if(!existing.length)requests.push({updateCells:{start:{sheetId:id,rowIndex:0,columnIndex:0},rows:[cells(tab.headers)],fields:'userEnteredValue'}});
  const desired:(string|number|boolean)[][]=tab.title==='Registry IA Days'?r.intraarterial.days.map(d=>{const t=iaTotals({status:'performed',days:[d]});return [r.id,d.id,d.date,d.guidance,d.notes,t.knownUnits,t.incomplete?'Incomplete':'Complete',r.revision,true];}):r.intraarterial.days.flatMap(d=>d.injections.map(i=>[r.id,i.id,d.id,i.artery,i.otherArtery||'',i.doseStatus==='recorded'&&i.dose?Number(i.dose):'',i.doseStatus,r.revision,true]));
  const rows=existing.slice(1),newRows=[];for(const row of desired){const matches=rows.flatMap((old,i)=>old[0]===r.id&&old[1]===row[1]?[i+1]:[]);if(matches.length>1)throw Error('Duplicate IA log ID in sheet. Review before retrying.');if(matches.length)requests.push({updateCells:{start:{sheetId:id,rowIndex:matches[0],columnIndex:0},rows:[cells(row)],fields:'userEnteredValue'}});else newRows.push(cells(row));}
  rows.forEach((row,i)=>{if(row[0]===r.id&&!desired.some(d=>d[1]===row[1]))requests.push({updateCells:{start:{sheetId:id,rowIndex:i+1,columnIndex:7},rows:[cells([r.revision,false])],fields:'userEnteredValue'}});});
  if(newRows.length)requests.push({appendCells:{sheetId:id,rows:newRows,fields:'userEnteredValue'}});
 }
 if(requests.length)await google.request(`sheets/v4/spreadsheets/${spreadsheet}:batchUpdate`,'POST',{requests});
}
