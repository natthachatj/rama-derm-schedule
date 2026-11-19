import React from 'react';
import {createRoot} from 'react-dom/client';
import Scheduler from '../../app/scheduler';
import Migration from './migration';
import '../../app/globals.css';
import Login from './login';
import PasswordChange from './password-change';
createRoot(document.getElementById('root')!).render(location.pathname==='/setup/import'?<Migration/>:location.pathname==='/password'?<PasswordChange/>:location.pathname==='/login'?<Login/>:<Scheduler signOutPath="/auth/logout"/>);

// The worker provides a public offline notice; application data stays online.
if ('serviceWorker' in navigator) {
 window.addEventListener('load', () => {
  void navigator.serviceWorker.register('/sw.js', {scope:'/', updateViaCache:'none'}).catch(() => { /* App works without installation support. */ });
 });
}
