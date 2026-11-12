import { useRef, useState } from 'react'
import { ArrowRight, Camera, Check, UserRound } from 'lucide-react'
import axios from 'axios'
import { API_URL } from '../config'
import { useWorkspace } from './WorkspacePreferences'
import { Companion } from './MotionUI'
import { drawCrop, preparePhoto } from '../utils/profile'
import { INTERESTS } from '../utils/workspaceProfile'
import ReminderSettings from './ReminderSettings'

export default function QuickSetup() {
    const { profile, setProfile } = useWorkspace()
    const [draft, setDraft] = useState(profile)
    const [step, setStep] = useState(0)
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState('')
    const file = useRef(null)
    const heading = useRef(null)
    const change = (key, value) => setDraft(current => ({ ...current, [key]: value }))
    async function photo(event) {
        const selected = event.target.files?.[0]; event.target.value = ''
        if (!selected) return
        setBusy(true); setError('')
        let image
        try {
            image = await preparePhoto(selected)
            const canvas = document.createElement('canvas'); canvas.width = 256; canvas.height = 256
            drawCrop(canvas, image); change('avatar', canvas.toDataURL('image/jpeg', .88))
        } catch (err) { setError(err.message) }
        finally { image?.close(); setBusy(false) }
    }
    async function finish(skip = false) {
        setBusy(true); setError('')
        try {
            const next = skip ? profile : draft
            const { data } = await axios.put(`${API_URL}/profile`, { ...next, name: next.name.trim() || 'Your workspace', onboarding_completed: true })
            setProfile(data)
        } catch { setError('Setup could not be saved. Your choices are still here. Please try again.') }
        finally { setBusy(false) }
    }
    function move(next) { setStep(next); requestAnimationFrame(() => heading.current?.focus()) }
    return <main className="quick-setup">
        <div className="setup-brand"><img src="/traqu-mark.svg" alt="" width="28" height="28" /><strong>Traqu</strong><button type="button" className="btn-quiet" disabled={busy} onClick={() => finish(true)}>Set up later</button></div>
        <section className="setup-card" aria-label="Quick setup">
            <aside className="setup-companion"><span className="eyebrow">A little more you</span><Companion size={166} /><p>Big plans.<br />Small, steady steps.</p><div className="setup-dots" aria-label={`Step ${step + 1} of 3`}>{[0, 1, 2].map(n => <span key={n} className={n <= step ? 'filled' : ''} />)}</div></aside>
            <div className="setup-content"><span className="eyebrow">{['01 / Make yourself at home', '02 / Find your direction', '03 / Find your rhythm'][step]}</span>
                <h1 ref={heading} tabIndex={-1}>{['Hey, what should we call you?', 'What are you here for?', 'When’s a good time?'][step]}</h1>
                <p>{['A name and a face. Everything here is optional.', 'A few taps are enough. You can change these later.', 'No pressure. Just a gentle invitation to come back.'][step]}</p>
                <fieldset disabled={busy} className="setup-fields">
                    {step === 0 && <><button type="button" className="setup-avatar" onClick={() => file.current?.click()} aria-label="Choose setup photo">{draft.avatar ? <img src={draft.avatar} alt="Your chosen photo" /> : <UserRound size={32} />}<span><Camera size={13} /></span></button><input ref={file} className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" aria-label="Setup photo file" onChange={photo} /><label>What should we call you?<input autoComplete="nickname" maxLength={80} value={draft.name === 'Your workspace' ? '' : draft.name} placeholder="Your first name or nickname" onChange={event => change('name', event.target.value)} /></label><small>Photos are cropped to a square. Fine-tune yours later in Personalize.</small></>}
                    {step === 1 && <><span className="setup-label">Your interests</span><div className="interest-chips">{INTERESTS.map(interest => <button type="button" key={interest} aria-pressed={draft.interests.includes(interest)} onClick={() => change('interests', draft.interests.includes(interest) ? draft.interests.filter(x => x !== interest) : [...draft.interests, interest])}>{draft.interests.includes(interest) && <Check size={13} />}{interest}</button>)}</div><span className="setup-label">A starting goal</span><div className="setup-goals">{['Prepare for an internship', 'Build something meaningful', 'Make time for myself'].map(goal => <button key={goal} type="button" aria-pressed={draft.goal === goal} onClick={() => change('goal', goal)}>{goal}<ArrowRight size={15} /></button>)}</div></>}
                    {step === 2 && <ReminderSettings profile={draft} onChange={change} />}
                </fieldset>
                {error && <p className="inline-error" role="alert">{error}</p>}
                <footer className="setup-actions">{step > 0 && <button type="button" className="btn-quiet" disabled={busy} onClick={() => move(step - 1)}>Back</button>}<button type="button" className="btn-primary" disabled={busy} onClick={() => step < 2 ? move(step + 1) : finish()}>{busy ? 'Saving…' : step === 2 ? 'Make myself at home' : 'Continue'}<ArrowRight size={15} /></button></footer>
            </div>
        </section>
    </main>
}
