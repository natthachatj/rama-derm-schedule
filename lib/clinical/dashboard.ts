import { distribution, factorValues, sequelaeOutcome, type Episode, type Factor } from './research';
import { registryValues } from './usability';
export const dashboardLabels = {month:'Cases by month',age:'Age distribution',sex:'Sex',complication:'Complication type',area:'Affected area',material:'Material type',technique:'Dissolution technique',agent:'Dissolution agent',sessions:'Dissolution sessions',treatment:'Treatment',outcome:'Clinical outcome',healing:'Recorded wound healing status',sequelae:'Sequelae at three months',recurrence:'Recurrence at latest assessment'};
export type DashboardFactor = keyof typeof dashboardLabels;
export const defaultCharts:DashboardFactor[]=['month','age','sex','complication','area','material'];
export function dashboardChart(items:Episode[],factor:DashboardFactor) {
 if(['month','age','sex','complication','area','material','treatment','outcome'].includes(factor)){const d=distribution(items,factor as Factor);if(factor==='age')d.rows.sort((a,b)=>(a.label==='<20'?0:parseInt(a.label))-(b.label==='<20'?0:parseInt(b.label)));return {...d,multi:['area','material','complication','outcome','treatment'].includes(factor)};}
 let missing=0,conflicting=0;const counts=new Map<string,number>();
 for(const e of items){const values=dashboardValues(e,factor);if(!values.length){missing++;continue;}if(['healing','sequelae','recurrence','sessions'].includes(factor)&&values.length!==1){missing++;conflicting++;continue;}for(const v of values)counts.set(v,(counts.get(v)||0)+1);}
 return {known:items.length-missing,missing,conflicting,rows:[...counts].map(([label,count])=>({label,count})).sort((a,b)=>b.count-a.count||a.label.localeCompare(b.label)),multi:['technique','agent'].includes(factor)};
}
export function dashboardValues(e:Episode,factor:DashboardFactor):string[]{
 if(['month','age','sex','complication','area','material','treatment','outcome'].includes(factor)){const d=distribution([e],factor as Factor);return d.rows.map(r=>r.label);}
 if(factor==='sequelae'){const s=sequelaeOutcome(e,'any');return s.value===null?[]:[s.value?'With sequelae':'No sequelae'];}
 return [...new Set(e.members.flatMap(r=>{
 if(factor==='technique'||factor==='agent')return (registryValues(r)[factor]||[]).filter(v=>!['Not recorded','Unknown','Not assessed','Not applicable'].includes(v));
 if(factor==='sessions'){const a=r.answers[r.kind==='ravc'?'ravc_AE':'nodule_hyal_sessions'];return a?.state==='recorded' && typeof a.value==='string' && a.value.trim() && Number.isFinite(Number(a.value))&&Number(a.value)>=0?[String(Number(a.value))]:[];}
 if(factor==='healing')return r.kind==='ravc'&&r.outcomes?.wound==='yes'&&['healed','healing'].includes(r.outcomes.healing.status)?[r.outcomes.healing.status==='healed'?'Healed':'Healing']:[];
 if(factor==='recurrence'){const f=r.outcomes?.followups.slice().sort((a,b)=>b.date.localeCompare(a.date))[0];return f&&f.recurrence!=='not_assessed'?[f.recurrence==='yes'?'Recurrence':'No recurrence']:[];}
 return [];
 }))];
}
const palette=['#0f8274','#3867bd','#9159b8','#c27421','#2190b4','#c45978','#587b35'];
export function chartColor(factor:DashboardFactor,label:string){if(/unknown|missing|not assessed|not recorded/i.test(label))return '#8b96a6';const materials:Record<string,string>={HA:'#287bb7',CaHA:'#e09a2b',PLLA:'#8656b8',PCL:'#078c80',PMMA:'#b45c84',Silicone:'#5c7895'};if(factor==='material'&&materials[label])return materials[label];let hash=0;for(const c of factor+':'+label)hash=(hash*31+c.charCodeAt(0))|0;return palette[(hash>>>0)%palette.length];}
