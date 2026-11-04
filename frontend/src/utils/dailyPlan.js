export function buildDailyPlan(groupEntries, groupMeta = {}, timeframes = []) {
    const weeks = new Map(), days = new Map(), byGroup = {}
    for (const [group, tasks] of groupEntries) {
        const meta = groupMeta[group] || {}
        const frame = timeframes.find(item => Number(item.id) === Number(meta.timeframeId))
        const label = meta.timeframe || tasks[0]?.timeframe_label || 'Unassigned'
        const properties = tasks[0]?.properties || {}
        const dayMatch = label.match(/\bday\s*0*(\d+)\b/i)
        const propertyDay = Number(properties.Day)
        const dayNumber = dayMatch ? Number(dayMatch[1]) : Number.isInteger(propertyDay) && propertyDay > 0 ? propertyDay : null
        const suppliedDate = frame?.start_date || tasks[0]?.start_date || label.match(/\b\d{4}-\d{2}-\d{2}\b/)?.[0]
        const date = /^\d{4}-\d{2}-\d{2}$/.test(suppliedDate || '') ? suppliedDate : null
        if (dayNumber === null && !(frame?.granularity === 'day' && date)) continue
        const weekMatch = label.match(/\bweek\s*0*(\d+)[^/›]*/i)
        const weekTitle = String(properties.Week || weekMatch?.[0] || 'Your days').trim()
        const weekKey = `${meta.roadmap || ''}\0${weekTitle}`
        if (!weeks.has(weekKey)) weeks.set(weekKey, { key: weekKey, title: weekTitle, days: [], total: 0, done: 0 })
        const dayKey = `${weekKey}\0${dayNumber ?? date}\0${date || ''}`
        if (!days.has(dayKey)) {
            const item = { key: dayKey, title: dayNumber === null ? 'Day' : `Day ${dayNumber}`, number: dayNumber,
                date, week: weekTitle, groups: [], tasks: [], total: 0, done: 0 }
            days.set(dayKey, item); weeks.get(weekKey).days.push(item)
        }
        const day = days.get(dayKey)
        day.groups.push(group); day.tasks.push(...tasks); day.total += tasks.length
        day.done += tasks.filter(task => task.is_done).length
        byGroup[group] = day
        weeks.get(weekKey).total += tasks.length
        weeks.get(weekKey).done += tasks.filter(task => task.is_done).length
    }
    ;[...days.values()].forEach((day, index) => { if (day.number === null) { day.number = index + 1; day.title = `Day ${index + 1}` } })
    const references = groupEntries.filter(([group]) => !byGroup[group]).map(([group]) => ({ group, title: groupMeta[group]?.timeframe || group }))
    return { references, weeks: [...weeks.values()], days: [...days.values()], byGroup }
}

export function dayDate(value) {
    if (!value) return 'Date not set'
    const [year, month, day] = value.split('-').map(Number)
    return new Date(year, month - 1, day).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
}
