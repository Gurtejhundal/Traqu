import test from 'node:test'
import assert from 'node:assert/strict'
import { indexedDB } from 'fake-indexeddb'
import { freshWorkspace, routeRequest, prepareRequest, requestWorkspace } from './workspace.js'
import { previewText } from './parser.js'

globalThis.indexedDB=indexedDB
const source='# Week 1: Arrays\n## Day 1 - 2026-11-04\n- [ ] Learn vectors\nDuration: 20m\nhttps://example.com/lesson\n- [ ] Solve an array question\n## Day 2 - 2026-11-05\n- [ ] Review vectors'
const state=()=>{const s=freshWorkspace();const p=previewText(source);routeRequest(s,'post','/roadmaps/import',{...p,name:'My plan'});return s}

test('mobile Markdown keeps daily context and dates without making links into tasks',()=>{
 const p=previewText(source);assert.equal(p.tasks.length,3);assert.equal(p.summary.sections,2);assert.equal(p.tasks[0].start_date,'2026-11-04');assert.equal(p.tasks[0].properties.Week,'Week 1: Arrays');assert.equal(p.tasks[0].properties.Duration,'20m');assert.equal(p.tasks[0].blocks[0].data.text,'https://example.com/lesson')
})
test('mobile JSON retains duplicate section occurrences and note blocks',()=>{
 const s=freshWorkspace();routeRequest(s,'post','/roadmaps/import',{name:'Occurrences',tasks:[1,2].map(i=>({title:'Same title',timeframe:'Day 1',timeframe_id:i,blocks:[{type:'note',data:{text:'context'}}]}))});assert.equal(s.roadmaps[0].timeframes.length,2);assert.notEqual(s.roadmaps[0].tasks[0].timeframe_id,s.roadmaps[0].tasks[1].timeframe_id)
})
test('new imported checkmarks do not invent activity, and same-day undo removes credit',()=>{
 const s=state(),r=s.roadmaps[0],t=r.tasks[0],now=new Date('2026-11-05T10:00:00Z')
 assert.equal(routeRequest(s,'get','/activity',{}, {timezone:'Asia/Kolkata'}, {},now).total_completions,0)
 routeRequest(s,'put',`/tasks/${t.id}/status`,{is_done:true,timezone:'Asia/Kolkata'}, {},{},now)
 assert.equal(routeRequest(s,'get','/activity',{}, {}, {},now).current_streak,1)
 routeRequest(s,'put',`/tasks/${t.id}/status`,{is_done:false,timezone:'Asia/Kolkata'}, {},{},now)
 assert.equal(routeRequest(s,'get','/activity',{}, {}, {},now).total_completions,0)
})
test('later reopening preserves earlier activity across year boundaries',()=>{
 const s=state(),t=s.roadmaps[0].tasks[0]
 routeRequest(s,'put',`/tasks/${t.id}/status`,{is_done:true,timezone:'UTC'}, {},{},new Date('2026-12-31T10:00:00Z'))
 routeRequest(s,'put',`/tasks/${t.id}/status`,{is_done:false,timezone:'UTC'}, {},{},new Date('2027-01-01T10:00:00Z'))
 const a=routeRequest(s,'get','/activity',{}, {year:2027}, {},new Date('2027-01-01T10:00:00Z'));assert.equal(a.total_completions,1);assert.equal(a.current_streak,1);assert.equal(a.recent_days[5].count,1)
})
test('atomic persistence serializes concurrent changes, and a rejected batch changes nothing',async()=>{
 const p=previewText(source),r=await requestWorkspace('post','/roadmaps/import',{...p,name:'Atomic plan'}),tasks=await requestWorkspace('get',`/roadmaps/${r.id}/tasks`)
 await Promise.all(tasks.slice(0,2).map(t=>requestWorkspace('put',`/tasks/${t.id}/status`,{is_done:true})))
 assert.equal((await requestWorkspace('get',`/roadmaps/${r.id}/tasks`)).filter(t=>t.is_done).length,2)
 await assert.rejects(requestWorkspace('post',`/roadmaps/${r.id}/tasks/status`,{task_ids:[tasks[0].id,99999],is_done:false}),/belong/)
 assert.equal((await requestWorkspace('get',`/roadmaps/${r.id}/tasks`))[0].is_done,true)
})
test('backup restoration is additive, deduplicates real history and restores customization',()=>{
 const s=state(),t=s.roadmaps[0].tasks[0],now=new Date('2026-11-05T12:00:00Z')
 s.profile.name='Alex';s.profile.cover='ink'
 routeRequest(s,'put',`/tasks/${t.id}/status`,{is_done:true}, {},{},now)
 const backup=routeRequest(s,'get','/backup'),target=freshWorkspace()
 for(let i=0;i<2;i++)routeRequest(target,'post','/backup/restore-file',backup,{}, {},now)
 assert.equal(target.roadmaps.length,2);assert.equal(target.activity.length,1);assert.equal(target.profile.cover,'ink');assert.notEqual(target.roadmaps[0].tasks[0].id,target.roadmaps[1].tasks[0].id)
})
test('editor preserves identities and blocks, rejects stale revisions and records explicit completion',()=>{
 const s=state(),r=s.roadmaps[0],snapshot=routeRequest(s,'get',`/roadmaps/${r.id}/export`),tid=snapshot.tasks[0].id
 snapshot.tasks[0].title='Updated title';snapshot.tasks[0].is_done=true
 routeRequest(s,'put',`/roadmaps/${r.id}/smart`,snapshot)
 assert.equal(r.tasks[0].id,tid);assert.equal(r.tasks[0].blocks.length,1);assert.equal(s.activity.length,1)
 assert.throws(()=>routeRequest(s,'put',`/roadmaps/${r.id}/smart`,snapshot),/Reload/)
})
test('profile choices validate before persisting and library GET does not attempt to parse a body',async()=>{
 assert.throws(()=>routeRequest(freshWorkspace(),'put','/profile',{weekly_goal:0}),/1 to 7/)
 assert.throws(()=>routeRequest(freshWorkspace(),'put','/profile',{avatar:'https://example.com/photo.png'}),/photo/)
 assert.deepEqual(await prepareRequest('get','/roadmaps'),{body:undefined})
})
