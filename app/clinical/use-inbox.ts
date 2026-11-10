import {useEffect,useState} from 'react';
import {startVisibleRefresh} from '../../lib/visible-refresh';
import type {PriorityItem} from '../../lib/priority-inbox';
import {clinicalApi} from './api';
export function useClinicalInbox(userId:string|undefined,enabled:boolean,refreshKey:string){
 const [state,setState]=useState<{owner:boolean;items:PriorityItem[];loading:boolean;error:string}>({owner:false,items:[],loading:false,error:''});
 useEffect(()=>{let alive=true,seq=0;setState({owner:false,items:[],loading:enabled,error:''});if(!userId||!enabled)return;
 async function refresh(){const request=++seq;let owner=false;try{const session=await clinicalApi('session');owner=!!session.owner;if(!alive||request!==seq)return;if(!owner){setState({owner:false,items:[],loading:false,error:''});return;}if(!session.connection?.connected)throw Error('Reconnect Google in clinical Settings');const data=await clinicalApi('inbox');if(alive&&request===seq)setState({owner:true,items:data.items.map((i:PriorityItem)=>({...i,fellow:session.memberships.find((m:any)=>m.id===i.fellow&&m.year===i.year)?.name||i.fellow})),loading:false,error:''});}catch(e){if(alive&&request===seq)setState({owner,items:[],loading:false,error:owner?(e as Error).message:''});}}
 const stop=startVisibleRefresh(document,()=>void refresh());return()=>{alive=false;++seq;stop();};
 },[userId,enabled,refreshKey]);return state;
}
