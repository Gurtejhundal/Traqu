import { parseRoadmapText } from '../utils/roadmapParser.js'

const dayPattern = /^(?:\d{4}-\d{2}-\d{2}.*?\b)?Day\s*0*(\d+)\b/i
const checkbox = /^(?:[-*+]\s*)?\[([ xX])\]\s*(.+)$/
const plain = line => line.replace(/^#{1,6}\s*/, '').trim()

export function validateTasks(tasks) {
    if (!Array.isArray(tasks) || tasks.length > 5000) throw new Error('A roadmap supports at most 5000 tasks.')
    return tasks.map(task => {
        if (!task || typeof task.title !== 'string' || !task.title.trim() || task.title.length > 4000) throw new Error('Each task needs a title, at most 4000 characters.')
        if (typeof task.timeframe !== 'string' || task.timeframe.length > 500) throw new Error('Each task needs a section label, at most 500 characters.')
        for (const field of ['start_date','end_date']) if (task[field] && (!/^\d{4}-\d{2}-\d{2}$/.test(task[field]) || new Date(task[field]+'T12:00:00Z').toISOString().slice(0,10) !== task[field])) throw new Error('Use valid dates in YYYY-MM-DD format.')
        if (task.start_date && task.end_date && task.end_date < task.start_date) throw new Error('The end date must follow the start date.')
        if (task.blocks && (!Array.isArray(task.blocks) || task.blocks.length > 500)) throw new Error('Too many task blocks.')
        return { ...task, title:task.title.trim(), is_done:Boolean(task.is_done), properties:task.properties && typeof task.properties==='object' && !Array.isArray(task.properties) ? task.properties : {}, blocks:(task.blocks || []).map((b,i) => ({...b,position:i})) }
    })
}

export function previewText(text) {
    if (typeof text !== 'string' || text.length > 8*1024*1024) throw new Error('Import a document up to 8 MB.')
    let parsed
    if (/^\s*[{[]/.test(text)) {
        try { parsed=JSON.parse(text) } catch { throw new Error('This JSON file is invalid. Check it and try again.') }
    }
    if (parsed?.format==='traqu-workspace') {
        if (!Array.isArray(parsed.roadmaps) || parsed.roadmaps.length>100) throw new Error('Invalid workspace backup.')
        const records=parsed.roadmaps.map(r=>({...r,tasks:validateTasks(r.tasks)}))
        return {kind:'workspace',text,tasks:[],document:[],warnings:[],roadmaps:records.map(r=>({name:r.name,tasks:r.tasks.length})),summary:{tasks:records.reduce((n,r)=>n+r.tasks.length,0),sections:0,dated_tasks:records.reduce((n,r)=>n+r.tasks.filter(t=>t.start_date).length,0)}}
    }
    let tasks=[];let document=[]
    if (parsed) { tasks=validateTasks(Array.isArray(parsed)?parsed:parsed.tasks);document=Array.isArray(parsed.document)?parsed.document:[] }
    else {
        let week='',label='',day='',date='',last=null,fence=false
        const lines=text.split(/\r?\n/)
        for (const raw of lines) {
            if (/^\s*(```|~~~)/.test(raw)) {fence=!fence;continue}
            if (fence) continue
            const line=raw.trim(),heading=plain(line)
            if (/^Week\s+\d+\b/i.test(heading)) {week=heading;document.push({type:'heading',level:1,text:heading});last=null;continue}
            const match=heading.match(dayPattern)
            if (match) {day=Number(match[1]);date=heading.match(/\b\d{4}-\d{2}-\d{2}\b/)?.[0] || '';label=`${week || 'Plan'} / Day ${day}${date ? ' - '+date : ''}`;last=null;document.push({type:'heading',level:2,text:heading});continue}
            const check=line.match(checkbox)
            if (check && label) {
                last={title:check[2],timeframe:label,granularity:'day',is_done:check[1].toLowerCase()==='x',properties:{Week:week,Day:day},blocks:[],...(date?{start_date:date,end_date:date}:{})};tasks.push(last);document.push({type:'paragraph',text:line});continue
            }
            if (last && line) {
                document.push({type:'paragraph',text:line})
                if (/^(Time|Duration|Priority|Optional|Timezone):/i.test(line)) {
                    for (const part of line.split('|')) {const i=part.indexOf(':');if(i>0)last.properties[part.slice(0,i).trim()]=part.slice(i+1).trim()}
                } else {if (!last.blocks.length)last.blocks.push({type:'note',position:0,data:{text:line}});else last.blocks[0].data.text+='\n'+line}
            }
        }
        if (!tasks.length) { tasks=parseRoadmapText(text).map(t=>({...t,properties:{},blocks:[]}));document=[{type:'paragraph',text}] }
        tasks=validateTasks(tasks)
    }
    return {text,tasks,document,warnings:tasks.length?[]:['No checkboxes found. The document can still be kept as reference.'],summary:{tasks:tasks.length,sections:new Set(tasks.map(t=>`${t.timeframe_id || t.section_key || ''}|${t.timeframe}`)).size,dated_tasks:tasks.filter(t=>t.start_date).length,completed_tasks:tasks.filter(t=>t.is_done).length}}
}

export async function previewFile(file) {
    if (!file || file.size>8*1024*1024) throw new Error('Choose a document up to 8 MB.')
    const extension=file.name.split('.').at(-1).toLowerCase()
    if (extension==='pdf') {
        const pdfjs=await import('pdfjs-dist/legacy/build/pdf.mjs');const worker=await import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url');pdfjs.GlobalWorkerOptions.workerSrc=worker.default
        const pdf=await pdfjs.getDocument({data:new Uint8Array(await file.arrayBuffer()),isEvalSupported:false,stopAtErrors:true}).promise
        try {
            if (pdf.numPages>250) throw new Error('PDFs support at most 250 pages.')
            const lines=[]
            for(let n=1;n<=pdf.numPages;n++) {
                const page=await pdf.getPage(n),content=await page.getTextContent();let y=null,row=''
                for(const item of content.items) {if(!('str' in item))continue;if(y!==null && Math.abs(item.transform[5]-y)>3){lines.push(row);row=''}row+=(row?' ':'')+item.str;y=item.transform[5];if(item.hasEOL){lines.push(row);row='';y=null}}
                if(row)lines.push(row);page.cleanup()
                if(lines.length>50000)throw new Error('This PDF contains too much text. Import the JSON sidecar instead.')
            }
            const p=previewText(lines.join('\n'));p.warnings.push('Android extracts selectable PDF text. For tables or complex layouts, use the matching Traqu JSON for the most accurate import.');return p
        } finally {await pdf.destroy()}
    }
    if(extension==='docx') {const {extractRawText}=await import('mammoth/mammoth.browser');const result=await extractRawText({arrayBuffer:await file.arrayBuffer()});const p=previewText(result.value);p.warnings.push('DOCX is imported as text on Android. Review table rows before importing.');return p}
    if (['yaml','yml'].includes(extension)) {const {parse}=await import('yaml');return previewText(JSON.stringify(parse(await file.text(),{maxAliasCount:20})))}
    if(extension==='csv') throw new Error('For Android, export this plan as Traqu JSON or Markdown first. CSV import is available in the desktop app.')
    return previewText(await file.text())
}
