import {academicStart,academicEnd,activityDate} from './activities';
import {add} from './schedule';
export const thaiHolidaySource='https://calendar.google.com/calendar/ical/en.th.official%23holiday%40group.v.calendar.google.com/public/basic.ics';
export type ThaiHoliday={date:string;name:string};
export type ThaiHolidayResult={year:number;from:string;to:string;holidays:ThaiHoliday[];source:string;fetchedAt:string;warnings:string[]};
const decode=(value:string)=>value.replace(/\\n/gi,' ').replace(/\\([,;\\])/g,'$1').trim();
export function parseThaiHolidays(ics:string,year:number,fetchedAt=new Date().toISOString()):ThaiHolidayResult{
 if(!Number.isInteger(year)||year<2020||year>2100)throw Error('Choose a valid academic year.');
 if(!ics.includes('BEGIN:VCALENDAR')||!ics.includes('END:VCALENDAR')||ics.length>2_000_000)throw Error('The holiday source returned an invalid calendar.');
 const from=academicStart(year),to=academicEnd(year),all:ThaiHoliday[]=[];const text=ics.replace(/\r?\n[ \t]/g,'');
 for(const block of text.split('BEGIN:VEVENT').slice(1)){if(!block.includes('END:VEVENT'))continue;const props=new Map<string,string>();for(const line of block.split(/\r?\n/)){const colon=line.indexOf(':');if(colon>0)props.set(line.slice(0,colon).split(';')[0],line.slice(colon+1))}
  if(props.get('STATUS')==='CANCELLED'||!/^Public holiday\b/i.test(decode(props.get('DESCRIPTION')||'')))continue;
  const raw=props.get('DTSTART')||'',endRaw=props.get('DTEND')||'';if(!/^\d{8}$/.test(raw))continue;const iso=(v:string)=>`${v.slice(0,4)}-${v.slice(4,6)}-${v.slice(6,8)}`,start=iso(raw),end=/^\d{8}$/.test(endRaw)?iso(endRaw):add(start,1);if(!activityDate.safeParse(start).success||!activityDate.safeParse(end).success||end<=start)continue;
  for(let date=start,n=0;date<end&&n<31;date=add(date,1),n++){all.push({date,name:decode(props.get('SUMMARY')||'Thai public holiday').slice(0,200)})}
 }
 const holidays=all.filter(h=>h.date>=from&&h.date<=to).sort((a,b)=>a.date.localeCompare(b.date)||a.name.localeCompare(b.name));const unique=[...new Map(holidays.map(h=>[h.date+'|'+h.name,h])).values()];
 const warnings=['Google’s calendar is a planning source, not the hospital’s official closure calendar. Review substitute days, government-only holidays and special Cabinet announcements; add any missing dates. Future holiday dates can change.'];
 for(const calendarYear of [year,year+1]){const inYear=all.filter(h=>h.date.startsWith(String(calendarYear)));if(!inYear.length)warnings.push(`No holiday data is available for ${calendarYear}. The list does not cover the full academic year.`);const required=calendarYear===year?['Asalha']:['Makha','Visakha'];const missing=required.filter(name=>!inYear.some(h=>h.name.toLowerCase().includes(name.toLowerCase())));if(missing.length)warnings.push(`${calendarYear}: ${missing.join(', ')} dates are absent from the source. Movable holiday coverage may be incomplete.`);}
 if(!unique.length)warnings.push('No public holidays were returned inside this academic year. Do not treat the empty result as a holiday-free year.');
 return {year,from,to,holidays:unique,source:thaiHolidaySource,fetchedAt,warnings};
}
let cache:{text:string;at:number}|undefined;
let pending:Promise<{text:string;at:number}>|undefined;
export async function loadThaiHolidays(year:number,fetcher:typeof fetch=fetch){if(!Number.isInteger(year)||year<2020||year>2100)throw Error('Choose a valid academic year.');if(cache&&Date.now()-cache.at<6*3600000)return parseThaiHolidays(cache.text,year,new Date(cache.at).toISOString());if(!pending)pending=(async()=>{const response=await fetcher(thaiHolidaySource,{signal:AbortSignal.timeout(8000),headers:{Accept:'text/calendar'}});if(!response.ok)throw Error('Thai holiday calendar could not be loaded. Retry or enter dates manually.');const text=await response.text();parseThaiHolidays(text,year);const result={text,at:Date.now()};cache=result;return result})().finally(()=>{pending=undefined});const source=await pending;return parseThaiHolidays(source.text,year,new Date(source.at).toISOString());}
export async function thaiHolidayResponse(request:Request,user:{email:string;localAccess?:{admin:boolean}}|null,adminEmail?:string){if(!user||!(user.localAccess?user.localAccess.admin:!!adminEmail&&user.email.trim().toLowerCase()===adminEmail.trim().toLowerCase()))return Response.json({error:'Admin access required.'},{status:403,headers:{'Cache-Control':'no-store'}});const year=Number(new URL(request.url).searchParams.get('year'));if(!Number.isInteger(year)||year<2020||year>2100)return Response.json({error:'Choose a valid academic year.'},{status:400});try{return Response.json(await loadThaiHolidays(year),{headers:{'Cache-Control':'no-store'}})}catch{return Response.json({error:'Automatic holiday loading is unavailable. Retry, or enter and review holiday dates manually. Your saved dates have been kept.'},{status:503,headers:{'Cache-Control':'no-store'}})}}
