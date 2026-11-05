import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, Circle, Square, Play } from 'lucide-react'
import axios from 'axios'
import { useReducedMotion } from 'motion/react'
import { API_URL } from '../config'
import { useWorkspace } from './WorkspacePreferences'
import { calendarCells, snakeRoute } from '../utils/activityCalendar'
import { rhythmStats } from '../utils/profile'

export default function ActivityCalendar({ onSummary }) {
    const { profile, timezone } = useWorkspace()
    const reduced = useReducedMotion()
    const [summary, setSummary] = useState(null)
    const [year, setYear] = useState(new Date().getFullYear())
    const [selected, setSelected] = useState('')
    const [history, setHistory] = useState(null)
    const [error, setError] = useState('')
    const [replaying, setReplaying] = useState(false)
    const [position, setPosition] = useState(-1)
    const [loadingMore, setLoadingMore] = useState(false)
    const [historyError, setHistoryError] = useState('')
    const [retryHistory, setRetryHistory] = useState(0)
    const [retrySummary, setRetrySummary] = useState(0)
    const cellButtons = useRef([])
    useEffect(() => { onSummary?.(summary) }, [summary, onSummary])
    useEffect(() => {
        const controller = new AbortController()
        setReplaying(false); setPosition(-1); setSummary(null); setError('')
        axios.get(`${API_URL}/activity`, { params: { timezone, year }, signal: controller.signal })
            .then(({ data }) => { setSummary(data); setSelected(current => current.startsWith(String(year)) ? current : data.today.startsWith(String(year)) ? data.today : `${year}-01-01`) })
            .catch(err => { if (!axios.isCancel(err)) setError('Activity could not be loaded. Your work is still saved in your roadmap.') })
        return () => controller.abort()
    }, [timezone, year, retrySummary])
    useEffect(() => {
        if (!selected) return
        const controller = new AbortController()
        setHistory(null); setHistoryError('')
        axios.get(`${API_URL}/activity/${selected}`, { signal: controller.signal })
            .then(({ data }) => setHistory(data))
            .catch(err => { if (!axios.isCancel(err)) setHistoryError('This day’s history could not be loaded.') })
        return () => controller.abort()
    }, [selected, retryHistory])
    const cells = useMemo(() => calendarCells(year, profile.week_start, summary?.days || []), [year, profile.week_start, summary?.days])
    const route = useMemo(() => snakeRoute(cells), [cells])
    useEffect(() => {
        if (!replaying || reduced || profile.reduced_motion || !route.length) return
        let step = -1
        const timer = window.setInterval(() => {
            if (++step >= route.length + 5) { setReplaying(false); setPosition(-1); return }
            setPosition(step)
        }, Math.max(18, Math.min(140, 5500 / route.length)))
        const stop = () => { if (document.hidden) { setReplaying(false); setPosition(-1) } }
        document.addEventListener('visibilitychange', stop)
        return () => { window.clearInterval(timer); document.removeEventListener('visibilitychange', stop) }
    }, [replaying, reduced, profile.reduced_motion, route])
    useEffect(() => { if (reduced || profile.reduced_motion) { setReplaying(false); setPosition(-1) } }, [reduced, profile.reduced_motion])
    const tail = new Map(route.slice(Math.max(0, position - 4), position + 1).map((index, order) => [index, order]))
    async function loadMore() {
        if (history?.next_offset == null || loadingMore) return
        const day = selected
        setLoadingMore(true)
        try {
            const { data } = await axios.get(`${API_URL}/activity/${day}`, { params: { offset: history.next_offset } })
            setHistory(current => current?.date === day ? { ...data, items: [...current.items, ...data.items] } : current)
        } catch { setError('More activity could not be loaded. Try again.') }
        finally { setLoadingMore(false) }
    }
    const labels = profile.week_start === 'monday' ? ['M', 'T', 'W', 'T', 'F', 'S', 'S'] : ['S', 'M', 'T', 'W', 'T', 'F', 'S']
    const rhythm = rhythmStats(summary?.recent_days || [], profile.weekly_goal)
    function moveDate(event, index) {
        const delta = { ArrowUp: -1, ArrowDown: 1, ArrowLeft: -7, ArrowRight: 7 }[event.key]
        if (!delta) return
        event.preventDefault()
        const next = index + delta
        if (!cells[next]?.date) return
        setSelected(cells[next].date); setReplaying(false); setPosition(-1)
        cellButtons.current[next]?.focus()
    }
    return <section className="activity-section" aria-labelledby="activity-title">
        <header className="activity-heading"><div><span className="eyebrow">Every small step leaves a trace</span><h2 id="activity-title">Your consistency</h2></div>
            <label className="activity-year">Year<select aria-label="Activity year" value={year} onChange={event => setYear(Number(event.target.value))}>
                {[...new Set([year, ...(summary?.years || [new Date().getFullYear()])])].sort((a, b) => b - a).map(value => <option key={value}>{value}</option>)}
            </select></label></header>
        {error && <div className="inline-error" role="alert"><p>{error}</p><button type="button" className="btn-secondary" onClick={() => setRetrySummary(value => value + 1)}>Retry activity</button></div>}
        <div className="rhythm-banner"><div><span className="eyebrow">Last seven days</span><strong>{summary ? `${rhythm.active} of ${profile.weekly_goal} active days` : 'Loading your rhythm…'}</strong><p>{rhythm.active >= profile.weekly_goal ? 'Your personal target, reached. Make room for a breather.' : 'A little progress, on the days that work for you.'}</p></div><div className="rhythm-days" aria-label="Activity in the last seven days">{(summary?.recent_days || []).map(day => <span key={day.date} className={day.count ? 'rhythm-day active' : 'rhythm-day'} title={`${day.date}: ${day.count} completed`}><i aria-hidden="true">{day.count ? <Check size={13} /> : null}</i><small>{new Date(`${day.date}T12:00:00`).toLocaleDateString(undefined, { weekday: 'narrow' })}</small><span className="sr-only">{day.date}: {day.count} tasks completed</span></span>)}</div></div>
        <div className="streak-stats"><div><strong>{summary?.current_streak ?? '—'}</strong><span>day streak · now</span></div><div><strong>{summary?.longest_streak ?? '—'}</strong><span>longest streak · all time</span></div><div><strong>{summary?.active_days ?? '—'}</strong><span>active days · all time</span></div><div><strong>{summary?.total_completions ?? '—'}</strong><span>tasks checked off · all time</span></div></div>
        <div className="contribution-frame"><div className="contribution-scroll">
            <div className="contribution-labels" aria-hidden="true">{labels.map((label, index) => <span key={index}>{index % 2 === 0 ? label : ''}</span>)}</div>
            <div className="contribution-calendar"><div className="contribution-months" aria-hidden="true">{cells.flatMap((cell, index) => cell.date?.endsWith('-01') ? [<span key={cell.date} style={{ gridColumn: Math.floor(index / 7) + 1 }}>{new Date(`${cell.date}T12:00:00`).toLocaleDateString(undefined, { month: 'short' })}</span>] : [])}</div><div className="contribution-grid" aria-label={`${year} daily activity`}>
                {cells.map((cell, index) => cell.date ? <button key={cell.date} type="button" className={`contribution-cell level-${Math.min(4, cell.count)} ${selected === cell.date ? 'selected' : ''} ${tail.has(index) ? 'snake-segment' : ''} ${route[position] === index ? 'snake-head' : ''}`}
                    ref={element => { cellButtons.current[index] = element }} tabIndex={selected === cell.date ? 0 : -1} onKeyDown={event => moveDate(event, index)}
                    aria-label={`${cell.date}: ${cell.count} ${cell.count === 1 ? 'task' : 'tasks'} completed`} aria-pressed={selected === cell.date}
                    title={`${cell.date} · ${cell.count} completed`} onClick={() => { setSelected(cell.date); setReplaying(false); setPosition(-1) }} />
                    : <span key={`padding-${index}`} className="contribution-padding" />)}
            </div>
        </div></div><div className="contribution-footer"><small>{summary?.days.reduce((total, day) => total + day.count, 0) || 0} completions in {year}</small><span>Less <i className="level-0" /><i className="level-1" /><i className="level-2" /><i className="level-3" /><i className="level-4" /> More</span></div></div>
        <div className="snake-controls"><button type="button" className="btn-secondary" disabled={!route.length || reduced || profile.reduced_motion} onClick={() => { setPosition(-1); setReplaying(current => !current) }}>
            {replaying ? <Square size={14} /> : <Play size={14} />}{replaying ? 'Stop snake' : 'Replay snake'}</button>
            <p>{summary?.active_days ? 'A little replay of the work you’ve recorded. Select a date to see what you did.' : 'Check off your first task to begin. Imported checkmarks don’t count as past activity.'}</p></div>
        <section className="day-history" aria-labelledby="day-history-title"><label className="history-date-picker">View a day<input type="date" value={selected} min={`${year}-01-01`} max={`${year}-12-31`} onChange={event => { if (event.target.value) setSelected(event.target.value) }} /></label><header><h3 id="day-history-title">{selected ? new Date(`${selected}T12:00:00`).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : 'Daily history'}</h3><small>{history?.total || 0} recorded actions</small></header>
            {historyError ? <div role="alert"><p>{historyError}</p><button type="button" className="btn-secondary" onClick={() => setRetryHistory(value => value + 1)}>Retry this day</button></div> : !history ? <p role="status">Loading this day…</p> : !history.items.length ? <p>No activity recorded on this day. A small step is a good place to start.</p> : <ul>{history.items.map(item => <li key={item.id}>
                {item.is_done ? <Check size={16} /> : <Circle size={16} />}<div><strong>{item.title}</strong><small>{item.roadmap} · {item.timeframe}{!item.is_done ? ' · Reopened' : ''}</small></div>
                <time dateTime={item.occurred_at}>{new Date(item.occurred_at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', timeZone: timezone })}</time>
            </li>)}</ul>}
            {history?.next_offset != null && <button type="button" className="btn-quiet" onClick={loadMore} disabled={loadingMore}>{loadingMore ? 'Loading…' : 'Show more activity'}</button>}
        </section>
        <p className="activity-footnote">History starts when you check off work in Traqu. Same-day undo removes that task’s credit; reopening on a later day keeps the earlier record. Dates use {timezone}.</p>
    </section>
}
