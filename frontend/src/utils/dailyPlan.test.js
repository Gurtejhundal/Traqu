import test from 'node:test'
import assert from 'node:assert/strict'
import { buildDailyPlan } from './dailyPlan.js'
import { calendarCells, snakeRoute } from './activityCalendar.js'

test('day grouping keeps week, date, context and other sections separate', () => {
    const task = (id, done = false) => ({ id, is_done: done, properties: { Week: 'Week 1: C++', Day: 1 } })
    const entries = [['a', [task(1, true)]], ['b', [task(2)]], ['c', [{ id: 3, is_done: false }]], ['d', [{ id: 4, is_done: false }]]]
    const plan = buildDailyPlan(entries, { a: { timeframe: 'Week 1 / Day 1', timeframeId: 1 }, b: { timeframe: 'Week 1 / Day 1 / Review', timeframeId: 1 }, c: { timeframe: 'Week 2 / Day 1', timeframeId: 2 }, d: { timeframe: 'References' } }, [{ id: 1, start_date: '2026-11-04', granularity: 'day' }])
    assert.equal(plan.weeks.length, 2)
    assert.equal(plan.days.length, 2)
    assert.equal(plan.days[0].date, '2026-11-04')
    assert.equal(plan.days[0].total, 2)
    assert.equal(plan.days[0].done, 1)
    assert.deepEqual(plan.days[0].groups, ['a', 'b'])
    assert.equal(plan.references[0].title, 'References')
})

test('calendar respects leap years and the selected first weekday', () => {
    const leap = calendarCells(2024)
    assert.equal(leap.filter(item => item.date).length, 366)
    assert.equal(leap[0].date, '2024-01-01')
    assert.ok(leap.some(item => item.date === '2024-02-29'))
    const regular = calendarCells(2026, 'sunday')
    assert.equal(regular.filter(item => item.date).length, 365)
    assert.equal(regular.findIndex(item => item.date === '2026-01-01'), 4)
    assert.equal(regular.length % 7, 0)
})

test('snake follows adjacent grid cells through only recorded activity targets', () => {
    const cells = calendarCells(2026, 'monday', [{ date: '2026-01-01', count: 1 }, { date: '2026-03-15', count: 3 }, { date: '2026-12-31', count: 1 }])
    const route = snakeRoute(cells)
    assert.equal(cells[route[0]].date, '2026-01-01')
    assert.equal(cells[route.at(-1)].date, '2026-12-31')
    for (let i = 1; i < route.length; i++) {
        const a = route[i - 1], b = route[i]
        assert.equal(Math.abs(Math.floor(a / 7) - Math.floor(b / 7)) + Math.abs(a % 7 - b % 7), 1)
        assert.ok(b >= 0 && b < cells.length)
    }
    assert.deepEqual(snakeRoute(calendarCells(2026)), [])
})
