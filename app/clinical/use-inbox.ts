import {useEffect,useRef,useState} from 'react';
import type {PriorityItem} from '../../lib/priority-inbox';
import {clinicalApi,setClinicalIdentity} from './api';
export function useClinicalInbox(userId:string|undefined,enabled:boolean,refreshKey:string,permissionKey=''){
 const [state,setState]=useState<{owner:boolean;items:PriorityItem[];loading:boolean;error:string}>({owner:false,items:[],loading:false,error:''});
 const refreshRef=useRef<(()=>void)|undefined>(undefined);
 useEffect(()=>{let alive=true,pending:Promise<void>|undefined;
 setClinicalIdentity(userId?userId+':'+permissionKey:'public');setState({owner:false,items:[],loading:enabled,error:''});if(!userId||!enabled)return;
 function refresh(){if(pending)return;pending=(async()=>{let owner=false;try{
  const session=await clinicalApi('session');owner=!!session.owner;if(!alive)return;
  if(!owner){setState({owner:false,items:[],loading:false,error:''});return}
  if(!session.connection?.connected)throw Error('Reconnect Google in clinical Settings');
  const data=await clinicalApi('inbox');if(alive)setState({owner:true,items:data.items.map((i:PriorityItem)=>({...i,fellow:session.memberships.find((m:any)=>m.id===i.fellow&&m.year===i.year)?.name||i.fellow})),loading:false,error:''});
 }catch(e){if(alive)setState({owner,items:[],loading:false,error:owner?(e as Error).message:''})}finally{pending=undefined}})()}
 refreshRef.current=refresh;window.addEventListener('rama-clinical-changed',refresh);refresh();return()=>{alive=false;refreshRef.current=undefined;window.removeEventListener('rama-clinical-changed',refresh)};
 },[userId,enabled,permissionKey]);
 const lastKey=useRef(refreshKey);
 useEffect(()=>{if(lastKey.current===refreshKey)return;lastKey.current=refreshKey;refreshRef.current?.()},[refreshKey]);return state;
}
