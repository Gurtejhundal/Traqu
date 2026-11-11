import { useEffect, useState } from 'react'
import { Download, FolderOpen, RefreshCw, ShieldCheck, Upload } from 'lucide-react'
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
            if (action === 'save' || action === 'choose') setMessage('Recovery backup saved outside the app. Keep this folder when uninstalling.')
        } catch (err) { setError(err.message || 'The backup could not be saved. Your previous copy was kept.') }
        finally { setBusy(false) }
    }
    async function updates(action) {
        setBusy(true); setError(''); setMessage('')
        try {
            const data = await window.traquDesktop.updates(action); setUpdate(data)
            setMessage(data.opened ? 'Recovery backup saved. The update download opened in your browser. Install it normally; do not delete the data or backup folders.' : data.available ? `Update ${data.version} is available.` : `No newer desktop release found. Installed: ${data.current}. Latest published: ${data.version}.`)
        } catch (err) { setError(err.message || 'Could not check for updates. Please try again.') }
        finally { setBusy(false) }
    }
    if (!desktop && !IS_MOBILE) return null
    return <section className="storage-controls" aria-label="Backups and updates">
        <div className="storage-heading"><ShieldCheck size={17} aria-hidden="true" /><div><strong>Your progress, kept close.</strong><p>{desktop ? 'Automatic recovery copies are saved separately from the installed app.' : 'Your plans are local. Save a workspace backup with the Back up button before uninstalling or clearing app data.'}</p></div></div>
        {desktop && <><p className="storage-path">{status?.directory || 'Finding your recovery folder…'}</p><p className="storage-detail">{status?.lastSaved ? `Last recovery copy: ${new Date(status.lastSaved).toLocaleString()}. Changes save after a short delay; external AI edits are checked every 30 seconds.` : 'No verified recovery copy yet. Save one before removing or updating the app.'}</p><div className="storage-actions"><button type="button" className="btn-secondary" disabled={busy} onClick={() => storage('save')}><Download size={14} />Save backup now</button><button type="button" className="btn-secondary" disabled={busy} onClick={() => storage('restore')}><Upload size={14} />Restore backup</button><button type="button" className="btn-quiet" disabled={busy} onClick={() => storage('choose')}>Change folder</button><button type="button" className="btn-quiet" disabled={busy} onClick={() => storage('open')}><FolderOpen size={14} />Open folder</button><button type="button" className="btn-secondary" disabled={busy} onClick={() => updates('check')}><RefreshCw size={14} />Check for updates</button>{update?.available && <button type="button" className="btn-primary" disabled={busy} onClick={() => updates('download')}>Back up &amp; download update</button>}</div></>}
        {IS_MOBILE && <a className="btn-secondary" href="https://github.com/Gurtejhundal/Traqu/releases?q=android&amp;expanded=true" target="_blank" rel="noreferrer"><RefreshCw size={14} />Android updates</a>}
        <p className="storage-detail">{desktop ? 'Keep this folder outside Traqu’s app-data folder. Restore its JSON file after reinstalling. Recovery keeps the latest non-empty workspace and up to 20 versions; it cannot protect files you delete yourself or a failed drive.' : 'Choose Documents or another location in the system file picker. Reinstall Traqu, then use Restore to import that JSON backup. Uninstalling Android apps can erase internal data; updates should be installed over the existing app when Android accepts the signature.'}</p>
        {(error || status?.error) && <p className="inline-error" role="alert">{error || status.error}</p>}
        <p role="status">{busy ? 'Working…' : message}</p>
    </section>
}
