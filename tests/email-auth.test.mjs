import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdtemp,rm} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
const dir=await mkdtemp(new URL('../.auth-test-',import.meta.url));
await build({entryPoints:['netlify/server/email-auth.ts','netlify/server/auth.ts','lib/schedule-api.ts','lib/schedule.ts'],outdir:dir,outbase:'.',bundle:true,platform:'node',target:'node22',format:'esm',packages:'external'});
const {createEmailAuth,sendCode}=await import(pathToFileURL(`${dir}/netlify/server/email-auth.js`));
const {getAuthenticatedUser,signPayload}=await import(pathToFileURL(`${dir}/netlify/server/auth.js`));
const {createScheduleApi}=await import(pathToFileURL(`${dir}/lib/schedule-api.js`));
const {seed}=await import(pathToFileURL(`${dir}/lib/schedule.js`));
process.env.SITE_URL='https://schedule.example.org';process.env.SESSION_SECRET='test-session-secret-with-at-least-32-bytes';
after(()=>rm(dir,{recursive:true,force:true}));
function fixture(){
 let clock=Date.now(),version=0;const rows=new Map(),sent=[];const members=new Map([['fellow@hospital.org',{email:'fellow@hospital.org',name:'Fellow One'}],['admin@hospital.org',{email:'admin@hospital.org',name:'Admin'}]]);
 const store={async read(key){const row=rows.get(key);return row?structuredClone(row):null},async write(key,data,etag){const row=rows.get(key);if(etag?row?.etag!==etag:!!row)return false;rows.set(key,{data:structuredClone(data),etag:String(++version)});return true}};
 const deps={store,lookup:async email=>members.get(email)||null,send:async(email,code,id)=>{sent.push({email,code,id})},now:()=>clock,configured:()=>true};
 const handler=createEmailAuth(deps);
 const req=(path,data,cookie='',origin=process.env.SITE_URL)=>new Request(process.env.SITE_URL+path,{method:'POST',headers:{'Content-Type':'application/json',Origin:origin,Cookie:cookie},body:JSON.stringify(data)});
 async function start(email='fellow@hospital.org',ip='ip1'){const response=await handler(req('/auth/email/request',{email}),ip);return {response,cookie:(response.headers.get('set-cookie')||'').split(';')[0],code:sent.at(-1)?.code}}
 const verify=(cookie,code,ip='ip1')=>handler(req('/auth/email/verify',{code},cookie),ip);
 return {rows,sent,members,deps,handler,req,start,verify,advance:ms=>{clock+=ms}};
}
test('code login issues a secure verified session and preserves fellow/admin authorization',async()=>{
 const f=fixture();const {response,cookie,code}=await f.start(' Fellow@Hospital.org ');assert.equal(response.status,200);assert.equal(f.sent[0].email,'fellow@hospital.org');
 assert.match(response.headers.get('set-cookie'),/Secure; HttpOnly; SameSite=Lax/);
 assert.ok(!JSON.stringify([...f.rows.values()]).includes(code));assert.ok(!(await response.text()).includes(code));
 const verified=await f.verify(cookie,code);assert.equal(verified.status,200);const session=verified.headers.getSetCookie().find(c=>c.startsWith('__Host-rama_session='));assert.ok(session);
 const user=await getAuthenticatedUser(new Request(process.env.SITE_URL,{headers:{Cookie:session.split(';')[0]}}));assert.equal(user.email,'fellow@hospital.org');
 const state=seed();state.years[0].fellows[0].email=user.email;state.years[0].fellows[1].email='private@hospital.org';
 const ports={load:async()=>({state,revision:0,token:'v1'}),save:async()=>true,getUser:async()=>user,adminEmail:()=> ' ADMIN@hospital.org '};
 let view=await (await createScheduleApi(ports).GET()).json();assert.equal(view.role,'fellow');assert.equal(view.years[0].fellows[1].email,'');assert.equal(view.years[0].draft,undefined);
 assert.equal((await createScheduleApi(ports).BACKUP()).status,403);
 const a=await f.start('admin@hospital.org','ip2');const aVerified=await f.verify(a.cookie,a.code,'ip2');const aSession=aVerified.headers.getSetCookie().find(c=>c.startsWith('__Host-rama_session='));
 ports.getUser=()=>getAuthenticatedUser(new Request(process.env.SITE_URL,{headers:{Cookie:aSession.split(';')[0]}}));
 view=await (await createScheduleApi(ports).GET()).json();assert.equal(view.role,'admin');assert.ok(view.years[0].draft);
 assert.equal((await f.verify(cookie,code)).status,400);
});
test('a code cannot be redeemed twice concurrently',async()=>{const f=fixture();const a=await f.start();const results=await Promise.all([f.verify(a.cookie,a.code),f.verify(a.cookie,a.code)]);assert.deepEqual(results.map(r=>r.status).sort(),[200,400])});
test('five wrong attempts lock the code',async()=>{const f=fixture(),a=await f.start();const wrong=a.code==='000000'?'111111':'000000';for(let i=0;i<5;i++)assert.equal((await f.verify(a.cookie,wrong)).status,400);assert.equal((await f.verify(a.cookie,a.code)).status,400)});
test('codes expire, and no cookie or a tampered cookie cannot authenticate',async()=>{const f=fixture(),a=await f.start();assert.equal((await f.verify('',a.code)).status,400);assert.equal((await f.verify(a.cookie+'tampered',a.code)).status,400);f.advance(600001);assert.equal((await f.verify(a.cookie,a.code)).status,400)});
test('resend cooldown, superseded codes, per-email and per-IP limits',async()=>{const f=fixture(),a=await f.start();assert.equal((await f.start()).response.status,429);f.advance(60001);const b=await f.start();assert.equal(b.response.status,200);assert.equal((await f.verify(a.cookie,a.code)).status,400);assert.equal((await f.verify(b.cookie,b.code)).status,200);f.advance(60001);assert.equal((await f.start()).response.status,200);f.advance(60001);assert.equal((await f.start()).response.status,429);
 const g=fixture();for(let i=0;i<8;i++)assert.equal((await g.start(`unknown${i}@example.org`)).response.status,200);assert.equal((await g.start('another@example.org')).response.status,429);assert.equal(g.sent.length,0);
});
test('unknown addresses have generic responses, removed fellows cannot redeem, and wrong-browser requests fail',async()=>{const f=fixture(),a=await f.start('unknown@example.org');assert.equal(a.response.status,200);assert.equal(f.sent.length,0);assert.equal((await f.verify(a.cookie,'123456')).status,400);const b=await f.start();f.members.delete('fellow@hospital.org');assert.equal((await f.verify(b.cookie,b.code)).status,400);assert.equal((await f.verify(a.cookie,b.code)).status,400)});
test('CSRF, invalid email, non-JSON and oversized requests are rejected',async()=>{const f=fixture();assert.equal((await f.handler(f.req('/auth/email/request',{email:'fellow@hospital.org'},'','https://evil.example'),'ip1')).status,403);assert.equal((await f.start('invalid')).response.status,400);assert.equal((await f.start('x'.repeat(2100)+'@example.org')).response.status,413);assert.equal((await f.handler(new Request(process.env.SITE_URL+'/auth/email/request',{method:'POST',headers:{Origin:process.env.SITE_URL},body:'email=x'}),'ip1')).status,415);assert.equal(f.sent.length,0)});
test('unconfigured or failed delivery does not issue a usable code or expose provider errors',async()=>{const f=fixture();f.deps.configured=()=>false;assert.equal((await f.start()).response.status,503);f.deps.configured=()=>true;f.deps.send=async()=>{throw Error('secret-provider-details')};const a=await f.start();assert.equal(a.response.status,503);assert.ok(!(await a.response.text()).includes('secret-provider-details'));assert.ok(!a.cookie);assert.ok([...f.rows.values()].find(row=>row.data.id).data.used)});
test('Resend request uses the configured sender and server authorization',async()=>{const original=globalThis.fetch;process.env.RESEND_API_KEY='test-key';process.env.EMAIL_FROM='RAMA Derm <schedule@example.org>';let captured;globalThis.fetch=async(url,options)=>{captured={url,options};return new Response('{}',{status:200})};try{await sendCode('fellow@hospital.org','123456','test-id');assert.equal(captured.url,'https://api.resend.com/emails');assert.equal(captured.options.headers.Authorization,'Bearer test-key');const body=JSON.parse(captured.options.body);assert.equal(body.from,process.env.EMAIL_FROM);assert.deepEqual(body.to,['fellow@hospital.org']);assert.match(body.text,/123456/);assert.equal(captured.options.headers['Idempotency-Key'],'signin/test-id')}finally{globalThis.fetch=original}});

test('existing Google sessions stay valid and forged, unverified or wrong-purpose sessions fail',async()=>{
 const payload={sub:'google-subject',email:'fellow@hospital.org',name:'Google Fellow',email_verified:true};
 const request=token=>new Request(process.env.SITE_URL,{headers:{Cookie:`__Host-rama_session=${token}`}});
 const token=await signPayload(payload,'session',600);assert.equal((await getAuthenticatedUser(request(token))).userId,'google-subject');
 assert.equal(await getAuthenticatedUser(request(token+'tampered')),null);
 assert.equal(await getAuthenticatedUser(request(await signPayload(payload,'email-otp',600))),null);
 assert.equal(await getAuthenticatedUser(request(await signPayload(payload,'session',-1))),null);
 assert.equal(await getAuthenticatedUser(request(await signPayload({...payload,email_verified:false},'session',600))),null);
});
