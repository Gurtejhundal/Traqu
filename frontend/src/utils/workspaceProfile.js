export const INTERESTS = ['Coding', 'AI & ML', 'Design', 'Fitness', 'Reading', 'Career']
export const profileDefaults = { name: 'Your workspace', bio: '', goal: '', timezone: '', week_start: 'monday', compact: false, pet_motion: true, reduced_motion: false, avatar: '', avatar_shape: 'circle', avatar_monochrome: true, cover: 'paper', calendar_palette: 'graphite', weekly_goal: 5, return_note: '', onboarding_completed: false, interests: [], reminder_enabled: false, reminder_time: '19:00', desktop_notifications: false, notifications_seen: [] }

export function localClock(now, timezone) {
    const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: timezone || 'UTC', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(now).map(p => [p.type, p.value]))
    return { day: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}` }
}

export function inboxItems(profile, now, timezone) {
    const items = [{ id: 'ai-connection', title: 'Bring your AI along', text: 'Connect a coding agent, or copy a prompt for your favourite chat.', href: '/profile?tab=connections', action: 'Explore AI connections' }]
    const clock = localClock(now, timezone)
    if (profile.reminder_enabled && clock.time >= profile.reminder_time) items.unshift({ id: `daily-${clock.day}`, title: 'One small step today', text: 'Open your next unfinished day. A little progress counts.', href: '/', action: 'Open my roadmaps' })
    return items.filter(item => !(profile.notifications_seen || []).includes(item.id))
}

export function dismissedNotifications(previous, ids) {
    const seen = [...new Set([...previous, ...ids])]
    return [...(seen.includes('ai-connection') ? ['ai-connection'] : []), ...seen.filter(id => id !== 'ai-connection').slice(-39)]
}
