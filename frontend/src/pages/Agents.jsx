import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowDownToLine, ArrowRight, Check, Copy, FileJson, FileText, Sparkles } from 'lucide-react'

const prompt = `Create a roadmap I can import into Traqu. Follow the Traqu roadmap skill at https://traqu.vercel.app/agents/SKILL.md. Use the dates, goals, and available time I provide; do not invent them. Return a valid JSON file with a tasks array. Give each task a clear title, consistent timeframe, granularity, is_done boolean, properties, and blocks. Use start_date/end_date in YYYY-MM-DD only when known. Keep time slots, durations, timezone, and optional status in properties; explanations in note blocks. If you also create a PDF, use selectable text and supply a matching JSON sidecar. Validate dates and compare task counts before delivery.`
const preview = `{
  "title": "Build one small feature",
  "timeframe": "Week 1 / Day 1",
  "granularity": "day",
  "start_date": "2026-11-02",
  "end_date": "2026-11-02",
  "is_done": false,
  "properties": {
    "Duration": "30 min"
  },
  "blocks": []
}`

export default function Agents() {
    const [copied, setCopied] = useState(false)
    const [copyError, setCopyError] = useState('')
    async function copyPrompt() {
        try { await navigator.clipboard.writeText(prompt); setCopied(true); setCopyError('') }
        catch { setCopyError('Copy is unavailable here. Select the prompt below to copy it manually.') }
    }
    return (
        <main className="guide-page">
            <header className="guide-hero">
                <span className="eyebrow"><Sparkles size={13} /> For you and your AI agent</span>
                <h1>A better plan.<br /><span>A cleaner import.</span></h1>
                <p>Give your agent a shared format. Keep the dates, the detail, and the next step together when a plan lands in Traqu.</p>
                <div className="guide-hero-actions"><a href="/agents/SKILL.md" download="SKILL.md" className="btn-primary"><ArrowDownToLine size={15} /> Download the skill</a><button className="btn-secondary" onClick={copyPrompt}>{copied ? <Check size={15} /> : <Copy size={15} />}{copied ? 'Prompt copied' : 'Copy agent prompt'}</button></div>
                <p className="guide-caption" role="status">{copyError || (copied ? 'Paste it into your agent, then add your goals and available time.' : 'Works as instructions for ChatGPT, Claude, Gemini, and coding agents.')}</p>
            </header>
            <section className="agent-showcase">
                <div className="agent-flow"><span className="eyebrow">From conversation to action</span><h2>Keep the meaning.<br />Skip the cleanup.</h2><p>A task has a clear action. A day has a real date. Extra context has its own place.</p><ol><li><strong>Share the skill</strong><span>Give your agent the file or paste the prompt.</span></li><li><strong>Make your plan</strong><span>Use JSON for dates and rich metadata. Add a PDF for reading.</span></li><li><strong>Bring it to Traqu</strong><span>Import the file, review the sections, and start small.</span></li></ol><Link className="text-link" to="/import">Import your plan <ArrowRight size={15} /></Link></div>
                <div className="agent-code"><div><FileJson size={15} /><span>One task · JSON example</span><span className="code-dot" /></div><pre><code>{preview}</code></pre><p>Example date only. Your agent should use your confirmed schedule.</p></div>
            </section>
            <div className="guide-template-grid">
                <a href="/agents/roadmap-example.json" download><FileJson size={22} /><h2>The precise version</h2><p>JSON keeps dates, notes, optional work, time slots, and completion state.</p><span>Download JSON template <ArrowDownToLine size={14} /></span></a>
                <a href="/agents/roadmap-example.md" download><FileText size={22} /><h2>The simple version</h2><p>Markdown uses clear headings and one checkbox per task. A single ISO date in a heading sets its day.</p><span>Download Markdown template <ArrowDownToLine size={14} /></span></a>
            </div>
            <section className="guide-note"><h2>Making a PDF? Give its structure room.</h2><p>Use selectable text, readable fonts, and one task per table row. For daily planners, keep weekdays and dates in a left column, and time slots in a separate task column. Repeat headers on new pages. Keep reference material separate.</p><p>Traqu uses a rules-based, layout-aware importer. The skill describes tested formats; it does not train an AI model. Scanned pages need OCR before import, and unusual layouts may still need review. A matching JSON file gives the most reliable result.</p></section>
            <details className="guide-prompt"><summary>Read or manually copy the agent prompt</summary><p>{prompt}</p></details>
            <footer className="guide-footer"><span>Good structure makes room for good work.</span><Link to="/downloads">Get the desktop app <ArrowRight size={14} /></Link></footer>
        </main>
    )
}
