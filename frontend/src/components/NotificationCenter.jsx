import { useEffect, useRef, useState } from 'react'
import { Bell, Check, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import axios from 'axios'
import { API_URL } from '../config'
import { useWorkspace } from './WorkspacePreferences'
import { dismissedNotifications, inboxItems } from '../utils/workspaceProfile'

export default function NotificationCenter() {
    const { profile, setProfile, ready, error: loadError, timezone } = useWorkspace()
    const [open, setOpen] = useState(false)
    const [now, setNow] = useState(() => new Date())
    const [error, setError] = useState('')
    const [busy, setBusy] = useState(false)
    const root = useRef(null)
    const trigger = useRef(null)
    useEffect(() => { const timer = setInterval(() => setNow(new Date()), 30000); return () => clearInterval(timer) }, [])
    useEffect(() => {
        if (!open) return
        root.current?.querySelector('.notification-panel button')?.focus()
        const close = event => { if (!root.current?.contains(event.target)) setOpen(false) }
        const escape = event => { if (event.key === 'Escape') { setOpen(false); trigger.current?.focus() } }
        document.addEventListener('pointerdown', close); document.addEventListener('keydown', escape)
        return () => { document.removeEventListener('pointerdown', close); document.removeEventListener('keydown', escape) }
    }, [open])
    async function dismiss(ids) {
        setBusy(true); setError('')
        try {
            const { data: latest } = await axios.get(`${API_URL}/profile`)
            const { data } = await axios.put(`${API_URL}/profile`, { ...latest, notifications_seen: dismissedNotifications(latest.notifications_seen || [], ids) })
            setProfile(data)
        } catch { setError('Could not dismiss this notification. Please try again.') }
        finally { setBusy(false) }
    }
    const items = ready && !loadError ? inboxItems(profile, now, timezone) : []
    return <div className="notification-center" ref={root}>
        <button type="button" className="notification-trigger" aria-label={items.length ? `Notifications, ${items.length} unread` : 'Notifications'} aria-expanded={open} aria-controls="notification-inbox" onClick={() => setOpen(value => !value)} ref={trigger}><Bell size={17} />{items.length > 0 && <i />}</button>
        {open && <section id="notification-inbox" className="notification-panel" aria-label="Notification inbox"><header><div><span className="eyebrow">A little nudge</span><h2>For you</h2></div><button type="button" className="btn-quiet" aria-label="Close notifications" onClick={() => { setOpen(false); trigger.current?.focus() }}><X size={16} /></button></header>
            {items.length ? items.map(item => <article key={item.id}><div className="notification-dot" /><div><h3>{item.title}</h3><p>{item.text}</p><Link className="text-link" to={item.href} onClick={() => setOpen(false)}>{item.action} →</Link></div><button type="button" className="btn-quiet" aria-label={`Dismiss ${item.title}`} disabled={busy} onClick={() => dismiss([item.id])}><Check size={15} /></button></article>) : <p className="notification-empty">All caught up. A little breathing room.</p>}
            {error && <p role="alert" className="inline-error">{error}</p>}
            <footer><Link to="/profile?tab=preferences" onClick={() => setOpen(false)}>Reminder settings</Link>{items.length > 0 && <button type="button" className="btn-quiet" disabled={busy} onClick={() => dismiss(items.map(item => item.id))}>Dismiss all</button>}</footer>
        </section>}
    </div>
}
