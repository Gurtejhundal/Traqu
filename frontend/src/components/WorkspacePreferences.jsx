import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import axios from 'axios'
import { API_URL } from '../config'

const defaults = { name: 'Your workspace', bio: '', goal: '', timezone: '', week_start: 'monday', compact: false, pet_motion: true, reduced_motion: false }
const Workspace = createContext(null)

export function WorkspacePreferences({ children }) {
    const [profile, setProfile] = useState(defaults)
    const [ready, setReady] = useState(false)
    const [error, setError] = useState('')
    useEffect(() => {
        const controller = new AbortController()
        axios.get(`${API_URL}/profile`, { signal: controller.signal })
            .then(({ data }) => { setProfile({ ...defaults, ...data }); setError('') })
            .catch(err => { if (!axios.isCancel(err)) setError('Profile settings are unavailable. Check the workspace connection and try again.') })
            .finally(() => { if (!controller.signal.aborted) setReady(true) })
        return () => controller.abort()
    }, [])
    useEffect(() => {
        document.documentElement.dataset.traquCompact = String(profile.compact)
        document.documentElement.dataset.traquMotion = profile.reduced_motion ? 'reduce' : 'system'
    }, [profile.compact, profile.reduced_motion])
    const value = useMemo(() => ({ profile, setProfile, ready, error,
        timezone: profile.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC' }), [profile, ready, error])
    return <Workspace.Provider value={value}>{children}</Workspace.Provider>
}

export function useWorkspace() { return useContext(Workspace) }
