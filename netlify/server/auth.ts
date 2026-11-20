import * as oidc from 'openid-client';
import {SignJWT,jwtVerify} from 'jose';
import {passwordSessionUser,passwordStore,type PasswordStore} from './password-store';
import {createHash,randomUUID} from 'node:crypto';
import type {AppUser} from '../../lib/schedule-api';
const SESSION='__Host-rama_session',TRANSACTION='__Host-rama_oauth';
export const SESSION_DAYS=30;
const maxAge=SESSION_DAYS*24*60*60,shortAge=8*60*60;
const sessionKey=(subject:string)=>'sessions/'+createHash('sha256').update(subject).digest('hex');
const verifiedSessions=new WeakMap<Request,Promise<{user:AppUser;payload:Record<string,any>}|null>>();
export function siteOrigin(){const value=process.env.SITE_URL;if(!value)throw Error('SITE_URL is not configured.');const url=new URL(value);if(url.protocol!=='https:'||url.username||url.password)throw Error('SITE_URL must be an HTTPS origin.');return url.origin}
function key(){const value=process.env.SESSION_SECRET;if(!value||new TextEncoder().encode(value).length<32)throw Error('SESSION_SECRET requires at least 32 bytes.');return new TextEncoder().encode(value)}
export function cookies(request:Request){return Object.fromEntries((request.headers.get('cookie')||'').split(';').map(p=>{const i=p.indexOf('=');return i<0?['','']:[p.slice(0,i).trim(),p.slice(i+1).trim()]}))}
export function cookie(name:string,value:string,seconds:number){return `${name}=${value}; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=${seconds}`}
export async function signPayload(payload:Record<string,unknown>,purpose:string,seconds:number){return new SignJWT({...payload,purpose}).setProtectedHeader({alg:'HS256'}).setIssuer(siteOrigin()).setAudience(siteOrigin()).setIssuedAt().setExpirationTime(Math.floor(Date.now()/1000)+seconds).sign(key())}
export async function verifyPayload(token:string,purpose:string){const {payload}=await jwtVerify(token,key(),{algorithms:['HS256'],issuer:siteOrigin(),audience:siteOrigin()});if(payload.purpose!==purpose)throw Error('Invalid token purpose.');return payload}
async function readSession(request:Request,readPasswordUser=passwordSessionUser,store:PasswordStore=passwordStore()):Promise<{user:AppUser;payload:Record<string,any>}|null>{
 const token=cookies(request)[SESSION];if(!token)return null;
 try{const p=await verifyPayload(token,'session');if(typeof p.sub!=='string')return null;
 const generation=(await store.read(sessionKey(p.sub)))?.data.generation||'0';
 if((p.generation||'0')!==generation)return null;
 let user:AppUser|null;
 if(p.provider==='password'){if(typeof p.version!=='string')return null;user=await readPasswordUser(p.sub,p.version)}
 else{if(typeof p.email!=='string'||p.email_verified!==true)return null;user={userId:p.sub,email:p.email,displayName:typeof p.name==='string'?p.name:p.email,fullName:typeof p.name==='string'?p.name:null}}
 return user?{user,payload:p}:null;
 }catch{return null}
}
export async function getAuthenticatedUser(request:Request,readPasswordUser=passwordSessionUser,store?:PasswordStore):Promise<AppUser|null>{
 if(readPasswordUser!==passwordSessionUser||store)return (await readSession(request,readPasswordUser,store))?.user||null;
 let pending=verifiedSessions.get(request);if(!pending){pending=readSession(request);verifiedSessions.set(request,pending)}return (await pending)?.user||null;
}
export async function sessionCookie(payload:Record<string,unknown>,remember=true,store:PasswordStore=passwordStore()){
 if(typeof payload.sub!=='string')throw Error('Missing session subject.');
 const generation=(await store.read(sessionKey(payload.sub)))?.data.generation||'0';
 const seconds=remember?maxAge:shortAge;
 return cookie(SESSION,await signPayload({...payload,remember,generation},'session',seconds),seconds);
}
// Renew through ordinary app requests at most once a week, without a keep-alive timer.
export async function renewSessionResponse(request:Request,response:Response,store?:PasswordStore){
 if(new URL(request.url).pathname.startsWith('/auth/')||response.status>=400)return response;
 const session=store?await readSession(request,passwordSessionUser,store):await (verifiedSessions.get(request)||Promise.resolve(null));
 if(!session||session.payload.remember!==true||Number(session.payload.exp)-Date.now()/1000>23*86400)return response;
 const {iss,aud,iat,exp,purpose,...payload}=session.payload;
 const headers=new Headers(response.headers);headers.append('Set-Cookie',cookie(SESSION,await signPayload({...payload,remember:true},'session',maxAge),maxAge));
 return new Response(response.body,{status:response.status,statusText:response.statusText,headers});
}
export async function revokeSessions(request:Request,store:PasswordStore=passwordStore(),readPasswordUser=passwordSessionUser){
 if(request.method!=='POST'||request.headers.get('origin')!==siteOrigin())return Response.json({error:'Invalid request.'},{status:403,headers:{'Cache-Control':'no-store'}});
 const session=await readSession(request,readPasswordUser,store);if(!session)return Response.json({error:'Sign in first.'},{status:401,headers:{'Cache-Control':'no-store'}});
 const key=sessionKey(session.payload.sub);
 for(let i=0;i<8;i++){const row=await store.read(key);if(await store.write(key,{generation:randomUUID()},row?.etag)){const headers=new Headers({'Cache-Control':'no-store','Content-Type':'application/json','Set-Cookie':cookie(SESSION,'',0)});return new Response(JSON.stringify({ok:true}),{headers})}}
 return Response.json({error:'Please try again.'},{status:409,headers:{'Cache-Control':'no-store'}});
}
let configuration:Promise<oidc.Configuration>|undefined;
export function googleConfig(){if(!process.env.GOOGLE_CLIENT_ID||!process.env.GOOGLE_CLIENT_SECRET)throw Error('Google OAuth is not configured.');return configuration??=oidc.discovery(new URL('https://accounts.google.com'),process.env.GOOGLE_CLIENT_ID,process.env.GOOGLE_CLIENT_SECRET).then(config=>{oidc.enableNonRepudiationChecks(config);return config}).catch(e=>{configuration=undefined;throw e})}
export async function googleStart(request:Request){if(new URL(request.url).origin!==siteOrigin())return Response.redirect(siteOrigin()+'/auth/google/start',302);const config=await googleConfig();const verifier=oidc.randomPKCECodeVerifier(),state=oidc.randomState(),nonce=oidc.randomNonce();const redirect=oidc.buildAuthorizationUrl(config,{redirect_uri:siteOrigin()+'/auth/google/callback',scope:'openid email profile',code_challenge:await oidc.calculatePKCECodeChallenge(verifier),code_challenge_method:'S256',state,nonce,prompt:'select_account'});const transaction=await signPayload({verifier,state,nonce,remember:new URL(request.url).searchParams.get('remember')!=='0'},'oauth',600);return new Response(null,{status:302,headers:{Location:redirect.href,'Set-Cookie':cookie(TRANSACTION,transaction,600),'Cache-Control':'no-store'}})}
export async function googleCallback(request:Request){const headers=new Headers({'Cache-Control':'no-store','Set-Cookie':cookie(TRANSACTION,'',0)});try{if(new URL(request.url).origin!==siteOrigin())throw Error('Invalid callback origin.');const transaction=await verifyPayload(cookies(request)[TRANSACTION]||'','oauth');if(typeof transaction.verifier!=='string'||typeof transaction.state!=='string'||typeof transaction.nonce!=='string')throw Error('Invalid transaction.');const tokens=await oidc.authorizationCodeGrant(await googleConfig(),new URL(request.url),{pkceCodeVerifier:transaction.verifier,expectedState:transaction.state,expectedNonce:transaction.nonce});const claims=tokens.claims();if(!claims||typeof claims.sub!=='string'||typeof claims.email!=='string'||claims.email_verified!==true)throw Error('A verified Google email is required.');headers.append('Set-Cookie',await sessionCookie({sub:claims.sub,email:claims.email.toLowerCase(),name:typeof claims.name==='string'?claims.name:claims.email,email_verified:true},transaction.remember!==false));headers.set('Location',siteOrigin()+'/');return new Response(null,{status:302,headers})}catch{headers.set('Location',siteOrigin()+'/login?error=signin');return new Response(null,{status:302,headers})}}
export function logout(){const headers=new Headers({Location:siteOrigin()+'/','Cache-Control':'no-store'});for(const name of [SESSION,'__Host-rama_password_change','__Host-rama_email_otp'])headers.append('Set-Cookie',cookie(name,'',0));return new Response(null,{status:302,headers})}
