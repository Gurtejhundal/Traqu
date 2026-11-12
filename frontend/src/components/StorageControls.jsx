import { useEffect, useState } from 'react'
import { Download, FolderOpen, RefreshCw, Upload } from 'lucide-react'
import { IS_MOBILE } from '../config'

export default function StorageControls() {
    const desktop = Boolean(window.traquDesktop?.storage)
    const [status, setStatus] = useState(null)
    const [busy, setBusy] = useState(false)
    const [message, setMessage] = useState('')
    const [error, setError] = useState('')
    const [update, setUpdate] = useState(null)
    useEffect(() => {
        if (!desktop) return
        let mounted = true
        const refresh = () => window.traquDesktop.storage('status').then(data => { if (mounted) setStatus(data) }).catch(err => { if (mounted) setError(err.message) })
        refresh(); const interval = setInterval(refresh, 10000)
        return () => { mounted = false; clearInterval(interval) }
    }, [desktop])
    async function storage(action) {
        setBusy(true); setError(''); setMessage('')
        try {
            const data = await window.traquDesktop.storage(action)
            if (data.canceled) return
            if (action === 'restore') { window.location.reload(); return }
            setStatus(data)
            if (action === 'save' || action === 'choose') setMessage('Backup saved.')
        } catch (err) { setError(err.message || 'The backup could not be saved. Your previous copy was kept.') }
        finally { setBusy(false) }
    }
    async function updates(action) {
        setBusy(true); setError(''); setMessage('')
        try {
            const data = await window.traquDesktop.updates(action); setUpdate(data)
            setMessage(data.opened ? 'Update download opened.' : data.available ? `Update ${data.version} is available.` : `You’re up to date (${data.current}).`)
        } catch (err) { setError(err.message || 'Could not check for updates. Please try again.') }
        finally { setBusy(false) }
    }
    if (!desktop && !IS_MOBILE) return null
    return <section className="storage-controls" aria-label="Backups and updates">
        <h3>Backups &amp; updates</h3>
        {desktop && <><div className="storage-actions"><button type="button" className="btn-secondary" disabled={busy} onClick={() => storage('save')}><Download size={14} />Save backup now</button><button type="button" className="btn-secondary" disabled={busy} onClick={() => storage('restore')}><Upload size={14} />Restore backup</button><button type="button" className="btn-secondary" disabled={busy} onClick={() => updates('check')}><RefreshCw size={14} />Check for updates</button>{update?.available && <button type="button" className="btn-primary" disabled={busy} onClick={() => updates('download')}>Back up &amp; download update</button>}</div>
            <details><summary>Backup folder</summary><p className="storage-path">{status?.directory || 'Loading…'}</p>{status?.lastSaved && <p className="storage-detail">Last saved {new Date(status.lastSaved).toLocaleString()}</p>}<div className="storage-actions"><button type="button" className="btn-quiet" disabled={busy} onClick={() => storage('choose')}>Change folder</button><button type="button" className="btn-quiet" disabled={busy} onClick={() => storage('open')}><FolderOpen size={14} />Open folder</button></div></details></>}
        {IS_MOBILE && <a className="btn-secondary" href="https://github.com/Gurtejhundal/Traqu/releases?q=android&amp;expanded=true" target="_blank" rel="noreferrer"><RefreshCw size={14} />Android updates</a>}
        {(error || status?.error) && <p className="inline-error" role="alert">{error || status.error}</p>}
        {(busy || message) && <p role="status">{busy ? 'Working…' : message}</p>}
    </section>
}
