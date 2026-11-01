import {getStore} from '@netlify/blobs';
import {seed,type Workspace} from '../../lib/schedule';
import type {Snapshot} from '../../lib/schedule-api';
type Record={state:Workspace;revision:number};
export function stateStore(){return getStore({name:'rama-derm-schedules',consistency:'strong'})}
export function createSnapshotStorage(store:Pick<ReturnType<typeof getStore>,'getWithMetadata'|'setJSON'>){return {
 async load():Promise<Snapshot>{let row=await store.getWithMetadata('workspace',{type:'json'});if(!row){await store.setJSON('workspace',{state:seed(),revision:0},{onlyIfNew:true});row=await store.getWithMetadata('workspace',{type:'json'})}if(!row)throw Error('Storage initialization failed.');const record=row.data as Record;return {state:record.state,revision:record.revision,token:row.etag}},
 async save(state:Workspace,revision:number,token?:string){if(!token)throw Error('Missing storage version.');const result=await store.setJSON('workspace',{state,revision:revision+1},{onlyIfMatch:token});return result.modified}
}}
export async function loadSnapshot(){return createSnapshotStorage(stateStore()).load()}
export async function saveSnapshot(state:Workspace,revision:number,token?:string){return createSnapshotStorage(stateStore()).save(state,revision,token)}
