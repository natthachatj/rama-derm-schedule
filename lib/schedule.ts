import type {Presentation,PresentationTargets} from './presentations';
import type {Activity,ActivityTemplate,ActivityStaff} from './activities';
export type Fellow={id:string;first:string;last:string;nick:string;email:string;color:string;phone?:string;notes?:string;displayName?:string;staffId?:string};
export type Slot={id:string;day:number;session:string;clinic:string;track:number};
export type Rotation={start:string;end:string};
export type Assignment={fellow:string;extra?:boolean};
export type Plan={rotations:Rotation[];slots:Slot[];overrides:Record<string,Assignment>;holidays:string[];reviewed:boolean};
export type Year={year:number;fellows:Fellow[];draft:Plan;published:Plan|null;publishedAt:string|null;dirty:boolean};
export type Leave={id:string;year:number;requester:string;reason:string;items:{date:string;slot:string;replacement:string;before?:{published:Assignment|null;draft:Assignment|null;effective:Assignment;draftEffective?:Assignment|null}}[];status:string;created:string;decided?:string;cancelledAt?:string};
export type Notice={id:string;fellow:string;year:number;text:string;read:boolean;created:string};
export type Workspace={presentations?:Presentation[];presentationTargets?:PresentationTargets[];activities?:Activity[];activityTemplates?:ActivityTemplate[];activityStaff?:ActivityStaff[];years:Year[];leaves:Leave[];notices:Notice[];audit:{at:string;action:string}[]};
export const colors=['#3766d8','#159f9b','#9255c9','#db8d38','#d05e83'];
export function iso(d:Date){return d.toISOString().slice(0,10)}
export function add(date:string,n:number){const d=new Date(date+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return iso(d)}
export function weekday(date:string){return new Date(date+'T12:00:00Z').getUTCDay()}
export function dates(start:string,end:string){const a=[];for(let d=start;d<=end;d=add(d,1))a.push(d);return a}
export function rotations(year:number,count=10):Rotation[]{
 let start=`${year}-07-01`;if(weekday(start)===6)start=add(start,2);if(weekday(start)===0)start=add(start,1);
 const end=`${year+1}-06-30`,terminal=add(end,1),total=dates(start,end).length,target=total/count;
 const candidates=[start,...dates(add(start,1),end).filter(d=>weekday(d)===1),terminal];
 let layer=new Map<number,{cost:number;path:number[]}>([[0,{cost:0,path:[0]}]]);
 for(let block=1;block<=count;block++){
  const next=new Map<number,{cost:number;path:number[]}>();
  for(const [prev,state] of layer)for(let j=prev+1;j<candidates.length;j++){
   if((block===count)!==(j===candidates.length-1))continue;
   const len=Math.round((new Date(candidates[j]+'T12:00Z').getTime()-new Date(candidates[prev]+'T12:00Z').getTime())/86400000);
   if(len<28||len>42)continue;
   const cost=state.cost+(len-target)**2;
   if(!next.has(j)||cost<next.get(j)!.cost)next.set(j,{cost,path:[...state.path,j]});
  }layer=next;
 }
 const path=layer.get(candidates.length-1)?.path;if(!path)throw Error('Unable to balance rotations within 4–6 weeks.');
 return path.slice(0,-1).map((index,i)=>({start:candidates[index],end:add(candidates[path[i+1]],-1)}));
}
export function makeSlots(n:number):Slot[]{const am=[['Mohs Surgery','OPD Mohs','OPD Laser','OPD Laser · consult','Mohs Surgery'],['Vascular Laser','Cosmetic / OPD','OPD Laser','OPD Laser · consult','OR · Floor 2'],['Nail · Floor 4','MKTP / Filler complication','OPD Laser','OPD Laser · consult','OR · Floor 2'],['General OPD','Procedural / Filler OPD','OPD Laser','OPD Laser · consult','Mohs Surgery'],['OPD Laser / Visiting fellow','Research / Teaching','OPD Laser','OPD Laser · consult','OR · Floor 2']];const pm=[['Mohs Surgery','Mohs / Workshop','Pigment Laser','Pigment Laser','Mohs Surgery'],['CO₂ Laser','Cosmetic Clinic','Nail / Sclero','Nail / Sclero','CO₂ Laser'],['Sclero · Floor 2','Research','Sclero · Floor 2','Research','Research']];const slots:Slot[]=[];for(let day=1;day<=5;day++){for(let t=0;t<n;t++){slots.push({id:`${day}-AM-${t}`,day,session:'AM',clinic:am[day-1][t===n-1?4:t],track:t});slots.push({id:`${day}-PM-${t}`,day,session:'PM',clinic:day<=3?pm[day-1][t===n-1?4:t]:day===4?'Research / GR & CPC':'Research',track:t})}}for(let day=0;day<7;day++)slots.push({id:`${day}-RAVC`,day,session:'RAVC',clinic:'RAVC on-call · 07:00–21:00',track:1});return slots}
export function makeYear(year:number,n=5,initialCohort=false):Year{const names=[['กีรติยา','กาญจนอุทัยศิริ','ลูกกวาด'],['ลิซ','ศรีสุวรรณ','ลิซ'],['ศุภโชค','คงเทียน','แน๊ม'],['สรวีย์','ฉลองกุลวัฒน์','อุ๊จัง'],['วรนิษฐา','ธารมณีวงศ์','เบลล์']];return {year,fellows:names.slice(0,n).map((a,i)=>({id:`f${i+1}`,first:initialCohort?a[0]:'',last:initialCohort?a[1]:'',nick:initialCohort?a[2]:'',email:'',color:colors[i]})),draft:{rotations:rotations(year,n===3?9:n===4?12:10),slots:makeSlots(n),overrides:{},holidays:[],reviewed:n===5},published:null,publishedAt:null,dirty:true}}
export function seed():Workspace{return {years:[makeYear(2026,5,true)],leaves:[],notices:[],audit:[]}}
export function assignment(y:Year,p:Plan,date:string,slot:Slot):Assignment|null{if(date<`${y.year}-07-01`||date>`${y.year+1}-06-30`||weekday(date)!==slot.day)return null;const override=p.overrides[`${date}|${slot.id}`];if(p.holidays.includes(date)&&slot.session!=='RAVC')return null;let r=p.rotations.findIndex(r=>date>=r.start&&date<=r.end);if(r<0&&slot.session!=='RAVC')return null;if(override)return override;r=Math.max(r,0);const order=[0,...Array.from({length:y.fellows.length-1},(_,i)=>y.fellows.length-1-i)];return {fellow:y.fellows[(order[slot.track%order.length]+r)%y.fellows.length].id}}
export function totals(y:Year,p:Plan){const result=Object.fromEntries(y.fellows.map(f=>[f.id,{clinic:0,ravc:0,extra:0,overlap:0}]));for(const d of dates(`${y.year}-07-01`,`${y.year+1}-06-30`)){const session:Record<string,number>={};for(const s of p.slots){const a=assignment(y,p,d,s);if(!a||!result[a.fellow])continue;result[a.fellow][s.session==='RAVC'?'ravc':'clinic']++;if(a.extra)result[a.fellow].extra++;if(s.session!=='RAVC'){const k=a.fellow+s.session;session[k]=(session[k]||0)+1}}for(const f of y.fellows)for(const time of ['AM','PM'])if(session[f.id+time]>1)result[f.id].overlap++}return result}

export function fellowName(f?:Pick<Fellow,'displayName'|'nick'|'first'|'last'>){return f?.displayName?.trim()||f?.nick?.trim()||[f?.first,f?.last].filter(Boolean).join(' ')||'Unassigned'}
export const normalizeStaffId=(value:string)=>value.trim().toLowerCase();
export const validStaffId=(value:string)=>/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,63}$/.test(value);
