import test from 'node:test'
import assert from 'node:assert/strict'
import { buildAIHandoff } from './aiHandoff.js'
test('handoff keeps day mappings, dates, real status and task context, excluding profile and raw document fields', () => {
    const text = buildAIHandoff('# Daily instructions', {name:'Vectors', avatar:'private-photo', raw_text:'private-source'}, [{id:7,label:'Day 1',start_date:'2026-11-11',end_date:'2026-11-11'}], [{id:22,owner:'private-owner',title:'Solve arrays',timeframe_id:7,is_done:true,properties:{Duration:'30m'},blocks:[{id:33,type:'note',data:{text:'https://example.com/concept'}}]}])
    assert.ok(text.includes('2026-11-11'))
    assert.ok(text.includes('https://example.com/concept'))
    assert.ok(text.includes('"is_done": true'))
    assert.ok(text.includes('"timeframe_id": 7'))
    assert.ok(text.includes('does not') || text.includes('Do not claim'))
    for(const secret of ['private-photo','private-source','private-owner']) assert.ok(!text.includes(secret))
    assert.ok(!buildAIHandoff('guide only').includes('SNAPSHOT'))
})
test('oversized handoffs fail with an actionable alternative instead of silently truncating tasks', () => {
    assert.throws(() => buildAIHandoff('x'.repeat(400001)), /Export the roadmap as JSON/)
})
