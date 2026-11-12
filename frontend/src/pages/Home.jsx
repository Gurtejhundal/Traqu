import { useCallback, useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import axios from 'axios'
import { AlertCircle, ArrowRight, FileText, Plus, RefreshCw, Trash2, Download, Upload } from 'lucide-react'

import { API_URL, LOCAL_USER_ID, IS_NATIVE, IS_MOBILE } from '../config'
import { getApiErrorMessage } from '../utils/apiErrors'
import { downloadFile } from '../utils/downloadFile'
import { Companion } from '../components/MotionUI'

export default function Home() {
    const [roadmaps, setRoadmaps] = useState([])
    const [backingUp, setBackingUp] = useState(false)
    const location = useLocation()
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [hostedUnavailable, setHostedUnavailable] = useState(false)

    const fetchRoadmaps = useCallback(async () => {
        try {
            setError('')
            setHostedUnavailable(false)
            const res = await axios.get(`${API_URL}/roadmaps`, {
                headers: { 'X-Local-User-Id': LOCAL_USER_ID },
            })
            setRoadmaps(Array.isArray(res.data) ? res.data : [])
        } catch (fetchError) {
            console.error('Failed to fetch roadmaps', fetchError)
            const unavailable = !IS_NATIVE && fetchError.response?.status === 503
            setHostedUnavailable(unavailable)
            setError(unavailable ? 'The online workspace is not available yet. The desktop app keeps your plans on your computer and works offline.' : getApiErrorMessage(fetchError, 'Could not load your roadmaps. Try opening the workspace again.'))
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        fetchRoadmaps()
    }, [fetchRoadmaps])

    const deleteRoadmap = async (event, id, name) => {
        event.preventDefault()
        event.stopPropagation()
        if (!window.confirm(`Delete “${name}”? ${window.traquDesktop?.storage || IS_MOBILE ? "A recovery backup must be saved first." : "This cannot be undone."}`)) return

        try {
            if (window.traquDesktop?.storage) await window.traquDesktop.storage('save')
            else if (IS_MOBILE) {
                const { data } = await axios.get(`${API_URL}/backup`)
                await downloadFile(new Blob([JSON.stringify(data)], { type: 'application/json' }), 'Traqu-before-delete.json')
            }
            await axios.delete(`${API_URL}/roadmaps/${id}`, {
                headers: { 'X-Local-User-Id': LOCAL_USER_ID },
            })
            setRoadmaps((current) => current.filter((roadmap) => roadmap.id !== id))
        } catch (deleteError) {
            console.error('Failed to delete roadmap', deleteError)
            setError(getApiErrorMessage(deleteError, 'The backup or deletion could not finish. The roadmap was kept if deletion had not started.'))
        }
    }

    const backUpWorkspace = async () => {
        setBackingUp(true)
        setError('')
        try {
            const { data } = await axios.get(`${API_URL}/backup`)
            await downloadFile(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }), `Traqu-workspace-${new Date().toISOString().slice(0, 10)}.json`)
        } catch (error) {
            setError(getApiErrorMessage(error, 'Your backup could not be saved. Try again.'))
        } finally { setBackingUp(false) }
    }

    return (
        <main className="home-page">
            <header className="hero-section">
                <div>
                    <span className="eyebrow">Workspace</span>
                    <h1 className="section-title">Your roadmaps</h1>
                    <p>Plans, checklists, study schedules, and project work in one quiet place.</p>
                </div>
                <div className="workspace-actions">
                    <button className="btn-quiet" onClick={backUpWorkspace} disabled={backingUp || loading}><Download size={14} />{backingUp ? 'Saving…' : 'Back up'}</button>
                    <Link to="/import" className="btn-quiet"><Upload size={14} />Restore</Link>
                    {hostedUnavailable ? <Link to="/downloads" className="btn-primary hero-action"><Download size={16} /> Get the app</Link>
                        : <Link to="/import" className="btn-primary hero-action"><Plus size={16} /> New</Link>}
                </div>
            </header>

            {location.state?.restored > 0 && <p role="status" className="workspace-note">Restored {location.state.restored} roadmaps as new copies.</p>}
            {loading ? (
                <div className="loading-state" role="status" aria-live="polite">
                    <Companion mood="thinking" size={84} />
                    <strong>Opening your workspace</strong>
                    <span>Loading roadmaps and progress…</span>
                </div>
            ) : error && roadmaps.length === 0 ? (
                <div className="feedback-state error-state" role="alert">
                    {hostedUnavailable ? <Companion size={96} /> : <AlertCircle size={21} />}
                    <div><strong>{hostedUnavailable ? 'Your plans. On your computer.' : 'Roadmaps unavailable'}</strong><p>{error}</p></div>
                    <button className="btn-secondary" onClick={fetchRoadmaps}><RefreshCw size={15} /> Retry</button>
                </div>
            ) : (
                <section className="library-section" aria-labelledby="library-heading">
                    <div className="library-heading-row">
                        <h2 id="library-heading">All documents</h2>
                        <span>{roadmaps.length} {roadmaps.length === 1 ? 'roadmap' : 'roadmaps'}</span>
                    </div>

                    {error && <div className="inline-error" role="alert">{error}</div>}

                    {roadmaps.length === 0 ? (
                        <div className="empty-library">
                            <Companion size={156} />
                            <div className="empty-library-copy"><span className="eyebrow">Big plans. Small, steady steps.</span><strong>No roadmaps yet</strong><p>Bring a plan. Find your next step.<br />Qu will keep you a little company along the way.</p></div>
                            <Link to="/import" className="btn-secondary"><Plus size={16} /> Create your first roadmap</Link>
                        </div>
                    ) : (
                        <div className="roadmap-list">
                            {roadmaps.map((roadmap, index) => {
                                const totalTasks = roadmap.total_tasks || 0
                                const completedTasks = roadmap.completed_tasks || 0
                                const percentage = totalTasks > 0
                                    ? Math.round((completedTasks / totalTasks) * 100)
                                    : 0

                                return (
                                    <div className="roadmap-row" key={roadmap.id} style={{ '--row-delay': `${Math.min(index, 8) * 28}ms` }}>
                                        <Link to={`/roadmap/${roadmap.id}`} className="roadmap-row-link" aria-label={`Open ${roadmap.name}`} />
                                        <span className="document-icon" aria-hidden="true"><FileText size={17} /></span>
                                        <span className="roadmap-row-main">
                                            <strong>{roadmap.name}</strong>
                                            <small>{completedTasks} of {totalTasks} tasks complete · {new Date(roadmap.created_at).toLocaleDateString()}</small>
                                        </span>
                                        <span className="roadmap-row-progress" aria-label={`${percentage}% complete`}>
                                            <span><i style={{ width: `${percentage}%` }} /></span>
                                            <small>{percentage}%</small>
                                        </span>
                                        <button
                                            type="button"
                                            className="icon-btn delete-btn"
                                            aria-label={`Delete ${roadmap.name}`}
                                            onClick={(event) => deleteRoadmap(event, roadmap.id, roadmap.name)}
                                        >
                                            <Trash2 size={15} />
                                        </button>
                                        <ArrowRight className="arrow" size={16} aria-hidden="true" />
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </section>
            )}
            {IS_MOBILE && <p className="workspace-note">Saved on this device. Export a workspace backup before uninstalling Traqu or clearing app data.</p>}
            {!IS_NATIVE && <p className="workspace-note">This browser keeps access to your web workspace. Save a backup before clearing site data. For work saved on your computer, use the desktop app.</p>}
        </main>
    )
}
