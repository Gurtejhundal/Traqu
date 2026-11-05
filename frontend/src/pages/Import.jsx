import { useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import { AlertCircle, Check, FileText, FileUp, Upload, X } from 'lucide-react'

import { API_URL, LOCAL_USER_ID, IS_NATIVE, IS_MOBILE } from '../config'
import { getApiErrorMessage } from '../utils/apiErrors'
import { Companion } from '../components/MotionUI'
import ImportSkill from '../components/ImportSkill'
import { MAX_ROADMAP_NAME_LENGTH, MAX_ROADMAP_TEXT_LENGTH } from '../utils/roadmapLimits'

const SUPPORTED_FILE_COPY = IS_MOBILE ? 'PDF, DOCX, TXT, Markdown, JSON, and YAML · 8 MB maximum' : 'PDF, DOCX, TXT, Markdown, JSON, CSV, and YAML · 8 MB maximum'
const MAX_FILE_BYTES = 8 * 1024 * 1024
const SUPPORTED_EXTENSIONS = new Set([
    'pdf', 'docx', 'txt', 'md', 'markdown', 'json', 'csv', 'yaml', 'yml', 'rst', 'log',
])

const fileStem = (filename = '') => filename.replace(/\.[^/.]+$/, '')

const isSupportedFile = (file) => {
    const extension = file?.name?.split('.').pop()?.toLowerCase()
    return Boolean(
        (extension && SUPPORTED_EXTENSIONS.has(extension))
        || file?.type === 'application/pdf'
        || file?.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        || file?.type?.startsWith('text/'),
    )
}

export default function Import() {
    const navigate = useNavigate()
    const fileInputRef = useRef(null)
    const [name, setName] = useState('')
    const [rawText, setRawText] = useState('')
    const [selectedFile, setSelectedFile] = useState(null)
    const [sourceMode, setSourceMode] = useState('file')
    const [error, setError] = useState(null)
    const [loading, setLoading] = useState(false)
    const [preview, setPreview] = useState(null)
    const [excluded, setExcluded] = useState(new Set())
    const [previewLimit, setPreviewLimit] = useState(12)

    const authHeaders = useMemo(() => ({ 'X-Local-User-Id': LOCAL_USER_ID }), [])
    const inferredName = fileStem(selectedFile?.name)

    const selectFile = (file) => {
        if (!file) return false
        if (!isSupportedFile(file) || (IS_MOBILE && file.name.toLowerCase().endsWith('.csv'))) {
            setError('Unsupported file type. Choose PDF, DOCX, or a supported text document.')
            return false
        }
        if (file.size > MAX_FILE_BYTES) {
            setError('Roadmap file must be 8 MB or smaller.')
            return false
        }

        const previousInferredName = fileStem(selectedFile?.name)
        setPreview(null)
        setExcluded(new Set())
        setSelectedFile(file)
        setSourceMode('file')
        setError(null)
        if (!name.trim() || name.trim() === previousInferredName) setName(fileStem(file.name))
        return true
    }

    const handleFileChange = (event) => {
        const file = event.target.files?.[0]
        if (!file) return
        if (!selectFile(file)) event.target.value = ''
    }

    const handleFileDrop = (event) => {
        event.preventDefault()
        const file = event.dataTransfer.files?.[0]
        if (selectFile(file) && fileInputRef.current) {
            fileInputRef.current.value = ''
        }
    }

    const clearFile = () => {
        setSelectedFile(null)
        setPreview(null)
        setError(null)
        if (fileInputRef.current) fileInputRef.current.value = ''
    }

    const importText = async (roadmapName) => {
        if (!rawText.trim()) throw new Error('Paste roadmap text or switch to file upload.')

        return axios.post(
            `${API_URL}/roadmaps`,
            { name: roadmapName, text: rawText },
            { headers: authHeaders },
        )
    }

    const importFile = async (roadmapName) => {
        if (!selectedFile) throw new Error('Choose a roadmap file first.')
        if (selectedFile.size > MAX_FILE_BYTES) throw new Error('Roadmap file must be 8 MB or smaller.')

        const formData = new FormData()
        formData.append('name', roadmapName)
        formData.append('file', selectedFile)

        return axios.post(`${API_URL}/roadmaps/import-file`, formData, {
            headers: authHeaders,
        })
    }

    const handleSubmit = async (event) => {
        event.preventDefault()
        const roadmapName = name.trim() || inferredName
        if (!roadmapName) {
            setError('Roadmap name is required.')
            return
        }
        if (roadmapName.length > MAX_ROADMAP_NAME_LENGTH) {
            setError(`Roadmap name must be ${MAX_ROADMAP_NAME_LENGTH} characters or fewer.`)
            return
        }
        if (sourceMode === 'text' && rawText.length > MAX_ROADMAP_TEXT_LENGTH) {
            setError('Roadmap text must be 8 MB or smaller.')
            return
        }

        setError(null)
        setLoading(true)

        try {
            if (!preview) {
                let response
                if (sourceMode === 'file') {
                    if (!selectedFile) throw new Error('Choose a roadmap file first.')
                    const body = new FormData()
                    body.append('file', selectedFile)
                    response = await axios.post(`${API_URL}/roadmaps/preview-file`, body, { headers: authHeaders })
                } else {
                    if (!rawText.trim()) throw new Error('Paste your roadmap text first.')
                    response = await axios.post(`${API_URL}/roadmaps/preview`, { text: rawText }, { headers: authHeaders })
                }
                setPreview(response.data)
                setExcluded(new Set())
                setPreviewLimit(12)
                return
            }
            if (preview.kind === 'workspace') {
                const body = new FormData()
                body.append('file', selectedFile)
                const restored = await axios.post(`${API_URL}/backup/restore-file`, body, { headers: authHeaders })
                navigate('/', { state: { restored: restored.data.roadmaps.length } })
                return
            }
            const selected = preview.tasks.filter((_, index) => !excluded.has(index))
            if (preview.tasks.length > 0 && selected.length === 0) throw new Error('Include at least one task, or go back and review the source.')
            const res = selected.length > 0
                ? await axios.post(`${API_URL}/roadmaps/import`, { name: roadmapName, tasks: selected, document: preview.document }, { headers: authHeaders })
                : sourceMode === 'file' ? await importFile(roadmapName) : await importText(roadmapName)
            navigate(`/roadmap/${res.data.id}`)
        } catch (importError) {
            console.error(importError)
            setError(!IS_NATIVE && importError.response?.status === 503
                ? 'The online workspace is not available yet. This plan was not saved. Use the desktop app to work privately and offline.'
                : getApiErrorMessage(importError, 'Failed to import roadmap.'))
        } finally {
            setLoading(false)
        }
    }

    return (
        <main className="import-page">
            <form className="form-container" onSubmit={handleSubmit} aria-busy={loading}>
                <fieldset className="import-fields" disabled={loading}>
                <div className="import-heading"><div><span className="eyebrow">A little structure goes a long way</span>
                <h1 className="section-title">Import a plan</h1></div><Companion mood={loading ? 'thinking' : 'welcome'} size={112} /></div>
                <p className="form-intro">Bring a document or a pasted plan. Review the sections, actions, and dates before making it yours.</p>

                <div className="import-capabilities" aria-label="Import behavior">
                    <span><Check size={14} /> Headings become sections</span>
                    <span><Check size={14} /> Table rows stay structured</span>
                    <span><Check size={14} /> Source context stays available for review</span>
                </div>

                <div className="import-source-switch" role="tablist" aria-label="Roadmap import source">
                    <button
                        type="button"
                        role="tab"
                        aria-selected={sourceMode === 'file'}
                        className={`source-tab ${sourceMode === 'file' ? 'active' : ''}`}
                        onClick={() => {
                            setPreview(null)
                            setSourceMode('file')
                            setError(null)
                        }}
                    >
                        <FileUp size={16} /> Upload file
                    </button>
                    <button
                        type="button"
                        role="tab"
                        aria-selected={sourceMode === 'text'}
                        className={`source-tab ${sourceMode === 'text' ? 'active' : ''}`}
                        onClick={() => {
                            setPreview(null)
                            setSourceMode('text')
                            setError(null)
                        }}
                    >
                        <FileText size={16} /> Paste text
                    </button>
                </div>

                <ImportSkill />

                <div className="form-group">
                    <label htmlFor="roadmap-name">Roadmap name</label>
                    <input
                        id="roadmap-name"
                        type="text"
                        placeholder="e.g. DSA foundation"
                        value={name}
                        onChange={(event) => setName(event.target.value)}
                        maxLength={MAX_ROADMAP_NAME_LENGTH}
                        autoFocus
                    />
                </div>

                {sourceMode === 'file' ? (
                    <div className="form-group">
                        <label htmlFor="roadmap-file">Document</label>
                        <label
                            className={`file-dropzone ${selectedFile ? 'has-file' : ''}`}
                            htmlFor="roadmap-file"
                            onDragOver={(event) => event.preventDefault()}
                            onDrop={handleFileDrop}
                        >
                            <input
                                ref={fileInputRef}
                                id="roadmap-file"
                                type="file"
                                accept=".pdf,.docx,.txt,.md,.markdown,.json,.csv,.yaml,.yml,.rst,.log,text/*,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                                onChange={handleFileChange}
                            />
                            <Upload size={22} aria-hidden="true" />
                            <span>{selectedFile ? selectedFile.name : 'Choose a file or drop it here'}</span>
                            <small>{SUPPORTED_FILE_COPY}</small>
                        </label>
                        {selectedFile && (
                            <button type="button" className="btn-quiet clear-file-btn" onClick={clearFile}>
                                <X size={15} /> Remove file
                            </button>
                        )}
                    </div>
                ) : (
                    <div className="form-group">
                        <label htmlFor="roadmap-text">Plan content</label>
                        <textarea
                            id="roadmap-text"
                            className="code-editor import-editor"
                            rows="14"
                            placeholder={`Docker setup\n- Install Docker Desktop\n- Build and run an image\n\nDeployment\n- Push the image to a registry\n- Deploy the container`}
                            value={rawText}
                            onChange={(event) => { setPreview(null); setRawText(event.target.value) }}
                            maxLength={MAX_ROADMAP_TEXT_LENGTH}
                        />
                    </div>
                )}

                {preview && <section className="import-preview" aria-labelledby="preview-title">
                    <div className="preview-summary"><div><h2 id="preview-title">Review your import</h2>
                        <p>{preview.kind === 'workspace' ? `${preview.roadmaps.length} roadmaps · restored as new copies` : `${preview.tasks.length - excluded.size} actions selected · ${preview.summary.sections} sections · ${preview.summary.dated_tasks} dated actions`}</p>
                    </div><Check size={20} aria-hidden="true" /></div>
                    {preview.warnings.map((warning) => <p className="preview-warning" key={warning}>{warning}</p>)}
                    {preview.kind === 'workspace' ? <><p className="form-intro">Existing plans stay in place. Matching names get a “restored” suffix.</p>
                        {preview.roadmaps.map((roadmap, index) => <p key={index}>{roadmap.name} · {roadmap.tasks} tasks</p>)}</>
                        : <><p className="form-intro">Choose which actions to bring in. You can edit each title here.</p>
                        {preview.tasks.slice(0, previewLimit).map((task, index) => <div className="preview-task" key={index}>
                            <input type="checkbox" checked={!excluded.has(index)} aria-label={`Include task ${index + 1}`} onChange={() => setExcluded((current) => {
                                const next = new Set(current)
                                if (next.has(index)) next.delete(index); else next.add(index)
                                return next
                            })} />
                            <div><input type="text" value={task.title} aria-label={`Preview task ${index + 1} title`} maxLength={4000} onChange={(event) => setPreview((current) => ({ ...current, tasks: current.tasks.map((item, itemIndex) => itemIndex === index ? { ...item, title: event.target.value } : item) }))} />
                                <small>{task.timeframe}{task.start_date ? ` · ${task.start_date}${task.end_date && task.end_date !== task.start_date ? ` to ${task.end_date}` : ''}` : ''}{task.is_done ? ' · already complete' : ''}</small></div>
                        </div>)}
                        </>}
                    <div className="preview-actions"><button className="btn-quiet" type="button" onClick={() => setPreview(null)}>Back to source</button>
                        {preview.kind !== 'workspace' && preview.tasks.length > previewLimit && <button className="btn-quiet" type="button" onClick={() => setPreviewLimit((current) => current + 20)}>Show more actions</button>}
                    </div>
                </section>}

                {error && (
                    <div className="error-message" role="alert">
                        <AlertCircle size={17} /> {error}
                    </div>
                )}

                <button className="btn-primary full-width" type="submit" disabled={loading}>
                    {loading ? (preview ? 'Saving your plan…' : 'Reading your plan…') : !preview ? 'Review import' : preview.kind === 'workspace' ? 'Restore workspace' : 'Import roadmap'}
                </button>
                </fieldset>
            </form>
        </main>
    )
}
