import {createHmac,randomBytes,randomUUID,scrypt as derive,timingSafeEqual} from 'node:crypto';
import {cookies,cookie,getAuthenticatedUser,sessionCookie,signPayload,verifyPayload,siteOrigin} from './auth';
import {passwordStore,type PasswordStore,type PasswordAccount,type Registry,type AccountTarget} from './password-store';
import {loadSnapshot} from './store';
import type {AppUser} from '../../lib/schedule-api';
import type {Workspace} from '../../lib/schedule';
const CHANGE='__Host-rama_password_change';
const normalize=(value:string)=>value.trim().toLowerCase();
const json=(data:unknown,status=200,headers:Record<string,string>={})=>Response.json(data,{status,headers:{'Cache-Control':'no-store',...headers}});
class LoginError extends Error{constructor(message:string,public status=400){super(message)}}
const denied=()=>new LoginError('Incorrect username or password, or the account is unavailable.',401);
// OWASP's scrypt alternative with 32 MiB memory and three passes.
function scrypt(password:string,salt:string){return new Promise<Buffer>((resolve,reject)=>derive(password,salt,32,{N:32768,r:8,p:3,maxmem:64*1024*1024},(error,key)=>error?reject(error):resolve(key)))}
export async function hashPassword(password:string){const salt=randomBytes(16).toString('hex');return `scrypt$32768$8$3$${salt}$${(await scrypt(password,salt)).toString('hex')}`}
export async function matchesPassword(password:string,hash:string){const parts=hash.split('$');if(parts.length!==6||parts.slice(0,4).join('$')!=='scrypt$32768$8$3'||! /^[a-f0-9]{32}$/.test(parts[4])||! /^[a-f0-9]{64}$/.test(parts[5]))return false;return timingSafeEqual(await scrypt(password,parts[4]),Buffer.from(parts[5],'hex'))}
function passwordValid(value:unknown):value is string{return typeof value==='string'&&value.length>=15&&value.length<=128}
function isAdmin(user:AppUser|null){return !!user&&(user.localAccess?user.localAccess.admin:normalize(user.email)===normalize(process.env.ADMIN_EMAIL||''))}
export function createPasswordAuth(deps:{store:PasswordStore;getUser:(request:Request)=>Promise<AppUser|null>;workspace:()=>Promise<Workspace>;now?:()=>number}){
 const now=deps.now||Date.now;
 const registry=async()=>{const row=await deps.store.read('accounts');return {row,accounts:(row?.data as Registry|undefined)?.accounts||[]}};
 async function edit(update:(accounts:PasswordAccount[])=>PasswordAccount[]){for(let i=0;i<8;i++){const {row,accounts}=await registry();const next=update(structuredClone(accounts));if(await deps.store.write('accounts',{accounts:next},row?.etag))return next}throw new LoginError('An account changed elsewhere. Please try again.',409)}
 function digest(value:string){const secret=process.env.SESSION_SECRET;if(!secret||Buffer.byteLength(secret)<32)throw Error('Missing session configuration');return createHmac('sha256',secret).update(value).digest('hex')}
 async function limit(key:string,max:number){for(let i=0;i<8;i++){const row=await deps.store.read(key);const current=row?.data.expires>now()?row.data:{count:0,expires:now()+15*60000};if(current.count>=max)throw new LoginError('Too many sign-in attempts. Please wait 15 minutes before trying again.',429);if(await deps.store.write(key,{count:current.count+1,expires:current.expires},row?.etag))return}throw new LoginError('Please wait before trying again.',429)}
 async function input(request:Request){
  if(request.headers.get('origin')!==siteOrigin()||new URL(request.url).origin!==siteOrigin())throw new LoginError('Invalid request origin.',403);
  if(!request.headers.get('content-type')?.startsWith('application/json'))throw new LoginError('JSON is required.',415);
  const reader=request.body?.getReader();if(!reader)throw new LoginError('Enter your account details.');let size=0,text='';const decoder=new TextDecoder();
  while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>4096){await reader.cancel();throw new LoginError('Request is too large.',413)}text+=decoder.decode(value,{stream:true})}
  try{const data=JSON.parse(text+decoder.decode());if(!data||typeof data!=='object'||Array.isArray(data))throw Error();return data}catch{throw new LoginError('Invalid request.');}
 }
 async function targetExists(target:AccountTarget){if(target.kind==='admin')return true;const state=await deps.workspace();return !!state.years.find(y=>y.year===target.year)?.fellows.some(f=>f.id===target.fellow)}
 async function session(account:PasswordAccount){return sessionCookie({provider:'password',sub:account.id,version:account.version})}
 async function login(request:Request,ip:string){
  const data=await input(request);await limit('login-ip/'+digest(ip),20);await limit('login-global',100);
  if(typeof data.username!=='string'||data.username.length>64||typeof data.password!=='string'||data.password.length>128)throw denied();
  const username=normalize(data.username);await limit('login-user/'+digest(username),10);
  const {accounts}=await registry();const account=accounts.find(a=>a.username===username);
  const match=await matchesPassword(data.password,account?.hash||'scrypt$32768$8$3$00000000000000000000000000000000$'+'0'.repeat(64));
  if(!account||!match||account.disabled||!await targetExists(account.target))throw denied();
  // Re-read after expensive hashing so a concurrent reset cannot issue a stale session.
  const current=(await registry()).accounts.find(a=>a.id===account.id);
  if(!current||current.version!==account.version||current.disabled)throw denied();
  if(current.mustChange){const token=await signPayload({sub:current.id,version:current.version},'password-change',600);return json({mustChange:true,redirect:'/password'},200,{'Set-Cookie':cookie(CHANGE,token,600)})}
  return json({ok:true,redirect:'/'},200,{'Set-Cookie':await session(current)});
 }
 async function changeIdentity(request:Request){
  const token=cookies(request)[CHANGE];if(token){try{const p=await verifyPayload(token,'password-change');const account=(await registry()).accounts.find(a=>a.id===p.sub&&a.version===p.version&&!a.disabled&&a.mustChange);if(account)return {account,forced:true}}catch{/* A normal session may still be valid. */}}
  const user=await deps.getUser(request);if(!user?.localAccess)throw new LoginError('Sign in with your username and password first.',401);
  const account=(await registry()).accounts.find(a=>`password:${a.id}`===user.userId&&!a.disabled&&!a.mustChange);if(!account)throw new LoginError('Please sign in again.',401);
  return {account,forced:false};
 }
 async function change(request:Request,ip:string){
  const data=await input(request);await limit('change-ip/'+digest(ip),15);const {account,forced}=await changeIdentity(request);
  if(!passwordValid(data.password))throw new LoginError('Use a password between 15 and 128 characters. A phrase of several words works well.');
  if(!forced&&(typeof data.currentPassword!=='string'||data.currentPassword.length>128||!await matchesPassword(data.currentPassword,account.hash)))throw new LoginError('Your current password is incorrect.',401);
  if(await matchesPassword(data.password,account.hash))throw new LoginError('Choose a different password from your current or temporary password.');
  const hash=await hashPassword(data.password),version=randomUUID();
  const accounts=await edit(list=>list.map(a=>{if(a.id!==account.id)return a;if(a.version!==account.version||a.disabled)throw new LoginError('Your account changed. Please sign in again.',409);return {...a,hash,version,mustChange:false,updated:new Date(now()).toISOString()}}));
  const updated=accounts.find(a=>a.id===account.id)!;const headers=new Headers({'Content-Type':'application/json','Cache-Control':'no-store'});headers.append('Set-Cookie',await session(updated));headers.append('Set-Cookie',cookie(CHANGE,'',0));return new Response(JSON.stringify({ok:true,redirect:'/'}),{headers});
 }
 const safe=(a:PasswordAccount)=>({id:a.id,username:a.username,target:a.target,mustChange:a.mustChange,disabled:a.disabled,created:a.created,updated:a.updated});
 async function manage(request:Request){
  const user=await deps.getUser(request);if(!isAdmin(user))throw new LoginError('Admin access required.',403);
  if(request.method==='GET')return json({accounts:(await registry()).accounts.map(safe),currentAccount:user?.localAccess?user.userId.slice('password:'.length):null});
  const data=await input(request);const at=new Date(now()).toISOString();
  if(data.action==='create'){
   if(typeof data.username!=='string'||! /^[a-z0-9][a-z0-9._-]{2,63}$/.test(normalize(data.username)))throw new LoginError('Use 3–64 letters, numbers, dots, underscores or hyphens for the username.');
   const target:AccountTarget=data.target?.kind==='admin'?{kind:'admin'}:{kind:'fellow',year:data.target?.year,fellow:data.target?.fellow};
   if(target.kind==='fellow'&&(!Number.isInteger(target.year)||typeof target.fellow!=='string'))throw new LoginError('Choose a fellow.');
   if(!await targetExists(target))throw new LoginError('The fellow no longer exists.',409);
   const temporaryPassword=randomBytes(18).toString('base64url');const account:PasswordAccount={id:randomUUID(),username:normalize(data.username),target,hash:await hashPassword(temporaryPassword),version:randomUUID(),mustChange:true,disabled:false,created:at,updated:at};
   await edit(list=>{if(list.some(a=>a.username===account.username))throw new LoginError('This username is already in use.',409);if(list.some(a=>a.target.kind===target.kind&&(target.kind==='admin'||a.target.kind==='fellow'&&a.target.year===target.year&&a.target.fellow===target.fellow)))throw new LoginError('An account already exists for this person. Reset it instead.',409);return [...list,account]});
   return json({account:safe(account),temporaryPassword},201);
  }
  if(!['reset','disable'].includes(data.action)||typeof data.id!=='string')throw new LoginError('Invalid account action.');
  if(user!.userId===`password:${data.id}`)throw new LoginError('Use Change password for your own account. Sign in with Google if you need to reset or disable it.');
  const temporaryPassword=data.action==='reset'?randomBytes(18).toString('base64url'):undefined;
  const hash=temporaryPassword?await hashPassword(temporaryPassword):undefined;
  const result=await edit(list=>{if(!list.some(a=>a.id===data.id))throw new LoginError('Account not found.',404);return list.map(a=>a.id!==data.id?a:{...a,hash:hash||a.hash,version:randomUUID(),disabled:data.action==='disable',mustChange:data.action==='reset'?true:a.mustChange,updated:at})});
  return json({account:safe(result.find(a=>a.id===data.id)!),...(temporaryPassword?{temporaryPassword}:{})});
 }
 return async(request:Request,ip:string)=>{try{const path=new URL(request.url).pathname;
  if(path==='/api/admin/accounts'&&['GET','POST'].includes(request.method))return await manage(request);
  if(path==='/auth/password/login'&&request.method==='POST')return await login(request,ip);
  if(path==='/auth/password/change'&&request.method==='POST')return await change(request,ip);
  if(path==='/auth/password/status'&&request.method==='GET'){const {account,forced}=await changeIdentity(request);return json({username:account.username,mustChange:forced})}
  return json({error:'Not found.'},404);
 }catch(error){return error instanceof LoginError?json({error:error.message},error.status):json({error:'Account sign-in is temporarily unavailable. Please try again.'},503)}};
}
export function handlePasswordAuth(request:Request,ip:string){return createPasswordAuth({store:passwordStore(),getUser:getAuthenticatedUser,workspace:async()=>(await loadSnapshot()).state})(request,ip)}
