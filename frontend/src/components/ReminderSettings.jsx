import { useEffect, useState } from 'react'

export default function ReminderSettings({ profile, onChange }) {
    const [support, setSupport] = useState(null)
    const desktop = Boolean(window.traquDesktop?.notifications)
    useEffect(() => {
        let mounted = true
        if (desktop) window.traquDesktop.notifications().then(result => { if (mounted) setSupport(result) }).catch(() => { if (mounted) setSupport({ supported: false }) })
        return () => { mounted = false }
    }, [desktop])
    return <section className="reminder-settings" aria-labelledby="reminder-heading">
        <h3 id="reminder-heading">A little nudge, on your terms.</h3>
        <p>Pick a time for your daily reminder. You can change your mind anytime.</p>
        <label className="profile-inline-toggle"><span>Daily reminder in Traqu</span><input type="checkbox" checked={profile.reminder_enabled} onChange={event => onChange('reminder_enabled', event.target.checked)} /></label>
        {profile.reminder_enabled && <><label className="reminder-time">Remind me at<input aria-label="Reminder time" type="time" value={profile.reminder_time} onChange={event => onChange('reminder_time', event.target.value)} required /></label><small>Uses your profile timezone, or this device’s timezone.</small>
            {desktop && support?.supported !== false && <><label className="profile-inline-toggle"><span>Also send a desktop notification</span><input type="checkbox" checked={profile.desktop_notifications} onChange={event => onChange('desktop_notifications', event.target.checked)} /></label><small>While Traqu is open, including when minimized. Your system’s notification settings and Do Not Disturb still apply.{support?.requiresSignedApp && ' On macOS, a signed Traqu build is required for desktop delivery.'}</small></>}
            {desktop && support?.supported === false && <small>Desktop notifications are unavailable here. Your in-app reminder still works.</small>}
            {!desktop && <small>Reminders appear in Traqu’s notification inbox when you open the app. No background push notifications.</small>}
        </>}
    </section>
}
