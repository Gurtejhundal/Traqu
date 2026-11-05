import { useEffect, useRef, useState } from 'react'
import { ArrowUpRight, Camera, Check, Download, ImagePlus, RotateCcw, Settings2, ShieldCheck, Sparkles, UserRound, X } from 'lucide-react'
import axios from 'axios'
import ActivityCalendar from '../components/ActivityCalendar'
import { Companion } from '../components/MotionUI'
import { useWorkspace } from '../components/WorkspacePreferences'
import ProfileCard from '../components/ProfileCard'
import { API_URL, IS_NATIVE } from '../config'
import { getApiErrorMessage } from '../utils/apiErrors'
import { drawCrop, preparePhoto } from '../utils/profile'

const views = [{ key: 'overview', label: 'Overview' }, { key: 'personalize', label: 'Personalize' }, { key: 'preferences', label: 'Preferences' }]
const toggles = [['compact', 'Compact task spacing', 'A little more room for your daily checklist.'], ['pet_motion', 'Qu’s movements & cursor gaze', 'A small companion, with a little personality.'], ['reduced_motion', 'Reduce motion', 'Steady poses and quieter transitions throughout Traqu.']]

function Choices({ label, options, value, onChange }) {
    return <fieldset className="profile-choices"><legend>{label}</legend><div>{options.map(([key, title]) => <button type="button" key={key} aria-pressed={value === key} className={`profile-choice ${value === key ? 'chosen' : ''}`} onClick={() => onChange(key)}><span className={`choice-sample sample-${key}`} aria-hidden="true" /><span>{title}</span>{value === key && <Check size={13} aria-hidden="true" />}</button>)}</div></fieldset>
}

export default function Profile() {
    const { profile, setProfile, ready, error: loadError, retry } = useWorkspace()
    const [draft, setDraft] = useState(profile)
    const [view, setView] = useState('overview')
    const [saving, setSaving] = useState(false)
    const [saved, setSaved] = useState(false)
    const [error, setError] = useState('')
    const [photoError, setPhotoError] = useState('')
    const [photo, setPhoto] = useState(null)
    const [reading, setReading] = useState(false)
    const [crop, setCrop] = useState({ zoom: 1, x: 50, y: 50 })
    const [summary, setSummary] = useState(null)
    const [cardOpen, setCardOpen] = useState(false)
    const fileInput = useRef(null)
    const cropCanvas = useRef(null)
    const uploadSequence = useRef(0)
    const dirty = JSON.stringify(draft) !== JSON.stringify(profile)
    useEffect(() => { setDraft(profile) }, [profile])
    useEffect(() => {
        if (!dirty) return
        const warn = event => { event.preventDefault(); event.returnValue = '' }
        const leaving = event => {
            if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return
            const anchor = event.target.closest('a[href]')
            if (!anchor || anchor.target === '_blank') return
            const next = new URL(anchor.href, window.location.href)
            if (next.pathname !== window.location.pathname && !window.confirm('Leave your profile without saving these changes?')) { event.preventDefault(); event.stopPropagation() }
        }
        window.addEventListener('beforeunload', warn)
        document.addEventListener('click', leaving, true)
        return () => { window.removeEventListener('beforeunload', warn); document.removeEventListener('click', leaving, true) }
    }, [dirty])
    useEffect(() => { if (photo && cropCanvas.current) drawCrop(cropCanvas.current, photo, crop.zoom, crop.x, crop.y) }, [photo, crop])
    useEffect(() => () => photo?.close(), [photo])
    useEffect(() => () => { uploadSequence.current++ }, [])
    const change = (key, value) => { setDraft(current => ({ ...current, [key]: value })); setSaved(false); setError('') }
    async function choosePhoto(event) {
        const file = event.target.files?.[0]; event.target.value = ''
        if (!file) return
        const sequence = ++uploadSequence.current
        setReading(true); setPhotoError('')
        try {
            const image = await preparePhoto(file)
            if (sequence !== uploadSequence.current) { image.close(); return }
            setCrop({ zoom: 1, x: 50, y: 50 }); setPhoto(image); setView('personalize')
        } catch (err) { if (sequence === uploadSequence.current) setPhotoError(err.message) }
        finally { if (sequence === uploadSequence.current) setReading(false) }
    }
    function usePhoto() { change('avatar', cropCanvas.current.toDataURL('image/jpeg', .88)); setPhoto(null) }
    async function save(event) {
        event.preventDefault()
        if (saving || photo || reading) return
        if (!draft.name.trim()) { setView('personalize'); setError('Give your profile a name.'); return }
        setSaving(true); setError(''); setSaved(false)
        try { const { data } = await axios.put(`${API_URL}/profile`, draft); setProfile(data); setSaved(true) }
        catch (err) { setError(getApiErrorMessage(err, 'Settings could not be saved. Your edits are still here.')) }
        finally { setSaving(false) }
    }
    const locked = !ready || saving || Boolean(loadError)
    return <main className="profile-page profile-studio" data-palette={draft.calendar_palette}>
        <header className="profile-intro"><span className="eyebrow">Your space, at your pace</span><p>Make yourself at home.</p></header>
        <section className={`profile-cover cover-${draft.cover}`} aria-label="Profile preview">
            <div className="profile-cover-copy"><span>ONE SMALL STEP. THEN ANOTHER.</span><p>{draft.return_note || 'You don’t have to do it all. Just come back.'}</p></div><Companion size={108} className="profile-qu" />
        </section>
        <section className="profile-identity">
            <button type="button" className={`profile-photo photo-${draft.avatar_shape} ${draft.avatar_monochrome ? 'photo-mono' : ''}`} onClick={() => { setView('personalize'); fileInput.current?.click() }} disabled={locked || reading} aria-label="Change profile photo">
                {draft.avatar ? <img src={draft.avatar} alt="Your profile" /> : <UserRound size={37} strokeWidth={1.25} aria-hidden="true" />}<span className="photo-camera"><Camera size={13} /></span>
            </button>
            <div className="profile-identity-copy"><div className="profile-name-line"><h1>{draft.name}</h1>{dirty && <span className="draft-chip">Preview</span>}</div><p>{draft.bio || 'A little more consistent. A little more you.'}</p></div>
            <button type="button" className="btn-secondary" onClick={() => setView(view === 'personalize' ? 'overview' : 'personalize')}><Settings2 size={14} />{view === 'personalize' ? 'Back to overview' : 'Personalize'}</button>
        </section>
        <nav className="profile-view-nav" aria-label="Profile sections">{views.map(item => <button type="button" key={item.key} aria-pressed={view === item.key} onClick={() => setView(item.key)}>{item.label}{item.key === 'personalize' && <Sparkles size={13} />}</button>)}<span><ShieldCheck size={13} />{IS_NATIVE ? 'On this device' : 'Your workspace'}</span></nav>
        {(loadError || error) && <div className="profile-alert" role="alert"><p>{error || loadError}</p>{loadError && <button className="btn-secondary" type="button" onClick={retry}>Retry connection</button>}</div>}
        <div hidden={view !== 'overview'} className="profile-overview">
            <aside className="profile-focus"><span className="eyebrow">The reason you return</span><h2>{profile.goal || 'What are you working towards?'}</h2><p>{profile.return_note || 'Leave a kind note for the day you need a little momentum.'}</p><button type="button" className="text-link" onClick={() => setView('personalize')}>Shape your routine <ArrowUpRight size={14} /></button>
                <div className="profile-card-download"><span className="eyebrow">A little keepsake</span><h3>Your rhythm, in a card.</h3><p>A photo, a few small wins, and your own kind of progress. Keep it or send it to a friend.</p><button type="button" className="btn-secondary" disabled={!summary || locked} onClick={() => setCardOpen(true)}><Download size={14} />Make my profile card</button></div>
            </aside><div className="profile-activity"><ActivityCalendar onSummary={setSummary} /></div>
        </div>
        <form onSubmit={save} noValidate className="profile-editor">
            <fieldset disabled={locked} hidden={view !== 'personalize'} className="profile-editor-fields">
                <div className="profile-section-heading"><span className="eyebrow">Personalize</span><h2>A space that feels like you.</h2><p>Preview your changes above. Save when it feels right.</p></div>
                <div className="profile-editor-columns"><section className="profile-editor-panel"><h3>Your identity</h3><div className="photo-tools"><button type="button" className="btn-secondary" onClick={() => fileInput.current?.click()} disabled={reading}><ImagePlus size={15} />{reading ? 'Opening photo…' : 'Upload photo'}</button>{draft.avatar && <button type="button" className="btn-quiet" onClick={() => change('avatar', '')}><X size={14} />Remove</button>}</div><p className="profile-hint">JPG, PNG or WebP, up to 8 MB. Your photo is resized before it is saved; its location metadata is removed.</p>
                    {photoError && <p className="inline-error" role="alert">{photoError}</p>}
                    {photo && <section className="photo-crop" aria-label="Crop your profile photo"><canvas ref={cropCanvas} width="256" height="256" className={draft.avatar_monochrome ? 'crop-mono' : ''} aria-label="Photo crop preview" /><div>{[['zoom', 'Zoom', 1, 3, .01], ['x', 'Horizontal position', 0, 100, 1], ['y', 'Vertical position', 0, 100, 1]].map(([key, title, min, max, step]) => <label key={key}>{title}<input type="range" min={min} max={max} step={step} value={crop[key]} onChange={event => setCrop(current => ({ ...current, [key]: Number(event.target.value) }))} /></label>)}<div className="photo-tools"><button type="button" className="btn-primary" onClick={usePhoto}><Check size={14} />Use photo</button><button type="button" className="btn-secondary" onClick={() => setPhoto(null)}>Cancel crop</button></div></div></section>}
                    <div className="profile-field-grid"><label>Name<input value={draft.name} onChange={event => change('name', event.target.value)} maxLength={80} autoComplete="nickname" required /></label><label>Your goal<input value={draft.goal} onChange={event => change('goal', event.target.value)} maxLength={240} placeholder="Get confident with C++, one day at a time" /></label><label className="profile-field-wide">About you<textarea value={draft.bio} onChange={event => change('bio', event.target.value)} maxLength={240} rows={2} placeholder="A few words about you" /></label></div>
                </section><section className="profile-editor-panel"><h3>The finishing touches</h3>
                    <Choices label="Cover" options={[[ 'paper', 'Paper' ], [ 'stone', 'Stone' ], [ 'ink', 'Ink' ]]} value={draft.cover} onChange={value => change('cover', value)} />
                    <Choices label="Photo shape" options={[[ 'circle', 'Circle' ], [ 'rounded', 'Soft square' ]]} value={draft.avatar_shape} onChange={value => change('avatar_shape', value)} />
                    <label className="profile-inline-toggle"><span>Black & white photo</span><input type="checkbox" checked={draft.avatar_monochrome} onChange={event => change('avatar_monochrome', event.target.checked)} /></label>
                    <Choices label="Activity shades" options={[[ 'graphite', 'Graphite' ], [ 'sage', 'Sage' ], [ 'slate', 'Slate' ]]} value={draft.calendar_palette} onChange={value => change('calendar_palette', value)} />
                </section></div>
                <section className="profile-routine"><div><span className="eyebrow">Made for the days in between</span><h3>Your return ritual</h3><p>A personal target, with room for real life.</p></div><div className="profile-field-grid"><label>Active days in seven days<select value={draft.weekly_goal} onChange={event => change('weekly_goal', Number(event.target.value))}>{[1,2,3,4,5,6,7].map(n => <option key={n} value={n}>{n} {n === 1 ? 'day' : 'days'}</option>)}</select></label><label className="profile-field-wide">When I get stuck, remind me…<textarea value={draft.return_note} onChange={event => change('return_note', event.target.value)} maxLength={160} rows={2} placeholder="Ten minutes counts. Open Day 1 and begin." /><small>{draft.return_note.length}/160 · Just for you. Appears on your profile cover.</small></label></div></section>
            </fieldset>
            <fieldset disabled={locked} hidden={view !== 'preferences'} className="profile-editor-fields">
                <div className="profile-section-heading"><span className="eyebrow">Preferences</span><h2>Find your rhythm.</h2><p>A few small adjustments for the way you work.</p></div>
                <div className="profile-editor-columns"><section className="profile-editor-panel"><h3>Your calendar</h3><div className="profile-field-grid"><label className="profile-field-wide">Timezone<input value={draft.timezone} onChange={event => change('timezone', event.target.value)} list="profile-timezones" placeholder="Use this device’s timezone" /><datalist id="profile-timezones">{['Asia/Kolkata', 'UTC', 'Europe/London', 'America/New_York', 'America/Los_Angeles', 'Asia/Singapore', 'Australia/Sydney'].map(zone => <option key={zone}>{zone}</option>)}</datalist><small>Past activity keeps its original day.</small></label><label className="profile-field-wide">Start the week on<select value={draft.week_start} onChange={event => change('week_start', event.target.value)}><option value="monday">Monday</option><option value="sunday">Sunday</option></select></label></div></section><section className="profile-editor-panel"><h3>Comfort & companion</h3><div className="profile-toggles">{toggles.map(([key, title, copy]) => <label key={key}><span><strong>{title}</strong><small>{copy}</small></span><input type="checkbox" checked={draft[key]} onChange={event => change(key, event.target.checked)} /></label>)}</div></section></div>
                <p className="profile-privacy"><ShieldCheck size={16} />{IS_NATIVE ? 'Your profile photo, preferences and history stay in your local workspace and workspace backups.' : 'Your profile photo and preferences are saved with your workspace and its backups.'}</p>
            </fieldset>
            {view !== 'overview' && <footer className="profile-savebar"><span role="status" className={saved ? 'profile-saved' : 'profile-save-status'}>{saved ? 'Your profile and preferences are saved.' : photo ? 'Use or cancel the photo crop first.' : dirty ? 'You have unsaved changes.' : 'Everything is up to date.'}</span><div><button type="button" className="btn-secondary" disabled={!dirty || locked || Boolean(photo)} onClick={() => { setDraft(profile); setSaved(false); setError(''); setPhotoError('') }}><RotateCcw size={14} />Discard</button><button type="submit" className="btn-primary" disabled={!dirty || locked || Boolean(photo) || reading}><Check size={14} />{saving ? 'Saving…' : 'Save settings'}</button></div></footer>}
        </form>
        {cardOpen && summary && <ProfileCard profile={profile} summary={summary} onClose={() => setCardOpen(false)} />}
        <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" tabIndex={-1} aria-label="Profile photo file" disabled={locked} onChange={choosePhoto} />
    </main>
}
