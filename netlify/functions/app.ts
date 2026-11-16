import {handleClinical} from '../server/clinical/handler';
import {clinicalGoogleStart,clinicalGoogleCallback} from '../server/clinical/google';
import {thaiHolidayResponse} from '../../lib/thai-holidays';
import {createScheduleApi} from '../../lib/schedule-api';
import {buildPublishedPdf} from '../../lib/published-pdf';
import {loadSnapshot,saveSnapshot} from '../server/store';
import {getAuthenticatedUser,googleStart,googleCallback,logout,siteOrigin} from '../server/auth';
import {validateBackup} from '../../lib/backup-schema';
import {validatePasswordUsernames} from '../server/password-store';
import {handlePasswordAuth} from '../server/password-auth';
import {emailConfigured,handleEmailAuth} from '../server/email-auth';
const json=(v:unknown,status=200)=>Response.json(v,{status,headers:{'Cache-Control':'no-store'}});
export default async function handler(request:Request,context?:{ip?:string}){try{const path=new URL(request.url).pathname;const user=()=>getAuthenticatedUser(request);const api=createScheduleApi({load:loadSnapshot,save:saveSnapshot,getUser:user,adminEmail:()=>process.env.ADMIN_EMAIL,validateFellows:validatePasswordUsernames});
 if(path==='/auth/clinical/google/start'&&request.method==='GET')return await clinicalGoogleStart(request);
 if(path==='/auth/clinical/google/callback'&&request.method==='GET')return await clinicalGoogleCallback(request);
 if(path.startsWith('/api/clinical/'))return await handleClinical(request);
 if(path.startsWith('/auth/password/')||path==='/api/admin/accounts')return await handlePasswordAuth(request,context?.ip||'unknown');
 if(path==='/api/auth/methods'&&request.method==='GET')return json({email:emailConfigured(),password:true});
 if(['/auth/email/request','/auth/email/verify'].includes(path)&&request.method==='POST')return await handleEmailAuth(request,context?.ip||'unknown');
 if(path==='/auth/google/start'&&request.method==='GET')return await googleStart(request);
 if(path==='/auth/google/callback'&&request.method==='GET')return await googleCallback(request);
 if(path==='/auth/logout'&&request.method==='GET')return logout();
 if(path==='/api/admin/thai-holidays'&&request.method==='GET')return await thaiHolidayResponse(request,await user(),process.env.ADMIN_EMAIL);
 if(path==='/api/schedule'&&request.method==='GET')return await api.GET();
 if(path==='/api/schedule'&&request.method==='POST')return await api.POST(request);
 if(path==='/api/admin/backup'&&request.method==='GET')return await api.BACKUP();
 if(path==='/api/admin/import'&&request.method==='POST'){
  const identity=await user();if(!identity||!(identity.localAccess?identity.localAccess.admin:identity.email.trim().toLowerCase()===process.env.ADMIN_EMAIL?.trim().toLowerCase()))return json({error:'Admin access required.'},403);
  if(request.headers.get('origin')!==siteOrigin())return json({error:'Invalid request origin.'},403);
  const text=await request.text();if(text.length>20_000_000)return json({error:'Backup is too large.'},413);const backup=validateBackup(JSON.parse(text));
  const snapshot=await loadSnapshot();if(snapshot.revision!==0)return json({error:'Import is allowed only before the new deployment has been edited.'},409);
  if(!await saveSnapshot(backup.state,snapshot.revision,snapshot.token))return json({error:'The data changed. Retry import.'},409);
  return json({imported:true,academicYears:backup.state.years.map(y=>y.year)});
 }
 if(path==='/api/schedule/pdf'&&request.method==='GET'){
  const year=Number(new URL(request.url).searchParams.get('year'));if(!Number.isInteger(year)||year<2020||year>2100)return json({error:'Select a valid academic year.'},400);
  const {state}=await loadSnapshot();const y=state.years.find(y=>y.year===year);if(!y?.published)return json({error:'Publish this academic year before exporting.'},404);
  const safe={year:y.year,published:y.published,publishedAt:y.publishedAt,fellows:y.fellows.map(f=>({id:f.id,first:f.first,last:f.last,nick:f.nick,displayName:f.displayName,color:f.color,email:''}))};const bytes=await buildPublishedPdf(safe);return new Response(bytes as BodyInit,{headers:{'Content-Type':'application/pdf','Content-Disposition':`attachment; filename="RAMA-Derm-Published-Schedule-${year}-${year+1}.pdf"`,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
 }
 return json({error:'Not found.'},404);
 }catch{return json({error:'The service is unavailable. Please contact the administrator.'},503)}}
export const config={path:['/api/clinical/*','/auth/clinical/google/start','/auth/clinical/google/callback','/api/admin/thai-holidays','/auth/password/login','/auth/password/change','/auth/password/status','/api/admin/accounts','/api/auth/methods','/auth/email/request','/auth/email/verify','/api/schedule','/api/schedule/pdf','/api/admin/backup','/api/admin/import','/auth/google/start','/auth/google/callback','/auth/logout']};
