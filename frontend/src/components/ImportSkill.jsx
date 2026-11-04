import { useState } from 'react'
import { ArrowDownToLine, Check, ChevronDown, Copy, Sparkles } from 'lucide-react'
import skill from '../../public/agents/SKILL.md?raw'

export default function ImportSkill() {
    const [copied, setCopied] = useState(false)
    const [copyError, setCopyError] = useState(false)

    async function copySkill() {
        try {
            await navigator.clipboard.writeText(skill)
            setCopied(true)
            setCopyError(false)
        } catch {
            setCopied(false)
            setCopyError(true)
        }
    }

    return (
        <details className="import-skill">
            <summary>
                <Sparkles size={16} aria-hidden="true" />
                <span><strong>AI agent skill</strong><small>Help your AI make a plan that fits Traqu.</small></span>
                <ChevronDown size={15} className="skill-chevron" aria-hidden="true" />
            </summary>
            <div className="import-skill-content">
                <p>Copy this skill into ChatGPT, Claude, Gemini, or your coding agent, then add your goals and schedule. Ask for JSON for the most reliable import, with a matching PDF if you want one to read.</p>
                <div className="import-skill-actions">
                    <button type="button" className="btn-secondary" onClick={copySkill}>
                        {copied ? <Check size={14} /> : <Copy size={14} />}{copied ? 'Skill copied' : 'Copy skill'}
                    </button>
                    <a className="btn-quiet" href="/agents/SKILL.md" download="SKILL.md"><ArrowDownToLine size={14} />Download SKILL.md</a>
                </div>
                <p className="skill-copy-status" role="status">{copyError ? 'Copy is unavailable. Select the skill below and copy it manually.' : copied ? 'Paste it into your AI tool before asking it to create your plan.' : 'Available offline. Share the format, then bring your finished plan back here.'}</p>
                <label className="skill-text-label" htmlFor="import-agent-skill">Skill instructions</label>
                <textarea id="import-agent-skill" value={skill} readOnly rows={8} spellCheck={false} />
            </div>
        </details>
    )
}
