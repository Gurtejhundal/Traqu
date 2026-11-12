import { useEffect, useState } from 'react'
import { ArrowRight, Check, Copy, Download, MessageSquare, Plug, ShieldCheck, Sparkles } from 'lucide-react'
import axios from 'axios'
import { Link } from 'react-router-dom'
import { API_URL } from '../config'
import { buildAIHandoff } from '../utils/aiHandoff'

import { clients, installSteps } from '../utils/agentSetup'
import TraquLogo from './TraquLogo'

export default function AIConnections() {
    const [client, setClient] = useState('codex')
    const [allowWrite, setAllowWrite] = useState(false)
    const [busy, setBusy] = useState(false)
    const [message, setMessage] = useState('')
    const [copyText, setCopyText] = useState('')
    const [plans, setPlans] = useState([])
    const [plan, setPlan] = useState('')
    const [configured, setConfigured] = useState('')
    const [workflow, setWorkflow] = useState('')
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
            else if (action === 'workflow') {
                if (!result.canceled) setWorkflow(client)
                setMessage(result.canceled ? 'Installation canceled.' : `Traqu’s ${result.kind} is installed. Restart ${label} to load it. MCP setup is separate.`)
            } else {
                if (!result.canceled) setConfigured(client)
                setMessage(result.canceled ? 'Setup canceled.' : `Settings saved for ${label} with ${allowWrite ? 'editing' : 'read-only'} access. Restart ${label}, then check its MCP tools. This has not tested a connection inside that app.`)
            }
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
    return <section className="ai-connection ai-studio" aria-labelledby="ai-connections-title">
        <header className="connection-intro"><div><span className="eyebrow">A little help along the way</span><h2 id="ai-connections-title">Your plan.<br /><span>Your AI, alongside.</span></h2><p>Choose where you think best. Bring your real roadmap into a coding agent, or take a prompt to any chat.</p></div><div className="connection-illustration" aria-hidden="true"><TraquLogo /><span className="connection-dots">······</span><Plug size={30} strokeWidth={1.2} /></div></header>
        <div className="connection-layout">
            <section className="connection-card" aria-labelledby="agent-card-title"><header><span className="connection-step">01</span><Plug size={19} /><span className="connection-tag">Live workspace</span></header><h3 id="agent-card-title">Connect your agent</h3><p>Let your AI see the day, the tasks and the progress you actually made.</p>
                <label className="ai-client-label">Your AI app<select aria-label="Your AI app" value={client} disabled={busy} onChange={event => { setClient(event.target.value); setMessage(''); setCopyText('') }}>{clients.map(([key, name]) => <option key={key} value={key}>{name}</option>)}</select></label>
                {desktop ? <><label className="connection-access"><div><strong>{allowWrite ? 'Read & edit' : 'Read only'}</strong><small>{allowWrite ? 'Can update tasks and notes when you ask.' : 'Can explore your plan. Changes stay off.'}</small></div><input aria-label="Allow edits to roadmaps and tasks" type="checkbox" checked={allowWrite} disabled={busy} onChange={event => { setAllowWrite(event.target.checked); setMessage(''); setCopyText(''); setConfigured('') }} /></label><button type="button" className="btn-primary connection-main-action" disabled={busy} onClick={() => configure('connect')}>{configured === client ? <Check size={15} /> : <Plug size={15} />}{configured === client ? `Configure ${label} again` : `Connect to ${label}`}</button><button type="button" className="btn-quiet" disabled={busy} onClick={() => configure('config')}><Copy size={14} />Copy configuration</button><details className="connection-details"><summary>How access works</summary><p>Setup backs up existing settings. Restart your AI app and approve its MCP tools. Settings saved here do not verify the connection inside that app. AI subscriptions and limits still apply.</p></details></> : <p className="connection-device-note">Live connections use Traqu’s desktop app. On this device, use the chat prompt below.</p>}
            </section>
            <section className="connection-card connection-workflow" aria-labelledby="plugin-card-title"><header><span className="connection-step">02</span><Sparkles size={19} /><span className="connection-tag">{clients.find(([key]) => key === client)[2]}</span></header><h3 id="plugin-card-title">Make Traqu feel at home</h3><p>{client === 'claude-desktop' ? 'Claude Desktop can use your live MCP tools. For reusable roadmap instructions, use Copy chat prompt below.' : `Add Traqu’s day-focused workflow to ${label}. ${client === 'codex' ? 'You’ll also get the Traqu name and logo in its plugin picker.' : 'Ask for your next unfinished day without explaining the format again.'}`}</p>
                <div className="plugin-preview"><TraquLogo /><div><strong>Traqu</strong><span>Your roadmaps. One day at a time.</span></div><span className="plugin-preview-mark">{clients.find(([key]) => key === client)[2]}</span></div>
                {installSteps[client] && <>{desktop && <button type="button" className="btn-secondary connection-main-action" disabled={busy} onClick={() => configure('workflow')}><Download size={15} />{workflow === client ? 'Install again' : `Install Traqu ${clients.find(([key]) => key === client)[2].toLowerCase()}`}</button>}<button type="button" className="btn-quiet" disabled={busy} onClick={() => copy(installSteps[client], 'Install steps copied. Run commands in your terminal; follow file instructions in your user home folder.')}><Copy size={14} />Copy install steps</button><p className="connection-footnote">Connect MCP first, then install this workflow. Restart {label} afterward. {client === 'codex' || client === 'claude-code' ? 'Automatic installation needs that app’s CLI on your system.' : 'Installs a local skill, not a marketplace listing or composer logo.'}</p></>}
                <div className="connection-example"><span>Try asking</span><p>“What’s my next unfinished day?”</p></div>
            </section>
        </div>
        <section className="connection-chat" aria-labelledby="chat-card-title"><div><MessageSquare size={21} /><span className="eyebrow">Works with free chats, too</span><h3 id="chat-card-title">Copy. Chat. Bring it back.</h3><p>Use ChatGPT, Claude or Gemini with a clear Traqu prompt. No live connection needed.</p><div className="chat-flow"><span>Copy prompt</span><ArrowRight size={13} /><span>Make your plan</span><ArrowRight size={13} /><Link to="/import">Import into Traqu</Link></div></div><div><label className="ai-client-label">Include a roadmap<select aria-label="Include a roadmap" value={plan} disabled={busy} onChange={event => { setPlan(event.target.value); setCopyText(''); setMessage('') }}><option value="">Instructions only · create a new plan</option>{plans.map(item => <option key={item.id} value={String(item.id)}>{item.name}</option>)}</select></label>{plansError && <p>Existing plans could not load. Instructions are still available.</p>}<button type="button" className="btn-secondary" disabled={busy} onClick={handoff}><Copy size={14} />Copy chat prompt</button><small>{plan ? 'Includes this plan’s tasks, dates and notes. Review before sharing.' : 'No profile, photo or activity history is copied.'} Imports create a new plan; they do not sync.</small></div></section>
        {(busy || message) && <p className="connection-feedback" role="status" aria-live="polite">{busy ? 'Preparing…' : message}</p>}
        {copyText && <details className="ai-copy-preview" open><summary>Review or copy the text</summary><textarea aria-label="AI connection text" value={copyText} readOnly rows={7} onFocus={event => event.target.select()} /></details>}
        <p className="connection-privacy"><ShieldCheck size={13} />You choose the access. Your AI provider handles the content you share with it.</p>
    </section>
}
