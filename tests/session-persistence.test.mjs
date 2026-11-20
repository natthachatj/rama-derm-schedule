import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdtemp,rm} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
const dir=await mkdtemp(new URL('../.auth-test-',import.meta.url));
await build({entryPoints:['netlify/server/auth.ts'],outfile:dir+'/auth.mjs',bundle:true,platform:'node',format:'esm',packages:'external'});
const {sessionCookie,getAuthenticatedUser,renewSessionResponse,revokeSessions,signPayload,verifyPayload}=await import(pathToFileURL(dir+'/auth.mjs'));
after(()=>rm(dir,{recursive:true,force:true}));
process.env.SITE_URL='https://schedule.example.org';process.env.SESSION_SECRET='test-session-secret-with-at-least-32-bytes';
function fixture(){let count=0;const rows=new Map();const store={async read(k){return rows.get(k)||null},async write(k,data,etag){const old=rows.get(k);if(etag?old?.etag!==etag:!!old)return false;rows.set(k,{data,etag:String(++count)});return true}};const request=(cookie,method='GET',origin=process.env.SITE_URL)=>new Request(process.env.SITE_URL+'/api/schedule/version',{method,headers:{Cookie:cookie.split(';')[0],Origin:origin}});return {store,request}}
const payload={sub:'google-subject',email:'fellow@hospital.org',name:'Fellow',email_verified:true};
test('remembered sessions last 30 days; unchecked sessions remain eight hours',async()=>{const f=fixture();for(const [remember,seconds] of [[true,2592000],[false,28800]]){const cookie=await sessionCookie(payload,remember,f.store);assert.match(cookie,new RegExp('Max-Age='+seconds));assert.match(cookie,/Secure; HttpOnly; SameSite=Lax/);const p=await verifyPayload(cookie.split(';')[0].split('=')[1],'session');assert.equal(p.remember,remember);assert.equal(p.exp-p.iat,seconds);assert.equal((await getAuthenticatedUser(f.request(cookie),undefined,f.store)).email,payload.email)}});
test('renewal piggybacks on ordinary requests and does not renew every request or short sessions',async()=>{const f=fixture();for(const [remember,days,renew] of [[true,20,true],[true,29,false],[false,1,false]]){const token=await signPayload({...payload,remember,generation:'0'},'session',days*86400);const r=await renewSessionResponse(f.request('__Host-rama_session='+token),new Response('ok'),f.store);assert.equal(r.headers.has('set-cookie'),renew);assert.equal(await r.text(),'ok')}});
test('sign out all devices revokes old cookies, permits a fresh login, and protects other accounts',async()=>{const f=fixture(),a=await sessionCookie(payload,true,f.store),b=await sessionCookie(payload,true,f.store),other=await sessionCookie({...payload,sub:'someone-else'},true,f.store);const r=await revokeSessions(f.request(a,'POST'),f.store);assert.equal(r.status,200);assert.match(r.headers.get('set-cookie'),/Max-Age=0/);for(const cookie of [a,b])assert.equal(await getAuthenticatedUser(f.request(cookie),undefined,f.store),null);assert.ok(await getAuthenticatedUser(f.request(other),undefined,f.store));const fresh=await sessionCookie(payload,true,f.store);assert.ok(await getAuthenticatedUser(f.request(fresh),undefined,f.store))});
test('revocation rejects cross-origin requests and invalid sessions',async()=>{const f=fixture(),cookie=await sessionCookie(payload,true,f.store);assert.equal((await revokeSessions(f.request(cookie,'POST','https://evil.test'),f.store)).status,403);assert.equal((await revokeSessions(f.request(cookie),f.store)).status,403);assert.equal((await revokeSessions(f.request('bad','POST'),f.store)).status,401)});
test('renewal cannot resurrect a session when sign-out races with the response',async()=>{
 const f=fixture(),token=await signPayload({...payload,remember:true,generation:'0'},'session',20*86400);
 let reads=0;const racing={...f.store,async read(key){reads++;if(reads===1){const old=await f.store.read(key);await f.store.write(key,{generation:'revoked'});return old}return f.store.read(key)}};
 const response=await renewSessionResponse(f.request('__Host-rama_session='+token),new Response('ok'),racing);
 const renewed=response.headers.get('set-cookie');assert.ok(renewed);
 assert.equal(await getAuthenticatedUser(f.request(renewed),undefined,f.store),null);
});
