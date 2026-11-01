import React from 'react';
import {createRoot} from 'react-dom/client';
import Scheduler from '../../app/scheduler';
import Migration from './migration';
import '../../app/globals.css';
import {CalendarDays,ArrowLeft,ShieldCheck} from 'lucide-react';
function Login(){const error=new URLSearchParams(location.search).get('error');return <main className="login-page"><a className="login-back" href="/"><ArrowLeft size={16}/>Back to the schedule</a><section className="login-card"><span className="brand-mark"><CalendarDays size={29}/></span><div className="eyebrow">RAMA DERM · FELLOWSHIP WORKSPACE</div><h1>A shared rhythm.<br/>One place to belong.</h1><p>Sign in to manage your schedule, request leave, and keep track of coverage.</p>{error&&<p role="alert" className="banner warning">Sign-in could not be completed. Please try again or contact the administrator.</p>}<a className="button primary full" href="/auth/google/start">Continue with Google</a><small>The approved calendar is public. Private information is available only to the relevant fellow and admin.</small><div className="login-note"><ShieldCheck size={17}/>Your Google password is handled by Google.</div></section></main>}
createRoot(document.getElementById('root')!).render(location.pathname==='/setup/import'?<Migration/>:location.pathname==='/login'?<Login/>:<Scheduler signOutPath="/auth/logout"/>);
