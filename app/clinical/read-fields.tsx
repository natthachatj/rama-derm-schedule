import {orderedFields,treatmentGroups} from '../../lib/clinical/conditional';
import {visible,type CaseRecord} from '../../lib/clinical/model';
import type {Field} from '../../lib/clinical/catalog';
import SavedAnswer from './saved-answer';
export default function ReadFields({record,section,extraChoices}:{record:CaseRecord;section:number;extraChoices:Record<string,string[]>}){
 const all=orderedFields(record.kind),row=(f:Field)=><div key={f.id}><dt>{f.label}</dt><dd><SavedAnswer record={record} field={f} extraChoices={extraChoices}/></dd></div>;
 const grouped=new Set(record.kind==='ravc'&&section===5?treatmentGroups.flatMap(g=>[g.status,...g.ids]):[]);
 return <>{record.kind==='ravc'&&section===5&&treatmentGroups.map(g=>{const a=record.answers[g.status],closed=a?.state==='none'||a?.state==='not_applicable'||a?.state==='recorded'&&['Not performed','Equipment unavailable'].includes(String(a.value)),status=all.find(f=>f.id===g.status)!,children=g.ids.map(id=>all.find(f=>f.id===id)!).filter(Boolean);return <section className="clinical-treatment-group" key={g.status}><h4>{g.title}</h4><dl>{row(status)}</dl>{closed?<details><summary>Remaining fields: Not applicable · View saved details</summary><dl>{children.map(row)}</dl></details>:<dl>{children.map(row)}</dl>}</section>;})}<dl>{all.filter(f=>!f.system&&f.section===section&&!grouped.has(f.id)&&(visible(f,record.answers)||record.sourceRaw?.[f.header])).map(row)}</dl></>;
}
