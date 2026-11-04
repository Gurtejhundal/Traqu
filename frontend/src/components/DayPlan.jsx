import { ArrowRight, CalendarDays, Check, ChevronRight, Folder, FolderOpen } from 'lucide-react'
import { dayDate } from '../utils/dailyPlan'

export function DayContents({ plan, activeDay, onSelect, query = '', onGroup }) {
    const search = query.trim().toLowerCase()
    return <div className="day-tree" aria-label="Weeks and days">
        {plan.weeks.map(week => {
            const days = week.days.filter(day => !search || `${week.title} ${day.title} ${day.date || ''}`.toLowerCase().includes(search))
            if (!days.length) return null
            return <details className="day-tree-week" key={week.key} open={Boolean(search) || week.key === plan.weeks[0].key || activeDay?.week === week.title}>
                <summary><FolderOpen size={15} /><span>{week.title}</span><small>{week.done}/{week.total}</small><ChevronRight size={13} /></summary>
                <div className="day-tree-children">{days.map(day => <button type="button" key={day.key}
                    className={`day-tree-leaf ${activeDay?.key === day.key ? 'active' : ''} ${day.total > 0 && day.done === day.total ? 'complete' : ''}`}
                    onClick={() => onSelect(day)} aria-current={activeDay?.key === day.key ? 'step' : undefined}>
                    {day.done === day.total ? <Check size={14} /> : <CalendarDays size={14} />}
                    <span><strong>{day.title}</strong><small>{dayDate(day.date)}</small></span><small>{day.done}/{day.total}</small>
                </button>)}</div>
            </details>
        })}
        {plan.references?.length > 0 && <details className="day-tree-week"><summary><Folder size={15} /><span>Other sections</span></summary>{plan.references.filter(item => !search || item.title.toLowerCase().includes(search)).map(item => <button type="button" className="day-tree-leaf" key={item.group} onClick={() => onGroup(item.group)}>{item.title}</button>)}</details>}
    </div>
}

export function DayCards({ plan, onSelect, visibleTasks }) {
    const visibleIds = new Set(visibleTasks.map(task => task.id))
    const next = plan.days.find(day => day.done < day.total)
    return <section className="daily-path" aria-label="Your daily plan">
        <header className="daily-path-heading"><div><span className="eyebrow">Small steps. Real progress.</span><h2>Your next day, made clear.</h2></div>
            {next && <button type="button" className="btn-primary" onClick={() => onSelect(next)}>{next.done ? 'Continue' : 'Start'} {next.title}<ArrowRight size={15} /></button>}
        </header>
        {plan.weeks.filter(week => week.days.some(day => day.tasks.some(task => visibleIds.has(task.id)))).map(week => <section key={week.key} className="day-week-section">
            <div className="day-week-heading"><Folder size={16} /><h3>{week.title}</h3><span>{week.days.filter(day => day.done === day.total).length}/{week.days.length} days complete</span></div>
            <div className="day-card-grid">{week.days.filter(day => day.tasks.some(task => visibleIds.has(task.id))).map(day => {
                const complete = day.total > 0 && day.done === day.total
                const nextTask = day.tasks.find(task => !task.is_done)
                return <button key={day.key} type="button" onClick={() => onSelect(day)} className={`day-card ${complete ? 'complete' : ''} ${next?.key === day.key ? 'next' : ''}`} aria-label={`Open ${week.title}, ${day.title}`}>
                    <span className="day-card-top"><CalendarDays size={17} /><small>{complete ? 'Complete' : day.done ? 'In progress' : 'Ready when you are'}</small>{complete && <Check size={15} />}</span>
                    <strong className="day-card-title">{day.title}</strong><time dateTime={day.date || undefined}>{dayDate(day.date)}</time>
                    <p>{nextTask?.title || 'A day well spent.'}</p>
                    <span className="day-card-progress"><i style={{ width: `${day.total ? day.done / day.total * 100 : 0}%` }} /></span>
                    <span className="day-card-bottom">{day.done}/{day.total} tasks<span>{complete ? 'Review day' : 'Open day'}<ArrowRight size={13} /></span></span>
                </button>
            })}</div>
        </section>)}
    </section>
}
