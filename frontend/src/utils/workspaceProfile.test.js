import test from 'node:test'
import assert from 'node:assert/strict'
import { profileDefaults, inboxItems, localClock, dismissedNotifications } from './workspaceProfile.js'
test('inbox uses timezone, opt-in and persisted dismissals without daily duplicates', () => {
    const now=new Date('2026-11-12T13:30:00Z')
    assert.deepEqual(localClock(now,'Asia/Kolkata'),{day:'2026-11-12',time:'19:00'})
    assert.deepEqual(inboxItems(profileDefaults,now,'Asia/Kolkata').map(x=>x.id),['ai-connection'])
    const p={...profileDefaults,reminder_enabled:true,notifications_seen:['ai-connection']}
    assert.deepEqual(inboxItems(p,now,'Asia/Kolkata').map(x=>x.id),['daily-2026-11-12'])
    assert.equal(inboxItems({...p,notifications_seen:[...p.notifications_seen,'daily-2026-11-12']},now,'Asia/Kolkata').length,0)
    assert.equal(inboxItems(p,new Date('2026-11-12T13:29:00Z'),'Asia/Kolkata').length,0)
    assert.equal(inboxItems(p,new Date('2026-11-12T13:30:00Z'),'UTC').length,0)
})

test('pruning old daily notices keeps the AI suggestion dismissed permanently', () => {
    const previous=['ai-connection',...Array.from({length:39},(_,i)=>`daily-2026-10-${String(i+1).padStart(2,'0')}`)]
    const next=dismissedNotifications(previous,['daily-2026-11-12'])
    assert.equal(next.length,40)
    assert.equal(next[0],'ai-connection')
    assert.equal(next.at(-1),'daily-2026-11-12')
})
