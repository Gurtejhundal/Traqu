import test from 'node:test'
import assert from 'node:assert/strict'
import { parseRoadmapText } from './roadmapParser.js'
import { prepareEditableRoadmap, mergeEditableRoadmap } from './editableRoadmap.js'

test('editor parser reads standard checked Markdown and numbered actions', () => {
    const tasks = parseRoadmapText('# Week 1\n- [x] Finished task\n- [ ] Remaining task\n1. Install Python\n2. Build a demo')
    assert.deepEqual(tasks.map(({ title, is_done }) => [title, is_done]), [
        ['Finished task', true], ['Remaining task', false], ['Install Python', false], ['Build a demo', false],
    ])
})

test('recurring actions survive even when they match the first line', () => {
    assert.deepEqual(parseRoadmapText('- Walk\n- Drink water\n- Walk').map(task => task.title), ['Walk', 'Drink water', 'Walk'])
})

test('editor markers carry stable task identities through a title edit', () => {
    const prepared = prepareEditableRoadmap({ tasks: [{ id: 42, title: 'Original', timeframe: 'Week 1', timeframe_id: 8, properties: {}, blocks: [] }] })
    const merged = mergeEditableRoadmap(prepared.text.replace('Original', 'Revised'), prepared.savedTasks, prepared.savedSections)
    assert.equal(merged[0].id, 42)
    assert.equal(merged[0].title, 'Revised')
})
