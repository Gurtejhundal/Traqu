import { previewText, previewFile, validateTasks } from './parser.js'

import { profileDefaults, INTERESTS } from '../utils/workspaceProfile.js'
export { profileDefaults }
export const freshWorkspace=()=>({version:1,next:1,profile:{...profileDefaults},roadmaps:[],activity:[]})
const fail=(message,status=400)=>{const e=new Error(message);e.status=status;throw e}
const id=state=>state.next++
const isoDay=(instant,zone='UTC')=>new Intl.DateTimeFormat('en-CA',{timeZone:zone || 'UTC',year:'numeric',month:'2-digit',day:'2-digit'}).format(instant)
const shift=(value,n)=>new Date(Date.parse(value+'T12:00:00Z')+n*86400000).toISOString().slice(0,10)
const cleanName=name=>{if(typeof name!=='string'||!name.trim()||name.trim().length>200)fail('Give the roadmap a name (up to 200 characters).');return name.trim()}
const findRoadmap=(s,rid)=>s.roadmaps.find(r=>r.id===Number(rid)) || fail('Roadmap not found.',404)
const findTask=(s,tid)=>{for(const r of s.roadmaps){const t=r.tasks.find(t=>t.id===Number(tid));if(t)return {r,t}}fail('Task not found.',404)}
const findFrame=(s,fid)=>{for(const r of s.roadmaps){const f=r.timeframes.find(f=>f.id===Number(fid));if(f)return {r,f}}fail('Section not found.',404)}
const summary=r=>({id:r.id,name:r.name,created_at:r.created_at,revision:r.revision,total_tasks:r.tasks.length,completed_tasks:r.tasks.filter(t=>t.is_done).length})
const exportRoadmap=r=>({name:r.name,version:2,revision:r.revision,document:r.document,tasks:r.tasks.map(t=>({...t,timeframe:t.timeframe_label}))})
function record(s,r,t,done,zone,now) {
    if(t.is_done===done)return
    const tz=zone || s.profile.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',day=isoDay(now,tz)
    let row=s.activity.find(a=>a.task_id===t.id&&a.day===day)
    if(!row){row={event_key:crypto.randomUUID(),task_id:t.id,roadmap_id:r.id,day};s.activity.push(row)}
    Object.assign(row,{title:t.title,roadmap_name:r.name,timeframe:t.timeframe_label,is_done:done,timezone:tz,occurred_at:now.toISOString()});t.is_done=done
}
function addTasks(s,r,tasks,{preserve=false}={}) {
    const oldTasks=new Map(r.tasks.map(t=>[t.id,t]));const oldFrames=new Map(r.timeframes.map(f=>[f.id,f]));const frames=new Map();const result=[]
    for(const input of validateTasks(tasks)) {
        const key=input.timeframe_id?`id:${input.timeframe_id}`:input.section_key?`key:${input.section_key}`:`label:${input.timeframe}`
        if(!frames.has(key)) {
            const old=preserve?oldFrames.get(input.timeframe_id):null
            frames.set(key,{id:old?.id || id(s),label:input.timeframe,position:frames.size,start_date:input.start_date || null,end_date:input.end_date || null,granularity:input.granularity || 'week'})
        }
        const f=frames.get(key),old=preserve?oldTasks.get(input.id):null
        result.push({...input,id:old?.id || id(s),timeframe_id:f.id,timeframe_label:f.label,start_date:f.start_date,end_date:f.end_date,granularity:f.granularity,created_at:old?.created_at || new Date().toISOString(),blocks:input.blocks.map((b,i)=>({...b,id:old?.blocks.find(x=>x.id===b.id)?.id || id(s),position:i}))})
    }
    r.tasks=result;r.timeframes=[...frames.values()]
}
function create(s,body) {
    const name=cleanName(body.name)
    if(s.roadmaps.some(r=>r.name.toLowerCase()===name.toLowerCase()))fail('A roadmap already uses that name. Choose another.',409)
    const r={id:id(s),name,created_at:new Date().toISOString(),revision:1,raw_text:body.text || '',document:body.document || [],tasks:[],timeframes:[]}
    addTasks(s,r,body.tasks);s.roadmaps.push(r);return {id:r.id,name:r.name}
}
function validProfile(input) {
    const p={...profileDefaults,...input}
    for(const [key,max] of [['name',80],['bio',240],['goal',240],['return_note',160],['timezone',100]])if(typeof p[key]!=='string'||p[key].length>max)fail('Invalid profile field: '+key)
    if(!p.name.trim())fail('Give your profile a name.');p.name=p.name.trim();isoDay(new Date(),p.timezone || 'UTC')
    for(const [key,choices] of [['cover',['paper','stone','ink']],['calendar_palette',['graphite','sage','slate']],['avatar_shape',['circle','rounded']],['week_start',['monday','sunday']]])if(!choices.includes(p[key]))fail('Invalid profile choice.')
    if(!Number.isInteger(p.weekly_goal)||p.weekly_goal<1||p.weekly_goal>7)fail('Choose 1 to 7 active days.')
    if(typeof p.avatar!=='string'||p.avatar.length>350000 || p.avatar && !/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$/.test(p.avatar))fail('Choose a valid profile photo.')
    for(const key of ['compact','pet_motion','reduced_motion','avatar_monochrome','onboarding_completed','reminder_enabled','desktop_notifications'])if(typeof p[key]!=='boolean')fail('Invalid profile preference.')
    if(!Array.isArray(p.interests)||p.interests.length>6||p.interests.some(x=>!INTERESTS.includes(x)))fail('Choose valid interests.')
    if(typeof p.reminder_time!=='string'||!/^([01]\d|2[0-3]):[0-5]\d$/.test(p.reminder_time))fail('Choose a valid reminder time.')
    if(!Array.isArray(p.notifications_seen)||p.notifications_seen.length>40||p.notifications_seen.some(x=>typeof x!=='string'||! /^(ai-connection|daily-\d{4}-\d{2}-\d{2})$/.test(x)))fail('Invalid notification state.')
    return p
}
function activitySummary(s,params,now) {
    const today=isoDay(now,params.timezone || 'UTC'),year=Number(params.year || today.slice(0,4)),counts=new Map()
    if(!Number.isInteger(year)||year<2000||year>Number(today.slice(0,4))+1)fail('Choose a valid activity year.')
    for(const row of s.activity)if(row.is_done)counts.set(row.day,(counts.get(row.day)||0)+1)
    const ordered=[...counts.keys()].sort();let longest=0,run=0,prev=null,streak=0,cursor=counts.has(today)?today:shift(today,-1)
    for(const day of ordered){run=prev && shift(prev,1)===day?run+1:1;longest=Math.max(longest,run);prev=day}
    while(counts.has(cursor)){streak++;cursor=shift(cursor,-1)}
    return {today,year,years:[...new Set([Number(today.slice(0,4)),...ordered.map(d=>Number(d.slice(0,4)))])].sort((a,b)=>b-a),current_streak:streak,longest_streak:longest,active_days:counts.size,total_completions:[...counts.values()].reduce((a,b)=>a+b,0),days:ordered.filter(d=>d.startsWith(String(year))).map(date=>({date,count:counts.get(date)})),recent_days:Array.from({length:7},(_,i)=>({date:shift(today,i-6),count:counts.get(shift(today,i-6))||0})),started_at:ordered[0]||null}
}
export async function prepareRequest(method,path,body) {
    if(path.endsWith('preview-file')||path.endsWith('import-file')) {
        const parsed=await previewFile(body.get('file'))
        return {body:{...parsed,name:body.get('name')},preview:parsed}
    }
    if(path==='/backup/restore-file') {
        const file=body.get('file');if(!file||file.size>8*1024*1024)fail('Choose a backup up to 8 MB.')
        const backup=JSON.parse(await file.text());previewText(JSON.stringify(backup));return {body:backup}
    }
    if(method==='post' && (path==='/roadmaps/preview'||path==='/roadmaps'))return {body,preview:previewText(body.text)}
    return {body}
}

// Synchronous routing keeps each update inside one atomic IndexedDB transaction.
export function routeRequest(s,method,path,body={},params={},prepared={},now=new Date()) {
    if(path==='/profile') {if(method==='put')s.profile=validProfile(body);return s.profile}
    if(path==='/activity')return activitySummary(s,params,now)
    if(path.startsWith('/activity/')) {
        const day=path.split('/')[2],offset=Number(params.offset||0);if(!/^\d{4}-\d{2}-\d{2}$/.test(day))fail('Invalid date.')
        const rows=s.activity.filter(a=>a.day===day).sort((a,b)=>b.occurred_at.localeCompare(a.occurred_at));return {date:day,total:rows.length,next_offset:offset+100<rows.length?offset+100:null,items:rows.slice(offset,offset+100).map(a=>({...a,id:a.event_key,roadmap:a.roadmap_name}))}
    }
    if(path==='/backup') {const backup={format:'traqu-workspace',version:1,roadmaps:s.roadmaps.map(exportRoadmap),profile:s.profile,activity:s.activity};if(JSON.stringify(backup).length>8*1024*1024)fail('Workspace exceeds 8 MB. Export roadmaps separately.',413);return backup}
    if(path==='/backup/restore-file') {
        if(body.format!=='traqu-workspace'||body.version!==1||!Array.isArray(body.roadmaps)||body.roadmaps.length>100)fail('Invalid workspace backup.')
        const profile=body.profile?validProfile(body.profile):null,rows=body.activity||[]
        if(!Array.isArray(rows)||rows.length>30000)fail('Invalid activity backup.')
        for(const a of rows){if(typeof a.event_key!=='string'||typeof a.is_done!=='boolean'||typeof a.title!=='string'||a.title.length>4000||!a.occurred_at||new Date(a.occurred_at)>new Date(now.getTime()+300000)||isoDay(new Date(a.occurred_at),a.timezone)!==a.day)fail('Invalid activity record.')}
        const roadmaps=body.roadmaps.map(r=>{let name=r.name;let n=1;while(s.roadmaps.some(x=>x.name.toLowerCase()===name.toLowerCase()))name=r.name+` (restored ${n++})`;return create(s,{...r,name})})
        if(profile && !Object.entries(profileDefaults).some(([key,value])=>!['onboarding_completed','notifications_seen'].includes(key)&&JSON.stringify(s.profile[key]??value)!==JSON.stringify(value))){s.profile={...profile,onboarding_completed:Boolean(s.profile.onboarding_completed||profile.onboarding_completed)};s.profileSaved=true}
        const keys=new Set(s.activity.map(a=>a.event_key));for(const a of rows)if(!keys.has(a.event_key)){s.activity.push({...a,task_id:null});keys.add(a.event_key)}
        return {roadmaps,message:`Restored ${roadmaps.length} roadmaps as new copies.`}
    }
    if(path==='/roadmaps/preview'||path==='/roadmaps/preview-file')return prepared.preview
    if(path==='/roadmaps' && method==='get')return s.roadmaps.map(summary)
    if(['/roadmaps','/roadmaps/import','/roadmaps/import-file'].includes(path)&&method==='post') {
        const data=path==='/roadmaps'?{...body,...prepared.preview}:body
        if(data.kind==='workspace')fail('Use workspace restore for this backup.')
        return create(s,data)
    }
    const parts=path.split('/').filter(Boolean),rid=Number(parts[1])
    if(parts[0]==='roadmaps'&&parts.length>=2) {
        const r=findRoadmap(s,rid),sub=parts[2]
        if(!sub){if(method==='delete'){s.roadmaps=s.roadmaps.filter(x=>x.id!==rid);return {message:'Roadmap deleted'}}return {...summary(r),raw_text:r.raw_text}}
        if(sub==='tasks'&&parts[3]==='status') {const tasks=body.task_ids.map(i=>r.tasks.find(t=>t.id===i));if(tasks.some(t=>!t))fail('These tasks do not belong to this roadmap.',404);for(const t of tasks)record(s,r,t,body.is_done,body.timezone,now);r.revision++;return {updated:tasks.length}}
        if(sub==='tasks')return r.tasks
        if(sub==='document')return {version:1,elements:r.document}
        if(sub==='export')return exportRoadmap(r)
        if(sub==='timeframes')return r.timeframes
        if(sub==='recover-days') {if(method==='post')fail('For older flat imports, create a daily copy in the desktop app.');return {available:false,reason:'Android supports daily JSON and Markdown imports directly.'}}
        if(sub==='name') {const name=cleanName(body.name);if(s.roadmaps.some(x=>x.id!==r.id&&x.name.toLowerCase()===name.toLowerCase()))fail('Name already exists.',409);r.name=name;r.revision++;return {message:'Roadmap renamed'}}
        if(sub==='smart') {
            if(body.revision!==r.revision)fail('This roadmap changed. Reload the editor before saving.',409)
            const name=cleanName(body.name);if(s.roadmaps.some(x=>x.id!==r.id&&x.name.toLowerCase()===name.toLowerCase()))fail('Name already exists.',409)
            const tasks=validateTasks(body.tasks)
            for(const input of tasks)if(input.id){const t=r.tasks.find(t=>t.id===input.id);if(!t)fail('Unknown task identity. Reload the editor.',409);record(s,r,t,input.is_done,body.timezone,now)}
            addTasks(s,r,tasks,{preserve:true});r.name=name;r.revision++;return {message:'Roadmap updated'}
        }
    }
    if(path==='/tasks'&&method==='post') {
        const r=findRoadmap(s,body.roadmap_id);let f=r.timeframes.find(f=>f.id===body.timeframe_id || !body.timeframe_id&&f.label===body.timeframe_label)
        if(!f){if(body.timeframe_id)fail('Section not found.',404);f={id:id(s),label:body.timeframe_label||'General',granularity:'week',start_date:null,end_date:null,position:r.timeframes.length};r.timeframes.push(f)}
        const title=body.title?.trim();if(!title||title.length>4000)fail('Give the task a title.')
        const t={id:id(s),title,is_done:false,timeframe_id:f.id,timeframe_label:f.label,start_date:f.start_date,end_date:f.end_date,granularity:f.granularity,properties:{},blocks:[],created_at:now.toISOString()};r.tasks.push(t);r.revision++;return t
    }
    if(parts[0]==='tasks'&&parts.length>=2) {
        const {r,t}=findTask(s,parts[1]),sub=parts[2]
        if(!sub){if(method==='delete'){r.tasks=r.tasks.filter(x=>x.id!==t.id);r.revision++;return {message:'Task deleted'}}if(!body.title?.trim()||body.title.length>4000)fail('Give the task a title.');t.title=body.title.trim()}
        if(sub==='status')record(s,r,t,body.is_done,body.timezone,now)
        if(sub==='properties')t.properties=body.properties
        if(sub==='blocks'){if(method==='get')return t.blocks;const block={...body,id:id(s),position:t.blocks.length};t.blocks.push(block);r.revision++;return block}
        r.revision++;return t
    }
    if(path==='/task-blocks/bulk') {
        const targets=body.task_ids.map(tid=>findTask(s,tid));const result=[]
        for(const {r,t} of targets){const block={type:body.type,data:body.data,id:id(s),position:t.blocks.length};t.blocks.push(block);r.revision++;result.push({...block,task_id:t.id})}return result
    }
    if(parts[0]==='task-blocks') {
        for(const r of s.roadmaps)for(const t of r.tasks){const b=t.blocks.find(b=>b.id===Number(parts[1]));if(b){if(method==='delete')t.blocks=t.blocks.filter(x=>x.id!==b.id);else Object.assign(b,body);r.revision++;return method==='delete'?{message:'Block deleted'}:b}}
        fail('Block not found.',404)
    }
    if(parts[0]==='timeframes') {
        const {r,f}=findFrame(s,parts[1])
        if(parts[2]==='dates'){for(const key of ['start_date','end_date'])if(body[key]&&!/^\d{4}-\d{2}-\d{2}$/.test(body[key]))fail('Use YYYY-MM-DD dates.');Object.assign(f,body);for(const t of r.tasks)if(t.timeframe_id===f.id)Object.assign(t,body)}
        else for(const t of r.tasks.filter(t=>t.timeframe_id===f.id))record(s,r,t,body.is_done,body.timezone,now)
        r.revision++;return {message:'Section updated'}
    }
    fail('This operation is not available on Android.',404)
}

let databasePromise
export function openWorkspace() {
    if(!databasePromise)databasePromise=new Promise((resolve,reject)=>{const request=indexedDB.open('traqu-android-workspace',1);request.onupgradeneeded=()=>request.result.createObjectStore('workspace');request.onsuccess=()=>resolve(request.result);request.onerror=()=>{databasePromise=null;reject(new Error('Local storage could not be opened. Restart Traqu and try again.'))}})
    return databasePromise
}
export async function requestWorkspace(method,path,body,params,prepared,now) {
    const database=await openWorkspace()
    return new Promise((resolve,reject)=>{
        const writing=method!=='get',tx=database.transaction('workspace',writing?'readwrite':'readonly'),store=tx.objectStore('workspace'),req=store.get('main');let result,error
        req.onsuccess=()=>{try{const state=req.result || freshWorkspace();result=routeRequest(state,method,path,body,params,prepared,now);if(path==='/profile'&&method==='put')state.profileSaved=true;if(writing)store.put(state,'main')}catch(e){error=e;tx.abort()}}
        tx.oncomplete=()=>resolve(structuredClone(result));tx.onabort=()=>reject(error || new Error('Your changes were not saved. Device storage may be full.'));tx.onerror=()=>{}
    })
}
