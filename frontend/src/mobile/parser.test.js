import test from 'node:test'
import assert from 'node:assert/strict'
import {previewText,validateTasks} from './parser.js'

test('malformed dates and task lists are rejected rather than silently shifted',()=>{
 assert.throws(()=>validateTasks([{title:'x',timeframe:'day',start_date:'2026-02-30'}]),/dates/)
 assert.throws(()=>previewText('{broken'),/JSON/)
 assert.throws(()=>validateTasks(Array(5001).fill({title:'x',timeframe:'Day 1'})),/5000/)
})
test('reference paragraphs and metadata do not create extra day tasks',()=>{
 const p=previewText('# Week 1\n## Day 1 - 2026-11-04\n- [ ] Topic - Arrays\nDuration: 20m\nA reference paragraph.\nhttps://example.com\n```cpp\n- [ ] not a task\n```\n## Day 2 - 2026-11-05\n- [ ] Question - LeetCode 1929')
 assert.equal(p.tasks.length,2);assert.equal(p.tasks[1].start_date,'2026-11-05');assert.ok(p.tasks[0].blocks[0].data.text.includes('reference paragraph'))
})
