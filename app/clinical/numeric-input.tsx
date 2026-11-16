import {useState, type InputHTMLAttributes} from 'react';
export function NumericInput({value,onValue,integer=false,...props}:Omit<InputHTMLAttributes<HTMLInputElement>,'onChange'|'value'> & {value:string;onValue:(v:string)=>void;integer?:boolean}){
 const [error,setError]=useState('');const valid=(s:string)=>(integer?/^\d*$/:/^\d*(?:\.\d*)?$/).test(s);
 function accept(s:string){if(!valid(s)){setError(integer?'Use whole numbers only. Put explanations in notes.':'Use numbers only. Put units and explanations in their separate fields.');return;}setError('');onValue(s);}
 return <><input {...props} type="text" inputMode={integer?'numeric':'decimal'} value={value} aria-invalid={!!error||props['aria-invalid']} onChange={e=>accept(e.target.value)} onPaste={e=>{const i=e.currentTarget,t=e.clipboardData.getData('text'),next=value.slice(0,i.selectionStart??value.length)+t+value.slice(i.selectionEnd??value.length);if(!valid(next)){e.preventDefault();setError('Paste a number only; the original pasted text has not been saved.');}}}/>{error&&<span className="clinical-field-error" role="alert">{error}</span>}</>;
}
