export function calendarCells(year, weekStart = 'monday', counts = []) {
    const byDate = new Map(counts.map(item => [item.date, item.count]))
    const first = new Date(Date.UTC(year, 0, 1))
    const padding = (first.getUTCDay() + (weekStart === 'monday' ? 6 : 0)) % 7
    const days = Math.round((Date.UTC(year + 1, 0, 1) - first.getTime()) / 86400000)
    const cells = Array.from({ length: padding }, () => ({ date: null, count: 0 }))
    for (let index = 0; index < days; index++) {
        const date = new Date(first.getTime() + index * 86400000).toISOString().slice(0, 10)
        cells.push({ date, count: byDate.get(date) || 0 })
    }
    while (cells.length % 7) cells.push({ date: null, count: 0 })
    return cells
}

export function snakeRoute(cells) {
    const targets = cells.flatMap((cell, index) => cell.count ? [index] : [])
    if (!targets.length) return []
    const route = [targets[0]]
    for (const target of targets.slice(1)) {
        let column = Math.floor(route.at(-1) / 7), row = route.at(-1) % 7
        const toColumn = Math.floor(target / 7), toRow = target % 7
        while (column !== toColumn) { column += Math.sign(toColumn - column); route.push(column * 7 + row) }
        while (row !== toRow) { row += Math.sign(toRow - row); route.push(column * 7 + row) }
    }
    return route
}
