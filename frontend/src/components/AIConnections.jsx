import { useEffect, useState } from 'react'
import { Copy, Plug, ShieldCheck } from 'lucide-react'
import axios from 'axios'
import { Link } from 'react-router-dom'
import { API_URL } from '../config'
import { buildAIHandoff } from '../utils/aiHandoff'

const clients = [
    ['codex', 'Codex'], ['claude-desktop', 'Claude Desktop'], ['claude-code', 'Claude Code'],
    ['gemini-cli', 'Gemini CLI'], ['antigravity', 'Antigravity'], ['cursor', 'Cursor'],
]
export default function AIConnections() {
    const [client, setClient] = useState('codex')
    const [allowWrite, setAllowWrite] = useState(false)
    const [busy, setBusy] = useState(false)
    const [message, setMessage] = useState('')
    const [copyText, setCopyText] = useState('')
    const [plans, setPlans] = useState([])
    const [plan, setPlan] = useState('')
    const [plansError, setPlansError] = useState(false)
    const desktop = Boolean(window.traquDesktop?.aiConnection)
    const label = clients.find(([key]) => key === client)[1]
    useEffect(() => {
        const controller = new AbortController()
        axios.get(`${API_URL}/roadmaps`, { signal: controller.signal }).then(({ data }) => setPlans(data))
            .catch(err => { if (!axios.isCancel(err)) setPlansError(true) })
        return () => controller.abort()
    }, [])
    async function copy(text, success) {
        setCopyText(text)
        try { await navigator.clipboard.writeText(text); setMessage(success) }
        catch { setMessage('Clipboard access is unavailable. Select and copy the text below.') }
    }
    async function configure(action) {
        setBusy(true); setMessage(''); setCopyText('')
        try {
            const result = await window.traquDesktop.aiConnection({ client, allowWrite, action })
            if (action === 'config') await copy(JSON.stringify(result.config, null, 2), `Configuration copied. Merge its traqu entry into ${label}’s MCP settings, preserving your other servers.`)
            else setMessage(result.canceled ? 'Setup canceled.' : `Settings saved for ${label} with ${allowWrite ? 'editing' : 'read-only'} access. Restart ${label}, then check its MCP tools. This has not tested a connection inside that app.`)
        } catch (err) { setMessage(err.message || 'Setup could not finish. Try Copy configuration instead.') }
        finally { setBusy(false) }
    }
    async function handoff() {
        setBusy(true); setMessage(''); setCopyText('')
        try {
            const response = await fetch('/agents/SKILL.md')
            if (!response.ok) throw new Error('The roadmap instructions could not be loaded. Please try again.')
            const guide = await response.text()
            let text
            if (plan) {
                const [{ data: roadmap }, { data: sections }, { data: tasks }] = await Promise.all([
                    axios.get(`${API_URL}/roadmaps/${plan}`), axios.get(`${API_URL}/roadmaps/${plan}/timeframes`), axios.get(`${API_URL}/roadmaps/${plan}/tasks`),
                ])
                text = buildAIHandoff(guide, roadmap, sections, tasks)
            } else text = buildAIHandoff(guide)
            await copy(text, 'Prompt copied. Paste it into your chat, add your goal, dates and available time, then import the generated file into Traqu.')
        } catch (err) { setMessage(err.message || 'Could not prepare the prompt. Please try again.') }
        finally { setBusy(false) }
    }
    return <section className="ai-connection" aria-labelledby="ai-connections-title">
        <header className="profile-section-heading"><span className="eyebrow">AI connections</span><h2 id="ai-connections-title">Your plan, with your AI.</h2><p>Bring Traqu into a desktop agent, or take a clear prompt to the chat you already use.</p></header>
        <div className="profile-editor-columns">
            <section className="profile-editor-panel"><Plug size={20} aria-hidden="true" /><h3>Connect an agent</h3>
                {desktop ? <><label className="ai-client-label">Your AI app<select aria-label="Your AI app" value={client} disabled={busy} onChange={event => { setClient(event.target.value); setMessage(''); setCopyText('') }}>{clients.map(([key, name]) => <option key={key} value={key}>{name}</option>)}</select></label>
                    <label className="profile-inline-toggle"><span>Allow edits to roadmaps and tasks</span><input type="checkbox" checked={allowWrite} disabled={busy} onChange={event => { setAllowWrite(event.target.checked); setMessage(''); setCopyText('') }} /></label>
                    <div className="ai-actions"><button type="button" className="btn-secondary" disabled={busy} onClick={() => configure('connect')}>Connect to {label}</button><button type="button" className="btn-quiet" disabled={busy} onClick={() => configure('config')}><Copy size={14} />Copy configuration</button></div>
                    <p><ShieldCheck size={13} aria-hidden="true" /> Read-only by default. Your AI app must be installed separately. Its subscription, usage limits and permissions still apply. Setup backs up existing settings.</p>
                    <p>For another local MCP client, copy the configuration and add its <code>traqu</code> entry in that app’s settings.</p>
                </> : <p>Live local connections are available in Traqu’s desktop app. You can use the chat prompt below on this device.</p>}
            </section>
            <section className="profile-editor-panel"><Copy size={20} aria-hidden="true" /><h3>Use any chat, including free plans</h3><p>Works by copying and importing with ChatGPT, Claude or Gemini. It gives the chat a shared roadmap format; it does not give it live access to your workspace.</p>
                <label className="ai-client-label">Include a roadmap<select aria-label="Include a roadmap" value={plan} disabled={busy} onChange={event => { setPlan(event.target.value); setCopyText(''); setMessage('') }}><option value="">Instructions only · create a new plan</option>{plans.map(item => <option key={item.id} value={String(item.id)}>{item.name}</option>)}</select></label>
                {plansError && <p>Could not load existing roadmaps. You can still copy instructions for a new plan.</p>}
                <p>{plan ? 'The selected plan’s tasks, dates and attached context will be copied. Review the text before sharing it with your AI service.' : 'Only the roadmap format instructions are copied. No profile, photo or activity history is included.'}</p>
                <button type="button" className="btn-secondary" disabled={busy} onClick={handoff}><Copy size={14} />Copy chat prompt</button><p>Paste into your chat → download its JSON or Markdown → <Link to="/import">import into Traqu</Link>. Imports create a new plan; they do not update the original or sync automatically.</p>
            </section>
        </div>
        <p role="status" aria-live="polite">{busy ? 'Preparing your connection…' : message}</p>
        {copyText && <details className="ai-copy-preview"><summary>Review or copy the text</summary><textarea aria-label="AI connection text" value={copyText} readOnly rows={9} onFocus={event => event.target.select()} /></details>}
    </section>
}
