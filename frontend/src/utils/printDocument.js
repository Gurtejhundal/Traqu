import { IS_MOBILE } from '../config'
import { createPrintHTML } from '../../../desktop/print.mjs'
import { documentElementToLines, formatSemanticValue, formatTaskBlockForText } from './taskSemantics.js'

export function exportDocumentData(snapshot) {
    const sections = []
    const byKey = new Map()
    ;(snapshot.tasks || []).forEach((task, index) => {
        const key = task.timeframe_id ?? task.section_key ?? `${task.timeframe}-${index}`
        if (!byKey.has(key)) {
            const section = { label: task.timeframe || 'General',
                schedule: [task.start_date, task.end_date].filter(Boolean).join(' to '), tasks: [] }
            sections.push(section)
            byKey.set(key, section)
        }
        byKey.get(key).tasks.push({ title: task.title, done: task.is_done,
            details: [
                ...Object.entries(task.properties || {}).map(([key, value]) => `${key}: ${formatSemanticValue(value)}`),
                ...(task.blocks || []).map(formatTaskBlockForText).filter(Boolean),
            ] })
    })
    return { name: snapshot.name, sections, source: (snapshot.document || []).flatMap(documentElementToLines) }
}

export async function savePrintablePDF(snapshot) {
    const payload = exportDocumentData(snapshot)
    if (IS_MOBILE) {
        const { registerPlugin } = await import('@capacitor/core')
        return registerPlugin('TraquFiles').print({ html: createPrintHTML(payload) })
    }
    if (window.traquDesktop?.savePDF) return window.traquDesktop.savePDF(payload)
    const frame = document.createElement('iframe')
    frame.title = 'Print roadmap'
    frame.style.cssText = 'position:fixed;width:1px;height:1px;left:-9999px;border:0;'
    document.body.append(frame)
    try {
        const printDocument = frame.contentDocument
        printDocument.open()
        printDocument.write(createPrintHTML(payload))
        printDocument.close()
        await printDocument.fonts.ready
        frame.contentWindow.addEventListener('afterprint', () => frame.remove(), { once: true })
        frame.contentWindow.focus()
        frame.contentWindow.print()
        // Some browsers never dispatch afterprint for a dismissed dialog.
        window.setTimeout(() => frame.remove(), 60_000)
    } catch (error) {
        frame.remove()
        throw error
    }
}
