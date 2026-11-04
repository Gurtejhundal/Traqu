import { useEffect, useState } from 'react'
import { Check, Settings2, UserRound } from 'lucide-react'
import axios from 'axios'
import ActivityCalendar from '../components/ActivityCalendar'
import { useWorkspace } from '../components/WorkspacePreferences'
import { API_URL, IS_DESKTOP } from '../config'
import { getApiErrorMessage } from '../utils/apiErrors'

export default function Profile() {
    const { profile, setProfile, ready, error: loadError } = useWorkspace()
    const [draft, setDraft] = useState(profile)
    const [saving, setSaving] = useState(false)
    const [saved, setSaved] = useState(false)
    const [error, setError] = useState('')
    useEffect(() => setDraft(profile), [profile])
    const change = (key, value) => { setDraft(current => ({ ...current, [key]: value })); setSaved(false) }
    async function save(event) {
        event.preventDefault(); setSaving(true); setError(''); setSaved(false)
        try {
            const { data } = await axios.put(`${API_URL}/profile`, draft)
            setProfile(data); setSaved(true)
        } catch (err) { setError(getApiErrorMessage(err, 'Settings could not be saved. Your edits are still here.')) }
        finally { setSaving(false) }
    }
    return <main className="profile-page">
        <header className="profile-heading"><span className="eyebrow">A little better, one day at a time</span><h1>Your corner of Traqu.</h1><p>Your goal, your rhythm, and a record of showing up.</p></header>
        <div className="profile-layout"><aside className="profile-sidebar"><div className="profile-avatar" aria-hidden="true">{profile.name.trim().slice(0, 1).toUpperCase() || <UserRound size={36} />}</div>
            <h2>{profile.name}</h2>{profile.bio && <p>{profile.bio}</p>}{profile.goal && <div className="profile-goal"><span className="eyebrow">Working towards</span><strong>{profile.goal}</strong></div>}
            <p className="profile-storage">{IS_DESKTOP ? 'Profile and activity saved on this computer.' : 'Profile and activity belong to this browser workspace.'}</p>
            <a href="#profile-settings" className="btn-secondary"><Settings2 size={14} />Edit profile & settings</a>
        </aside><div className="profile-main"><ActivityCalendar />
            <form id="profile-settings" className="profile-settings" onSubmit={save}>
                <header><span className="eyebrow">Make room for your routine</span><h2>Profile & app settings</h2></header>
                {(loadError || error) && <p className="inline-error" role="alert">{error || loadError}</p>}
                <fieldset disabled={!ready || saving || Boolean(loadError)}><div className="profile-field-grid">
                    <label>Name<input value={draft.name} onChange={event => change('name', event.target.value)} maxLength={80} required /></label>
                    <label>Your goal<input value={draft.goal} onChange={event => change('goal', event.target.value)} maxLength={240} placeholder="Build confidence with C++, one day at a time" /></label>
                    <label className="profile-field-wide">About you<textarea value={draft.bio} onChange={event => change('bio', event.target.value)} maxLength={240} rows={3} /></label>
                    <label>Timezone<input value={draft.timezone} onChange={event => change('timezone', event.target.value)} list="profile-timezones" placeholder="Use this device’s timezone" /><datalist id="profile-timezones">{['Asia/Kolkata', 'UTC', 'Europe/London', 'America/New_York', 'America/Los_Angeles', 'Asia/Singapore', 'Australia/Sydney'].map(zone => <option key={zone}>{zone}</option>)}</datalist><small>Leave blank to use this device. Past activity keeps its original day.</small></label>
                    <label>Start the week on<select value={draft.week_start} onChange={event => change('week_start', event.target.value)}><option value="monday">Monday</option><option value="sunday">Sunday</option></select></label>
                </div><div className="profile-toggles">{[['compact', 'Compact task spacing', 'Fit more of a day on screen.'], ['pet_motion', 'Qu’s movements & cursor gaze', 'Let your little companion react while you work.'], ['reduced_motion', 'Reduce motion', 'Use steady poses and quiet transitions.']].map(([key, title, copy]) => <label key={key}><span><strong>{title}</strong><small>{copy}</small></span><input type="checkbox" checked={draft[key]} onChange={event => change(key, event.target.checked)} /></label>)}</div>
                    <button type="submit" className="btn-primary" disabled={saving}>{saved ? <Check size={15} /> : <Settings2 size={15} />}{saving ? 'Saving…' : saved ? 'Saved' : 'Save settings'}</button>
                    {saved && <span className="profile-saved" role="status">Your profile and preferences are saved.</span>}
                </fieldset>
            </form>
        </div></div>
    </main>
}
