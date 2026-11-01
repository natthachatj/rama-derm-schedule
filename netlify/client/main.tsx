import React from 'react';
import {createRoot} from 'react-dom/client';
import Scheduler from '../../app/scheduler';
import Migration from './migration';
import '../../app/globals.css';
import Login from './login';
createRoot(document.getElementById('root')!).render(location.pathname==='/setup/import'?<Migration/>:location.pathname==='/login'?<Login/>:<Scheduler signOutPath="/auth/logout"/>);
