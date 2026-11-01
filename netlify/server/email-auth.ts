import {createHmac, randomInt, randomUUID, timingSafeEqual} from 'node:crypto';
import {getStore} from '@netlify/blobs';
import {cookies, cookie, signPayload, verifyPayload, sessionCookie, siteOrigin} from './auth';
import {fellowName} from '../../lib/schedule';
import {loadSnapshot} from './store';

const TRANSACTION='__Host-rama_email_otp';
const TTL=600;
const normalize=(email:string)=>email.trim().toLowerCase();
export function emailConfigured(){return !!(process.env.RESEND_API_KEY?.trim()&&process.env.EMAIL_FROM?.trim())}
function digest(value:string){const secret=process.env.SESSION_SECRET;if(!secret||Buffer.byteLength(secret)<32)throw Error('Session configuration is missing.');return createHmac('sha256',secret).update(value).digest('hex')}
type RecordData={expires:number;count?:number;last?:number;id?:string;hash?:string;attempts?:number;used?:boolean};
type Row={data:RecordData;etag:string};
export type AuthStore={read:(key:string)=>Promise<Row|null>;write:(key:string,data:RecordData,etag?:string)=>Promise<boolean>};
function authStore():AuthStore{const store=getStore({name:'rama-derm-email-auth',consistency:'strong'});return {
 read:async key=>await store.getWithMetadata(key,{type:'json'}) as Row|null,
 write:async(key,data,etag)=>(await store.setJSON(key,data,etag?{onlyIfMatch:etag}:{onlyIfNew:true})).modified
}}
export async function registeredIdentity(email:string){
 if(normalize(process.env.ADMIN_EMAIL||'')===email)return {email,name:email};
 const {state}=await loadSnapshot();
 const fellow=state.years.flatMap(y=>y.fellows).find(f=>normalize(f.email||'')===email);
 return fellow?{email,name:fellowName(fellow)}:null;
}
export async function sendCode(email:string,code:string,id:string){
 const result=await fetch('https://api.resend.com/emails',{method:'POST',signal:AbortSignal.timeout(15000),headers:{Authorization:`Bearer ${process.env.RESEND_API_KEY}`,'Content-Type':'application/json','Idempotency-Key':`signin/${id}`},body:JSON.stringify({from:process.env.EMAIL_FROM,to:[email],subject:'Your RAMA Derm sign-in code',text:`Your RAMA Derm sign-in code is: ${code}\n\nThis code expires in 10 minutes and can only be used once in the browser where you requested it.\n\nIf you did not request this code, you can ignore this email.\n${siteOrigin()}`})});
 if(!result.ok)throw Error('Email delivery failed.');
}
class AuthError extends Error{constructor(message:string,public status=400){super(message)}}
const invalid=()=>new AuthError('The code is incorrect, expired, or already used. Request a new code if needed.');
const json=(value:unknown,status=200,headers:Record<string,string>={})=>Response.json(value,{status,headers:{'Cache-Control':'no-store',...headers}});
export function createEmailAuth(deps:{store:AuthStore;lookup:typeof registeredIdentity;send:typeof sendCode;now?:()=>number;configured?:()=>boolean}){
 const now=deps.now||Date.now;
 async function limit(key:string,max:number,windowMs:number,cooldown=0){
  for(let i=0;i<8;i++){
   const row=await deps.store.read(key),t=now();const current=row&&row.data.expires>t?row.data:null;
   if(current&&((current.count||0)>=max||(cooldown&&t-(current.last||0)<cooldown)))throw new AuthError('Too many attempts. Please wait before trying again.',429);
   const next={expires:current?.expires||t+windowMs,count:(current?.count||0)+1,last:t};
   if(await deps.store.write(key,next,row?.etag))return;
  }
  throw new AuthError('Please wait and try again.',429);
 }
 async function body(request:Request){
  if(request.headers.get('origin')!==siteOrigin()||new URL(request.url).origin!==siteOrigin())throw new AuthError('Invalid request origin.',403);
  if(!request.headers.get('content-type')?.startsWith('application/json'))throw new AuthError('JSON is required.',415);
  // Limit the actual stream, including requests without Content-Length.
  const reader=request.body?.getReader();if(!reader)throw new AuthError('Enter your email or code.');let size=0,text='';const decoder=new TextDecoder();
  while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>2048){await reader.cancel();throw new AuthError('Request is too large.',413)}text+=decoder.decode(value,{stream:true})}
  try{const value=JSON.parse(text+decoder.decode());if(!value||typeof value!=='object'||Array.isArray(value))throw Error();return value}catch{throw new AuthError('Invalid request.');}
 }
 async function requestCode(request:Request,ip:string){
  const data=await body(request);
  if(!(deps.configured||emailConfigured)())throw new AuthError('Email sign-in is awaiting administrator setup. Please use Google for now.',503);
  if(typeof data.email!=='string'||data.email.length>254||! /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email.trim()))throw new AuthError('Enter a valid email address.');
  const email=normalize(data.email),emailKey=digest('email:'+email),id=randomUUID();
  await limit('send-ip/'+digest(ip),8,15*60000);
  await limit('send-email/'+emailKey,3,15*60000,60000);
  await limit('send-global',100,60*60000);
  const identity=await deps.lookup(email);
  const code=String(randomInt(0,1000000)).padStart(6,'0');
  const key='code/'+emailKey;
  let saved=false;
  for(let i=0;i<8&&!saved;i++){
   const old=await deps.store.read(key);
   saved=await deps.store.write(key,{expires:now()+TTL*1000,id,hash:digest(`${email}:${id}:${code}`),attempts:0,used:!identity},old?.etag);
  }
  if(!saved)throw new AuthError('Please wait and try again.',429);
  if(identity){try{await deps.send(email,code,id)}catch{
   const row=await deps.store.read(key);if(row?.data.id===id)await deps.store.write(key,{...row.data,used:true},row.etag);
   throw new AuthError('Unable to send a code right now. Please try again later or use Google.',503);
  }}
  const token=await signPayload({email,id},'email-otp',TTL);
  return json({ok:true,expiresIn:TTL,resendAfter:60,message:'If this email is registered with the program, a code will arrive shortly.'},200,{'Set-Cookie':cookie(TRANSACTION,token,TTL)});
 }
 async function verifyCode(request:Request,ip:string){
  const data=await body(request);await limit('verify-ip/'+digest(ip),30,15*60000);
  if(typeof data.code!=='string'||!/^\d{6}$/.test(data.code))throw invalid();
  let transaction;try{transaction=await verifyPayload(cookies(request)[TRANSACTION]||'','email-otp')}catch{throw invalid()}
  if(typeof transaction.email!=='string'||typeof transaction.id!=='string')throw invalid();
  const email=transaction.email,id=transaction.id,key='code/'+digest('email:'+email);
  for(let i=0;i<8;i++){
   const row=await deps.store.read(key),record=row?.data;
   if(!row||!record||record.id!==id||record.used||record.expires<=now()||(record.attempts||0)>=5||!record.hash)throw invalid();
   const match=timingSafeEqual(Buffer.from(record.hash,'hex'),Buffer.from(digest(`${email}:${id}:${data.code}`),'hex'));
   const next={...record,attempts:(record.attempts||0)+1,used:match||(record.attempts||0)+1>=5};
   if(!await deps.store.write(key,next,row.etag))continue;
   if(!match)throw invalid();
   // Membership may have been removed or the email changed after issuing the code.
   const identity=await deps.lookup(email);if(!identity)throw invalid();
   const headers=new Headers({'Cache-Control':'no-store','Content-Type':'application/json'});
   headers.append('Set-Cookie',await sessionCookie({sub:`email:${email}`,email,name:identity.name,email_verified:true}));
   headers.append('Set-Cookie',cookie(TRANSACTION,'',0));
   return new Response(JSON.stringify({ok:true,redirect:'/'}),{headers});
  }
  throw invalid();
 }
 return async(request:Request,ip:string)=>{try{return new URL(request.url).pathname==='/auth/email/request'?await requestCode(request,ip):await verifyCode(request,ip)}catch(error){return error instanceof AuthError?json({error:error.message},error.status):json({error:'Email sign-in is temporarily unavailable. Please try again later or use Google.'},503)}};
}
export function handleEmailAuth(request:Request,ip:string){return createEmailAuth({store:authStore(),lookup:registeredIdentity,send:sendCode})(request,ip)}
