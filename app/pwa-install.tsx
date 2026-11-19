import {useEffect,useState} from 'react';
import {Download,X} from 'lucide-react';
type InstallPrompt=Event & {prompt:()=>Promise<void>;userChoice:Promise<{outcome:string}>};
export default function PwaInstall(){
 const [prompt,setPrompt]=useState<InstallPrompt|null>(null),[ios,setIos]=useState(false),[help,setHelp]=useState(false),[busy,setBusy]=useState(false);
 useEffect(()=>{
  const standalone=()=>matchMedia('(display-mode: standalone)').matches || Boolean((navigator as Navigator & {standalone?:boolean}).standalone);
  const before=(event:Event)=>{if(standalone())return;event.preventDefault();setPrompt(event as InstallPrompt)};
  const installed=()=>{setPrompt(null);setIos(false);setHelp(false)};
  setIos(!standalone() && (/iPad|iPhone|iPod/.test(navigator.userAgent) || navigator.platform==='MacIntel' && navigator.maxTouchPoints>1));
  window.addEventListener('beforeinstallprompt',before);window.addEventListener('appinstalled',installed);
  return()=>{window.removeEventListener('beforeinstallprompt',before);window.removeEventListener('appinstalled',installed)};
 },[]);
 async function install(){if(!prompt){setHelp(true);return}setBusy(true);try{await prompt.prompt();await prompt.userChoice;setPrompt(null)}catch{setHelp(true)}finally{setBusy(false)}}
 if(!prompt&&!ios&&!help)return null;
 return <><button type="button" className="icon" title="Install RAMA Derm Sx" aria-label="Install RAMA Derm Sx" disabled={busy} onClick={()=>void install()}><Download size={20}/></button>{help&&<div className="pwa-help" role="dialog" aria-modal="false" aria-labelledby="pwa-title"><button type="button" className="icon" aria-label="Close install instructions" onClick={()=>setHelp(false)}><X size={20}/></button><h2 id="pwa-title">Install RAMA Derm Sx</h2><p>On iPhone or iPad, open this website in Safari, tap Share, then Add to Home Screen.</p><p>On Android or desktop, use your browser menu and select Install app or Add to Home screen.</p></div>}</>;
}
