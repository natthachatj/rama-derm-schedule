import {getStore} from '@netlify/blobs';
import {fellowName,normalizeStaffId,type Workspace} from '../../lib/schedule';
import {loadSnapshot} from './store';
import type {AppUser} from '../../lib/schedule-api';
export type AccountTarget={kind:'admin'}|{kind:'fellow';year:number;fellow:string};
export type PasswordAccount={id:string;username:string;target:AccountTarget;hash:string;version:string;mustChange:boolean;disabled:boolean;created:string;updated:string};
export type Registry={accounts:PasswordAccount[]};
export type StoredRow={data:any;etag:string};
export type PasswordStore={read:(key:string)=>Promise<StoredRow|null>;write:(key:string,data:unknown,etag?:string)=>Promise<boolean>};
export function passwordStore():PasswordStore{
 const store=getStore({name:'rama-derm-password-auth',consistency:'strong'});
 return {read:async key=>{const row=await store.getWithMetadata(key,{type:'json'});if(!row)return null;if(!row.etag)throw Error('Missing credential storage version.');return {data:row.data,etag:row.etag}},write:async(key,data,etag)=>(await store.setJSON(key,data,etag?{onlyIfMatch:etag}:{onlyIfNew:true})).modified};
}
export async function readPasswordSession(id:string,version:string,store:PasswordStore,workspace:()=>Promise<import('../../lib/schedule').Workspace>,adminEmail=process.env.ADMIN_EMAIL):Promise<AppUser|null>{
 const row=await store.read('accounts');
 const account:PasswordAccount|undefined=row?.data.accounts.find((a:PasswordAccount)=>a.id===id);
 if(!account||account.disabled||account.mustChange||account.version!==version)return null;
 const target=account.target;
 if(target.kind==='admin')return {userId:`password:${account.id}`,email:adminEmail?.trim()||account.username,displayName:account.username,fullName:null,localAccess:{admin:true,memberships:[]}};
 const state=await workspace();
 const fellow=state.years.find(y=>y.year===target.year)?.fellows.find(f=>f.id===target.fellow);
 if(!fellow)return null;
 return {userId:`password:${account.id}`,email:fellow.email||account.username,displayName:fellowName(fellow),fullName:null,localAccess:{admin:false,memberships:[{year:target.year,id:target.fellow}]}};
}

export function passwordSessionUser(id:string,version:string){return readPasswordSession(id,version,passwordStore(),async()=>(await loadSnapshot()).state)}

// Fellow usernames are derived from the live roster, so Staff ID edits keep the same password.
export function accountUsername(account:PasswordAccount,state:Workspace){const target=account.target;if(target.kind==='admin')return account.username;return state.years.find(y=>y.year===target.year)?.fellows.find(f=>f.id===target.fellow)?.staffId?.trim()||account.username}
export async function validatePasswordUsernames(state:Workspace){const row=await passwordStore().read('accounts');const accounts:PasswordAccount[]=row?.data.accounts||[];validateAccountNames(accounts,state)}
export function validateAccountNames(accounts:PasswordAccount[],state:Workspace){const names=new Map<string,string>();for(const account of accounts){const name=normalizeStaffId(accountUsername(account,state));if(names.has(name))throw Error('This Staff ID No. conflicts with an existing login username. Choose a unique ID.');names.set(name,account.id)}for(const y of state.years)for(const f of y.fellows)if(f.staffId){const owner=accounts.find(a=>a.target.kind==='fellow'&&a.target.year===y.year&&a.target.fellow===f.id);const reserved=names.get(normalizeStaffId(f.staffId));if(reserved&&reserved!==owner?.id)throw Error('This Staff ID No. conflicts with an existing login username. Choose a unique ID.')}}
