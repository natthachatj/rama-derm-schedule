import {useEffect,useState} from 'react';
import {Sun,Moon,Monitor} from 'lucide-react';
export type Appearance='light'|'dark'|'system';
export function useAppearance(preference:Appearance='system'){
 const [deviceDark,setDeviceDark]=useState(()=>typeof window!=='undefined'&&window.matchMedia('(prefers-color-scheme: dark)').matches);
 useEffect(()=>{const m=window.matchMedia('(prefers-color-scheme: dark)'),change=()=>setDeviceDark(m.matches);change();m.addEventListener('change',change);return()=>m.removeEventListener('change',change);},[]);
 const resolved=preference==='system'?(deviceDark?'dark':'light'):preference;
 useEffect(()=>{document.documentElement.dataset.theme=resolved;document.documentElement.style.colorScheme=resolved;},[resolved]);
 return resolved;
}
export function AppearanceSettings({value,onChange,busy}:{value:Appearance;onChange:(v:Appearance)=>void;busy:boolean}){return <section className="panel appearance-settings"><span className="eyebrow">PERSONAL SETTINGS</span><h2>Appearance</h2><p className="muted">Your choice is saved to your account and applies to both admin and fellow workspaces.</p><div className="appearance-options" role="group" aria-label="Appearance">{([['light',Sun,'Light'],['dark',Moon,'Dark'],['system',Monitor,'Follow device']] as const).map(([id,Icon,label])=><button type="button" className="button" key={id} disabled={busy} aria-pressed={value===id} onClick={()=>onChange(id)}><Icon size={18}/>{label}</button>)}</div></section>;}
export function ThemeButton({resolved,onChange,busy}:{resolved:'light'|'dark';onChange:(v:Appearance)=>void;busy:boolean}){return <button type="button" className="icon theme-toggle" disabled={busy} aria-label={'Switch to '+(resolved==='dark'?'light':'dark')+' mode'} title={'Switch to '+(resolved==='dark'?'light':'dark')+' mode'} onClick={()=>onChange(resolved==='dark'?'light':'dark')}>{resolved==='dark'?<Sun size={20}/>:<Moon size={20}/>}</button>;}
