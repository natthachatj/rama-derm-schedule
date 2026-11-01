import React,{useEffect,useState} from 'react';
import {CalendarDays,ArrowLeft,ShieldCheck,Mail} from 'lucide-react';
export default function Login(){
 const [available,setAvailable]=useState<boolean|null>(null),[email,setEmail]=useState(''),[code,setCode]=useState(''),[step,setStep]=useState<'email'|'code'>('email'),[busy,setBusy]=useState(false),[error,setError]=useState(new URLSearchParams(location.search).has('error')?'Sign-in could not be completed. Please try again.':''),[message,setMessage]=useState(''),[wait,setWait]=useState(0);
 useEffect(()=>{fetch('/api/auth/methods',{cache:'no-store'}).then(r=>{if(!r.ok)throw Error();return r.json()}).then(data=>setAvailable(data.email===true)).catch(()=>setAvailable(false))},[]);
 useEffect(()=>{if(!wait)return;const timer=setTimeout(()=>setWait(v=>Math.max(0,v-1)),1000);return()=>clearTimeout(timer)},[wait]);
 async function submit(verify=false){
  setBusy(true);setError('');setMessage('');
  try{const response=await fetch(verify?'/auth/email/verify':'/auth/email/request',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(verify?{code}:{email})});const data=await response.json();if(!response.ok)throw Error(data.error||'Unable to sign in. Please try again.');
   if(verify){location.assign('/');return}
   setStep('code');setCode('');setWait(data.resendAfter||60);setMessage(data.message||'Check your email for a sign-in code.');
  }catch(e){setError(e instanceof Error?e.message:'Unable to sign in. Please try again.')}finally{setBusy(false)}
 }
 return <main className="login-page"><a className="login-back" href="/"><ArrowLeft size={16}/>Back to the schedule</a><section className="login-card"><span className="brand-mark"><CalendarDays size={29}/></span><div className="eyebrow">RAMA DERM · FELLOWSHIP WORKSPACE</div><h1>A shared rhythm.<br/>One place to belong.</h1><p>Sign in to manage your schedule, request leave, and keep track of coverage.</p>
 <a className="button primary full" href="/auth/google/start">Continue with Google</a>
 <div className="login-divider"><span>or use your email</span></div>
 {available===null?<p role="status">Checking email sign-in…</p>:available===false?<p className="login-setup" role="status">Email sign-in is awaiting administrator setup. Google sign-in is available.</p>:<form className="email-login" onSubmit={e=>{e.preventDefault();void submit(step==='code')}}>
 {step==='email'?<><label htmlFor="signin-email">Email address</label><input id="signin-email" type="email" autoComplete="email" required maxLength={254} placeholder="name@hospital.org" value={email} onChange={e=>setEmail(e.target.value)} disabled={busy}/><small>Use the email registered by your program administrator.</small><button className="button primary full" type="submit" disabled={busy}><Mail size={16}/>{busy?'Sending…':'Email me a sign-in code'}</button></>:<><div className="code-recipient">Check your inbox at <strong>{email.trim()}</strong></div><label htmlFor="signin-code">Six-digit code</label><input id="signin-code" className="code-input" type="text" inputMode="numeric" pattern="[0-9]{6}" autoComplete="one-time-code" required maxLength={6} value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,''))} disabled={busy} autoFocus/><small>Expires in 10 minutes. Use this browser and the newest code.</small><button className="button primary full" type="submit" disabled={busy||code.length!==6}>{busy?'Checking…':'Verify and sign in'}</button><div className="email-actions"><button type="button" onClick={()=>void submit()} disabled={busy||wait>0}>{wait?`Resend in ${wait}s`:'Resend code'}</button><button type="button" disabled={busy} onClick={()=>{setStep('email');setCode('');setError('');setMessage('')}}>Change email</button></div></>}
 </form>}
 {error&&<div role="alert" className="banner warning login-feedback">{error}</div>}{message&&<div role="status" className="login-feedback">{message}</div>}
 <small>The approved calendar is public. Private information is available only to the relevant fellow and admin.</small><div className="login-note"><ShieldCheck size={17}/>Google or a one-time email code securely verifies your identity.</div></section></main>
}
