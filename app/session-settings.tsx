import {useState} from 'react';
export default function SessionSettings(){
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 async function revoke(){setBusy(true);setError('');try{const r=await fetch('/auth/session/revoke',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});if(!r.ok)throw Error((await r.json()).error||'Unable to sign out.');location.assign('/login')}catch(e){setError((e as Error).message);setBusy(false)}}
 return <section className="panel session-settings"><h2>Sign-in & devices</h2><p>Remembered sign-in lasts 30 days and renews during normal use. Signing out all devices also signs you out here.</p><button type="button" className="button" disabled={busy} onClick={()=>void revoke()}>{busy?'Signing out…':'Sign out all devices'}</button>{error&&<p role="alert">{error}</p>}</section>;
}
