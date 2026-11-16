import type {Field} from '../../lib/clinical/catalog';
import {answerText,type CaseRecord} from '../../lib/clinical/model';
import {reviewIssues} from '../../lib/clinical/review';
export default function SavedAnswer({record,field,extraChoices={}}:{record:CaseRecord;field:Field;extraChoices?:Record<string,string[]>}){
 const issue=reviewIssues(record,extraChoices).find(i=>i.field===field.id),original=record.sourceRaw?.[field.header];
 return <><span>{answerText(record.answers[field.id])}</span>{issue&&<div className="clinical-original-panel"><strong>● Needs review</strong><p>{issue.message}</p><strong>Original content</strong><pre>{original??answerText(record.answers[field.id])}</pre></div>}{!issue&&original!==undefined&&record.answers[field.id]?.corrected&&<details className="clinical-original-panel"><summary>Corrected · view original content</summary><pre>{original}</pre></details>}</>;
}
