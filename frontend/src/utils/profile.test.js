import test from 'node:test'
import assert from 'node:assert/strict'
import { cropGeometry, rhythmStats, preparePhoto } from './profile.js'

test('square crop stays inside wide and tall images at every control limit', () => {
    for (const [w, h] of [[900,300],[300,900],[256,256]]) for (const z of [1,2,3]) for (const x of [0,50,100]) for (const y of [0,50,100]) {
        const g = cropGeometry(w,h,z,x,y)
        assert.ok(g.sx >= 0 && g.sy >= 0 && g.sx + g.side <= w && g.sy + g.side <= h)
    }
})
test('rhythm counts real active days and caps the target percentage', () => {
    assert.deepEqual(rhythmStats([{count:0},{count:2},{count:3}],1), {active:2,total:5,percent:100})
    assert.deepEqual(rhythmStats([],5), {active:0,total:0,percent:0})
})
test('photo input rejects SVGs and oversized images before decoding', async () => {
    await assert.rejects(preparePhoto({type:'image/svg+xml',size:100}), /JPG/)
    await assert.rejects(preparePhoto({type:'image/png',size:9000000}), /8 MB/)
})
