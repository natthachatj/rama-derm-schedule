import {PDFDocument,rgb,PageSizes,type PDFPage,type PDFFont} from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import {sarabunBase64} from './pdf-font';
import {add,fellowName,dates,weekday,assignment,type Year,type Slot,type Plan} from './schedule';
export type ExportYear=Pick<Year,'year'|'fellows'|'published'|'publishedAt'>;
const dayNames=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const shortDate=(d:string)=>new Date(d+'T12:00:00Z').toLocaleDateString('en-GB',{day:'numeric',month:'short'});
export function publishedModel(year:ExportYear){
 if(!year.published)throw Error('Publish this academic year before exporting.');
 const p=year.published;const y={...year,draft:p,dirty:false} as Year;
 const base:Plan={...p,holidays:[],overrides:{}};
 const fellowNumber=(id:string)=>String(year.fellows.findIndex(f=>f.id===id)+1);
 const baseCells=(s:Slot)=>p.rotations.map(r=>{const ds=dates(r.start,r.end).filter(d=>weekday(d)===s.day);if(!ds.length)return '-';const initial=assignment(y,base,ds[0],s);if(!initial)return '-';const changed=ds.some(d=>assignment(y,p,d,s)?.fellow!==assignment(y,base,d,s)?.fellow);return fellowNumber(initial.fellow)+(changed?'*':'')});
 const rows=[1,2,3,4,5,6,0].flatMap(day=>{const am=p.slots.filter(s=>s.day===day&&s.session==='AM');const pm=p.slots.filter(s=>s.day===day&&s.session==='PM');const ravc=p.slots.filter(s=>s.day===day&&s.session==='RAVC');am.push(...ravc);pm.push(...ravc);return Array.from({length:Math.max(am.length,pm.length)},(_,i)=>({day:dayNames[day],first:i===0,am:am[i]?{clinic:am[i].clinic,cells:baseCells(am[i])}:null,pm:pm[i]?{clinic:pm[i].clinic,cells:baseCells(pm[i])}:null}))});
 const exceptions:{date:string;session:string;clinic:string;assigned:string}[]=[];
 for(const d of [...new Set(p.holidays)].sort())if(d>=`${year.year}-07-01`&&d<=`${year.year+1}-06-30`)exceptions.push({date:d,session:'AM / PM',clinic:'All regular clinics closed for holiday',assigned:'RAVC continues as scheduled'});
 for(const [key] of Object.entries(p.overrides).sort(([a],[b])=>a.localeCompare(b))){const [d,id]=key.split('|');const s=p.slots.find(s=>s.id===id);if(!s||weekday(d)!==s.day||d<`${year.year}-07-01`||d>`${year.year+1}-06-30`)continue;const actual=assignment(y,p,d,s);exceptions.push({date:d,session:s.session,clinic:s.clinic,assigned:actual?`${fellowNumber(actual.fellow)} - ${fellowName(year.fellows.find(f=>f.id===actual.fellow))}`:'Closed for holiday'})}
 for(const d of dates(`${year.year}-07-01`,add(p.rotations[0].start,-1)))for(const s of p.slots.filter(s=>s.session==='RAVC'&&s.day===weekday(d))){const actual=assignment(y,p,d,s);if(actual)exceptions.push({date:d,session:'RAVC',clinic:'Opening-weekend coverage before rotation 1',assigned:`${fellowNumber(actual.fellow)} - ${fellowName(year.fellows.find(f=>f.id===actual.fellow))}`})}
 exceptions.sort((a,b)=>a.date.localeCompare(b.date)||a.session.localeCompare(b.session));
 return {rows,exceptions,rotations:p.rotations,year:year.year,publishedAt:year.publishedAt,legend:year.fellows.map((f,i)=>`${i+1} = ${fellowName(f)}`)};
}
export async function buildPublishedPdf(year:ExportYear){
 const model=publishedModel(year);const doc=await PDFDocument.create();doc.setTitle(`RAMA Derm - Published Schedule ${year.year}-${year.year+1}`);doc.setAuthor('RAMA Derm');doc.registerFontkit(fontkit);
 const font=await doc.embedFont(Uint8Array.from(atob(sarabunBase64),c=>c.charCodeAt(0)),{subset:true});
 const navy=rgb(.08,.17,.34),teal=rgb(.08,.57,.55),ink=rgb(.12,.19,.3),muted=rgb(.43,.49,.59),line=rgb(.82,.86,.91),light=rgb(.95,.97,.99),white=rgb(1,1,1);
 const [W,H]=PageSizes.A3;const width=H,height=W;const margin=30,usable=width-margin*2;
 let page:PDFPage;let top=0;const pages:PDFPage[]=[];
 function draw(text:string,x:number,t:number,size=8,color=ink){page.drawText(text,{x,y:height-t-size,size,font,color})}
 function box(x:number,t:number,w:number,h:number,fill=white,border=line){page.drawRectangle({x,y:height-t-h,width:w,height:h,color:fill,borderColor:border,borderWidth:.35})}
 function wrap(text:string,w:number,size:number){const parts=text.split(/\s+/);const lines:string[]=[];let current='';for(const part of parts){const candidate=current?current+' '+part:part;if(font.widthOfTextAtSize(candidate,size)<=w){current=candidate;continue}if(current){lines.push(current);current=''}if(font.widthOfTextAtSize(part,size)>w){for(const char of Array.from(part)){if(font.widthOfTextAtSize(current+char,size)>w){lines.push(current);current=''}current+=char}}else current=part}if(current)lines.push(current);return lines.length?lines:['']}
 function multiline(text:string,x:number,t:number,w:number,size=8){const lines=wrap(text,w,size);lines.forEach((s,i)=>draw(s,x,t+i*(size+2),size));return lines.length*(size+2)}
 function newPage(title:string){page=doc.addPage([width,height]);pages.push(page);box(margin,25,usable,31,navy,navy);draw('RAMA DERM | DERMATOSURGERY FELLOWSHIP',margin+12,32,13,white);draw(title,margin,66,14,navy);draw(`Academic year ${year.year}-${year.year+1} (BE ${year.year+543}) | 1 July - 30 June | PUBLISHED SCHEDULE`,margin,88,8,muted);const published=year.publishedAt?new Date(year.publishedAt).toLocaleString('en-GB',{timeZone:'Asia/Bangkok',hour12:false}):'not recorded';draw(`Published: ${published} ICT`,width-margin-240,88,8,muted);top=109}
 function roster(){model.legend.forEach((text,i)=>multiline(text,margin+(i%3)*(usable/3),top+Math.floor(i/3)*16,usable/3-12,8));top+=Math.ceil(model.legend.length/3)*16+9}
 const dayW=45,clinicW=176,n=model.rotations.length,cellW=(usable-dayW-2*clinicW)/(2*n);const leftX=margin+dayW,rightX=leftX+clinicW+n*cellW;
 function header(){box(margin,top,dayW,45,light);draw('DAY',margin+10,top+16,8,navy);for(const [x,label] of [[leftX,'MORNING (08:00-12:00)'],[rightX,'AFTERNOON (13:00-16:00)']] as const){box(x,top,clinicW+n*cellW,17,teal,teal);draw(label,x+7,top+3,8,white);box(x,top+17,clinicW,28,light);draw('CLINIC / DUTY',x+7,top+25,7,muted);model.rotations.forEach((r,i)=>{const cx=x+clinicW+i*cellW;box(cx,top+17,cellW,28,light);draw(`R${i+1}`,cx+3,top+19,7,navy);draw(shortDate(r.start),cx+3,top+28,5.7,muted);draw(shortDate(r.end),cx+3,top+36,5.7,muted)})}top+=45}
 newPage('Annual rotation schedule');roster();header();
 for(const row of model.rows){const h=Math.max(18,...[row.am,row.pm].map(s=>s?wrap(s.clinic,clinicW-10,7).length*9+6:18));if(top+h>height-48){newPage('Annual rotation schedule - continued');header()}const fill=row.first?rgb(.93,.96,.99):white;box(margin,top,dayW,h,fill);if(row.first)draw(row.day.slice(0,3),margin+7,top+5,8,navy);
 for(const [s,x] of [[row.am,leftX],[row.pm,rightX]] as const){box(x,top,clinicW,h,fill);if(s)multiline(s.clinic,x+5,top+4,clinicW-10,7);for(let i=0;i<n;i++){const cx=x+clinicW+i*cellW;box(cx,top,cellW,h,fill);const text=s?.cells[i]||'';draw(text,cx+(cellW-font.widthOfTextAtSize(text,8))/2,top+(h-8)/2-1,8,text.includes('*')?teal:ink)}}top+=h}
 draw('* Base rotation assignment has an approved date-specific change or holiday. See the appendix for the actual assignment on that date.',margin,top+9,7,muted);
 if(model.exceptions.length){newPage('Approved daily changes & holidays');draw('These date-specific entries take precedence over the annual rotation matrix. Fellow numbers refer to the cohort legend.',margin,top,8,muted);top+=24;roster();
 const widths=[95,80,usable*.48,usable-95-80-usable*.48];const labels=['DATE','SESSION','CLINIC / CHANGE','ACTUAL COVERAGE'];
 function exceptionHeader(){let x=margin;labels.forEach((label,i)=>{box(x,top,widths[i],23,teal,teal);draw(label,x+7,top+6,8,white);x+=widths[i]});top+=23}exceptionHeader();
 for(const ex of model.exceptions){const values=[`${shortDate(ex.date)} ${ex.date.slice(0,4)}`,ex.session,ex.clinic,ex.assigned];const h=Math.max(25,...values.map((v,i)=>wrap(v,widths[i]-14,8).length*10+12));if(top+h>height-48){newPage('Approved daily changes & holidays - continued');exceptionHeader()}let x=margin;values.forEach((v,i)=>{box(x,top,widths[i],h);multiline(v,x+7,top+6,widths[i]-14,8);x+=widths[i]});top+=h}}
 pages.forEach((p,i)=>{page=p;draw('Published assignments only. Contact details, leave reasons and internal notes are excluded.',margin,height-28,7,muted);draw(`Page ${i+1} / ${pages.length}`,width-margin-58,height-28,7,muted)});
 return doc.save();
}
