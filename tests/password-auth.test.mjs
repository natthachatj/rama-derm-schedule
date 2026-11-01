import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdtemp,rm} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
const dir=await mkdtemp(new URL('../.auth-test-',import.meta.url));
await build({entryPoints:['netlify/server/password-auth.ts','netlify/server/password-store.ts','netlify/server/auth.ts','lib/schedule-api.ts','lib/schedule.ts'],outdir:dir,outbase:'.',bundle:true,platform:'node',target:'node22',format:'esm',packages:'external'});
const {createPasswordAuth,hashPassword,matchesPassword}=await import(pathToFileURL(`${dir}/netlify/server/password-auth.js`));
const {readPasswordSession}=await import(pathToFileURL(`${dir}/netlify/server/password-store.js`));
const {getAuthenticatedUser,verifyPayload,logout}=await import(pathToFileURL(`${dir}/netlify/server/auth.js`));
const {createScheduleApi}=await import(pathToFileURL(`${dir}/lib/schedule-api.js`));
const {seed,makeYear}=await import(pathToFileURL(`${dir}/lib/schedule.js`));
process.env.SITE_URL='https://schedule.example.org';process.env.SESSION_SECRET='password-tests-session-secret-at-least-32-bytes';process.env.ADMIN_EMAIL='owner@example.org';
after(()=>rm(dir,{recursive:true,force:true}));
function fixture(){
 let clock=Date.now(),version=0,external={userId:'google-owner',email:'owner@example.org',displayName:'Owner',fullName:null};const rows=new Map();const state=seed();state.years.push(makeYear(2027));
 const store={async read(key){return rows.has(key)?structuredClone(rows.get(key)):null},async write(key,data,etag){const row=rows.get(key);if(etag?row?.etag!==etag:!!row)return false;rows.set(key,{data:structuredClone(data),etag:String(++version)});return true}};
 const read=(id,ver)=>readPasswordSession(id,ver,store,async()=>state);
 const user=async req=>req.headers.get('cookie')?.includes('__Host-rama_session=')?getAuthenticatedUser(req,read):external;
 const handler=createPasswordAuth({store,getUser:user,workspace:async()=>state,now:()=>clock});
 const request=(path,data,cookie='',origin=process.env.SITE_URL)=>new Request(process.env.SITE_URL+path,{method:data===undefined?'GET':'POST',headers:{'Content-Type':'application/json',Origin:origin,Cookie:cookie},...(data===undefined?{}:{body:JSON.stringify(data)})});
 const call=(path,data,cookie='',ip='ip1')=>handler(request(path,data,cookie),ip);
 const cookie=(r,name)=>r.headers.getSetCookie().find(c=>c.startsWith(name+'='))?.split(';')[0]||'';
 const create=async(username='fellow.one',target={kind:'fellow',year:2026,fellow:'f1'})=>{const response=await call('/api/admin/accounts',{action:'create',username,target});return {response,...await response.json()}};
 const login=(username,password,ip='ip1')=>call('/auth/password/login',{username,password},'',ip);
 const activate=async(a,password='a new personal password phrase')=>{external=null;const loginResponse=await login(a.account.username,a.temporaryPassword);const changeCookie=cookie(loginResponse,'__Host-rama_password_change');const response=await call('/auth/password/change',{password},changeCookie);return {response,session:cookie(response,'__Host-rama_session'),changeCookie}};
 return {rows,state,store,read,user,request,handler,call,cookie,create,login,activate,external:value=>external=value,advance:ms=>clock+=ms};
}
test('temporary login cannot access schedules; first password change creates a fellow-only session with no email required',async()=>{
 const f=fixture();const a=await f.create(' Fellow.One ');assert.equal(a.response.status,201);assert.equal(a.account.username,'fellow.one');assert.equal(a.account.hash,undefined);assert.ok(!JSON.stringify([...f.rows.values()]).includes(a.temporaryPassword));
 f.external(null);const login=await f.login(a.account.username,a.temporaryPassword);assert.equal(login.status,200);assert.equal((await login.json()).mustChange,true);assert.ok(!f.cookie(login,'__Host-rama_session'));const token=f.cookie(login,'__Host-rama_password_change');
 const status=await f.call('/auth/password/status',undefined,token);assert.equal((await status.json()).mustChange,true);assert.equal(await f.user(f.request('/',undefined,token)),null);assert.equal((await f.call('/api/admin/accounts',undefined,token)).status,403);
 assert.equal((await f.call('/auth/password/change',{password:'too short'},token)).status,400);
 assert.equal((await f.call('/auth/password/change',{password:a.temporaryPassword},token)).status,400);
 const changed=await f.call('/auth/password/change',{password:'this is my new private password'},token);assert.equal(changed.status,200);const session=f.cookie(changed,'__Host-rama_session');assert.match(changed.headers.get('set-cookie'),/Secure; HttpOnly; SameSite=Lax/);
 const user=await f.user(f.request('/',undefined,session));assert.deepEqual(user.localAccess,{admin:false,memberships:[{year:2026,id:'f1'}]});assert.equal(f.state.years[0].fellows[0].email,'');
 // Even a roster email equal to ADMIN_EMAIL must not turn a fellow password into admin access.
 f.state.years[0].fellows[0].email=process.env.ADMIN_EMAIL;
 const api=createScheduleApi({load:async()=>({state:f.state,revision:0}),save:async()=>true,getUser:()=>f.user(f.request('/',undefined,session)),adminEmail:()=>process.env.ADMIN_EMAIL});const view=await(await api.GET()).json();assert.equal(view.role,'fellow');assert.equal(view.years[0].draft,undefined);assert.deepEqual(view.memberships,[{year:2026,id:'f1'}]);assert.equal((await api.BACKUP()).status,403);
 assert.equal((await f.call('/api/admin/accounts',undefined,session)).status,403);assert.equal((await f.login(a.account.username,a.temporaryPassword)).status,401);
 assert.equal((await f.login(a.account.username,'this is my new private password')).status,200);
 assert.equal((await f.call('/auth/password/change',{password:'another good password phrase'},token)).status,401);
});
test('admin can reset or disable a login and existing password sessions are revoked',async()=>{
 const f=fixture(),a=await f.create();const active=await f.activate(a);assert.equal(active.response.status,200);
 f.external({userId:'owner',email:process.env.ADMIN_EMAIL,displayName:'Owner',fullName:null});
 const reset=await f.call('/api/admin/accounts',{action:'reset',id:a.account.id});const data=await reset.json();assert.equal(reset.status,200);assert.ok(data.temporaryPassword);assert.equal(await f.user(f.request('/',undefined,active.session)),null);assert.equal((await f.login(a.account.username,'a new personal password phrase')).status,401);
 const newActive=await f.activate(data);assert.equal(newActive.response.status,200);f.external({userId:'owner',email:process.env.ADMIN_EMAIL,displayName:'Owner',fullName:null});
 assert.equal((await f.call('/api/admin/accounts',{action:'disable',id:a.account.id})).status,200);assert.equal(await f.user(f.request('/',undefined,newActive.session)),null);assert.equal((await f.login(a.account.username,'a new personal password phrase')).status,401);
 const listing=await(await f.call('/api/admin/accounts')).json();assert.equal(listing.accounts[0].disabled,true);assert.ok(!JSON.stringify(listing).includes('scrypt$'));assert.ok(!JSON.stringify(listing).includes(data.temporaryPassword));
});
test('admin password login works; self-service change requires the current password and revokes old sessions',async()=>{
 const f=fixture(),a=await f.create('my.admin',{kind:'admin'});const active=await f.activate(a);const user=await f.user(f.request('/',undefined,active.session));assert.equal(user.localAccess.admin,true);
 const listing=await f.call('/api/admin/accounts',undefined,active.session);assert.equal(listing.status,200);assert.equal((await listing.json()).currentAccount,a.account.id);
 assert.equal((await f.call('/api/admin/accounts',{action:'disable',id:a.account.id},active.session)).status,400);
 assert.equal((await f.call('/auth/password/change',{password:'my next personal password',currentPassword:'incorrect'},active.session)).status,401);
 const change=await f.call('/auth/password/change',{password:'my next personal password',currentPassword:'a new personal password phrase'},active.session);assert.equal(change.status,200);assert.equal(await f.user(f.request('/',undefined,active.session)),null);
 assert.ok(await f.user(f.request('/',undefined,f.cookie(change,'__Host-rama_session'))));
});
test('duplicate usernames, duplicate people, invalid targets and unauthorized changes are rejected',async()=>{
 const f=fixture(),a=await f.create();assert.equal((await f.create('fellow.one',{kind:'fellow',year:2026,fellow:'f2'})).response.status,409);assert.equal((await f.create('different')).response.status,409);assert.equal((await f.create('ok.user',{kind:'fellow',year:2026,fellow:'missing'})).response.status,409);assert.equal((await f.create('<invalid>')).response.status,400);
 f.external(null);assert.equal((await f.call('/api/admin/accounts')).status,403);assert.equal((await f.call('/api/admin/accounts',{action:'reset',id:a.account.id})).status,403);assert.equal((await f.call('/api/admin/accounts',{action:'create',username:'attacker',target:{kind:'admin'}})).status,403);
});
test('rate limiting applies to both real and unknown usernames, and cross-origin requests fail',async()=>{
 const f=fixture();f.external(null);
 for(let i=0;i<10;i++)assert.equal((await f.login('unknown','wrong')).status,401);assert.equal((await f.login('unknown','wrong')).status,429);f.advance(15*60000+1);assert.equal((await f.login('unknown','wrong')).status,401);
 assert.equal((await f.handler(f.request('/auth/password/login',{username:'unknown',password:'wrong'},'','https://evil.example'),'ip2')).status,403);
 assert.equal((await f.handler(new Request(process.env.SITE_URL+'/auth/password/login',{method:'POST',headers:{Origin:process.env.SITE_URL},body:'x'}),'ip2')).status,415);
 assert.equal((await f.call('/auth/password/login',{username:'x'.repeat(5000),password:'x'})).status,413);
});
test('hashes have unique salts, verify correctly, and invalid hashes fail closed',async()=>{const a=await hashPassword('my long password phrase'),b=await hashPassword('my long password phrase');assert.notEqual(a,b);assert.ok(await matchesPassword('my long password phrase',a));assert.equal(await matchesPassword('wrong password',a),false);assert.equal(await matchesPassword('my long password phrase','bad-hash'),false)});
test('deleted fellow invalidates the account, and logout clears temporary and normal cookies',async()=>{const f=fixture(),a=await f.create(),active=await f.activate(a);f.state.years[0].fellows=f.state.years[0].fellows.filter(x=>x.id!=='f1');assert.equal(await f.user(f.request('/',undefined,active.session)),null);assert.equal((await f.login(a.account.username,'a new personal password phrase')).status,401);const response=logout();assert.ok(f.cookie(response,'__Host-rama_session').endsWith('='));assert.ok(f.cookie(response,'__Host-rama_password_change').endsWith('='))});
test('concurrent account creation and first-password changes cannot overwrite each other',async()=>{
 const f=fixture();const results=await Promise.all([f.create('shared.name',{kind:'fellow',year:2026,fellow:'f1'}),f.create('shared.name',{kind:'fellow',year:2026,fellow:'f2'})]);assert.deepEqual(results.map(x=>x.response.status).sort(),[201,409]);const a=results.find(x=>x.response.status===201);f.external(null);
 const login=await f.login(a.account.username,a.temporaryPassword);const change=f.cookie(login,'__Host-rama_password_change');const changes=await Promise.all([f.call('/auth/password/change',{password:'the first private password'},change),f.call('/auth/password/change',{password:'the other private password'},change)]);assert.deepEqual(changes.map(x=>x.status).sort(),[200,409]);
});
