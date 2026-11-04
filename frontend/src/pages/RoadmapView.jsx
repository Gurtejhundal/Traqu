import { useCallback, useDeferredValue, useMemo, useState, useEffect, useRef } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import axios from 'axios'
import { useReducedMotion } from 'motion/react'
import {
    ArrowLeft,
    ArrowRight,
    Calendar,
    CheckCircle2,
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    Circle,
    Download,
    Edit2,
    FileText,
    ListTree,
    LayoutGrid,
    PanelLeftOpen,
    Plus,
    Save,
    Search,
    Trash2,
    X,
} from 'lucide-react'
import TimeframeHeader from '../components/TimeframeHeader'
import TaskBlocks from '../components/TaskBlocks'
import ImportedDocument from '../components/ImportedDocument'
import { Companion } from '../components/MotionUI'
import { useWorkspace } from '../components/WorkspacePreferences'
import { DayCards, DayContents } from '../components/DayPlan'
import { buildDailyPlan, dayDate } from '../utils/dailyPlan'

import { API_URL, LOCAL_USER_ID } from '../config'
import { normalizeDocumentElements } from '../utils/documentElements'
import { groupRoadmapTasks, roadmapGroupDisplayLabel, taskCreatePayload } from '../utils/roadmapGroups'
import {
    documentElementToLines,
    formatTaskBlockForText,
    formatSemanticValue,
    getTaskSearchText,
} from '../utils/taskSemantics'

const statusFilters = [
    { value: 'all', label: 'All' },
    { value: 'open', label: 'Open' },
    { value: 'done', label: 'Done' },
]

const timelineRootPattern = /^(?:day|week|month|phase|module|unit|part|section|sprint|milestone|quarter|q)\s*[\divx]*/i
const topLevelPattern = /^(?:\d{1,2}\.|version\b|roadmap overview\b|final\b|mock\b|core strategy\b|what not to do\b|the exact\b|milestone gates\b|weekly time budget\b)/i
const timeHintPattern = /\b(?:month|week|day|phase|unit|module|quarter|q)\s*[\divx]+|\b\d{1,2}(?::\d{2})?\s*(?:am|pm)?\s*-\s*\d{1,2}(?::\d{2})?\s*(?:am|pm)?/i

function isTimelineRoot(label) {
    return timelineRootPattern.test(label.trim())
}

function isTopLevelHeading(label, index) {
    const normalized = label.trim()
    return index === 0 || isTimelineRoot(normalized) || topLevelPattern.test(normalized)
}

function extractTimeHint(label) {
    const match = label.match(timeHintPattern)
    return match ? match[0] : ''
}

function buildLegacyOutline(groupEntries, groupMeta = {}) {
    const sections = []
    const sectionMap = new Map()
    const byGroup = {}
    let activeSection = null
    const hasTimelineStructure = groupEntries.some(([group]) => {
        const label = roadmapGroupDisplayLabel(group, groupMeta)
        const firstPart = label.split(/\s+-\s+/)[0]?.trim() || ''
        return isTimelineRoot(label) || (label.includes(' - ') && isTimelineRoot(firstPart))
    })

    const ensureSection = (title, isVirtual = true, identity = title.toLowerCase()) => {
        const key = identity
        if (!sectionMap.has(key)) {
            const section = {
                id: `section-${sections.length}`,
                title,
                isVirtual,
                entry: null,
                children: [],
                taskCount: 0,
                doneCount: 0,
            }
            sectionMap.set(key, section)
            sections.push(section)
        }
        return sectionMap.get(key)
    }

    groupEntries.forEach(([group, groupTasks], index) => {
        const label = roadmapGroupDisplayLabel(group, groupMeta)
        const parts = label.split(/\s+-\s+/).map((part) => part.trim()).filter(Boolean)
        let sectionTitle = label
        let title = label
        let depth = 0
        let section

        if (parts.length > 1 && isTimelineRoot(parts[0])) {
            sectionTitle = parts[0]
            title = parts.slice(1).join(' - ')
            depth = 1
            section = ensureSection(sectionTitle)
        } else if (!hasTimelineStructure || isTopLevelHeading(label, index) || !activeSection) {
            section = ensureSection(label, false, `group:${group}`)
            sectionTitle = section.title
            title = label
            depth = 0
        } else {
            section = activeSection
            sectionTitle = section.title
            title = label
            depth = 1
        }

        const doneCount = groupTasks.filter((task) => task.is_done).length
        const entry = {
            id: `group-${index}`,
            group,
            title,
            sectionTitle,
            depth,
            taskCount: groupTasks.length,
            doneCount,
            timeHint: extractTimeHint(label),
        }

        if (depth === 0) {
            section.entry = entry
            section.isVirtual = false
            activeSection = section
        } else {
            section.children.push(entry)
            if (!activeSection) activeSection = section
        }

        section.taskCount += groupTasks.length
        section.doneCount += doneCount
        byGroup[group] = entry
    })

    return { sections, byGroup }
}

function buildOutline(groupEntries, groupMeta) {
    const rootedEntries = groupEntries.filter(([group]) => groupMeta[group]?.roadmap)
    if (rootedEntries.length === 0) return buildLegacyOutline(groupEntries, groupMeta)

    const roots = new Map()
    rootedEntries.forEach(([group, groupTasks], index) => {
        const meta = groupMeta[group]
        if (!roots.has(meta.roadmap)) {
            roots.set(meta.roadmap, {
                id: `source-roadmap-${roots.size}`,
                title: meta.roadmap,
                isVirtual: false,
                entry: null,
                children: [],
                taskCount: 0,
                doneCount: 0,
            })
        }

        const section = roots.get(meta.roadmap)
        const doneCount = groupTasks.filter((task) => task.is_done).length
        const entry = {
            id: `source-group-${index}`,
            group,
            title: meta.timeframe,
            sectionTitle: meta.roadmap,
            depth: meta.timeframe === meta.roadmap && !section.entry ? 0 : 1,
            taskCount: groupTasks.length,
            doneCount,
            timeHint: extractTimeHint(meta.timeframe),
        }
        if (entry.depth === 0) section.entry = entry
        else section.children.push(entry)
        section.taskCount += groupTasks.length
        section.doneCount += doneCount
    })

    const sections = [...roots.values()]
    const byGroup = {}
    sections.forEach((section) => {
        if (section.entry) byGroup[section.entry.group] = section.entry
        section.children.forEach((entry) => { byGroup[entry.group] = entry })
    })

    const legacyEntries = groupEntries.filter(([group]) => !groupMeta[group]?.roadmap)
    if (legacyEntries.length > 0) {
        const legacy = buildLegacyOutline(legacyEntries, groupMeta)
        sections.push(...legacy.sections.map((section, index) => ({
            ...section,
            id: `legacy-${index}-${section.id}`,
        })))
        Object.assign(byGroup, legacy.byGroup)
    }

    return { sections, byGroup }
}

export default function RoadmapView() {
    const reducedMotion = useReducedMotion()
    const { id } = useParams()
    const navigate = useNavigate()
    const [startedDay, setStartedDay] = useState('')
    const { timezone, profile } = useWorkspace()
    const [recovery, setRecovery] = useState(null)
    const [recovering, setRecovering] = useState(false)
    const [tasks, setTasks] = useState([])
    const [roadmap, setRoadmap] = useState(null)
    const [timeframes, setTimeframes] = useState([])
    const [documentElements, setDocumentElements] = useState([])
    const [isEditingName, setIsEditingName] = useState(false)
    const [newName, setNewName] = useState('')
    const [searchTerm, setSearchTerm] = useState('')
    const [sectionSearch, setSectionSearch] = useState('')
    const [statusFilter, setStatusFilter] = useState('all')
    const [viewMode, setViewMode] = useState('focus')
    const [editingTaskId, setEditingTaskId] = useState(null)
    const [editingTaskTitle, setEditingTaskTitle] = useState('')
    const [newTaskTitles, setNewTaskTitles] = useState({})
    const [activeGroup, setActiveGroup] = useState('')
    const [isTocOpen, setIsTocOpen] = useState(false)
    const [isExportMenuOpen, setIsExportMenuOpen] = useState(false)
    const [isExporting, setIsExporting] = useState(false)
    const [loadError, setLoadError] = useState('')
    const [actionError, setActionError] = useState('')
    const [pendingStatusTaskIds, setPendingStatusTaskIds] = useState(() => new Set())
    const [creatingGroup, setCreatingGroup] = useState('')
    const [savingTaskId, setSavingTaskId] = useState(null)
    const [isSavingName, setIsSavingName] = useState(false)
    const roadmapRef = useRef(null)
    const tocPanelRef = useRef(null)
    const tocTriggerRef = useRef(null)
    const exportMenuRef = useRef(null)
    const exportTriggerRef = useRef(null)
    const pendingStatusTaskIdsRef = useRef(new Set())
    const hasInitializedView = useRef(false)
    const authHeaders = useMemo(() => ({ 'X-Local-User-Id': LOCAL_USER_ID }), [])
    const deferredSearchTerm = useDeferredValue(searchTerm)
    const deferredSectionSearch = useDeferredValue(sectionSearch)

    const markStatusPending = (taskIds, pending) => {
        const next = new Set(pendingStatusTaskIdsRef.current)
        taskIds.forEach((taskId) => {
            if (pending) next.add(taskId)
            else next.delete(taskId)
        })
        pendingStatusTaskIdsRef.current = next
        setPendingStatusTaskIds(next)
    }

    const fetchData = useCallback(async () => {
        try {
            setLoadError('')
            const [rRes, tRes, dRes] = await Promise.all([
                axios.get(`${API_URL}/roadmaps/${id}`, { headers: authHeaders }),
                axios.get(`${API_URL}/roadmaps/${id}/tasks`, { headers: authHeaders }),
                axios.get(`${API_URL}/roadmaps/${id}/document`, { headers: authHeaders })
                    .catch(() => ({ data: { elements: [] } })),
            ])
            setRoadmap(rRes.data)
            setNewName(rRes.data.name)
            setTasks(tRes.data)
            setDocumentElements(normalizeDocumentElements(dRes.data?.elements))
            if (!hasInitializedView.current) {
                const groupCount = Object.keys(groupRoadmapTasks(tRes.data).tasks).length
                const groups = groupRoadmapTasks(tRes.data)
                const daily = buildDailyPlan(Object.entries(groups.tasks), groups.meta)
                if (daily.days.length || tRes.data.length >= 100 || groupCount >= 15) {
                    setViewMode('overview')
                }
                hasInitializedView.current = true
            }
        } catch (error) {
            console.error('Failed to fetch data', error)
            setLoadError('This roadmap could not be loaded. It may have been removed or the local server is unavailable.')
        }
    }, [authHeaders, id])

    const fetchTimeframes = useCallback(async () => {
        try {
            const res = await axios.get(`${API_URL}/roadmaps/${id}/timeframes`, { headers: authHeaders })
            setTimeframes(res.data)
        } catch (error) {
            console.error('Failed to fetch timeframes', error)
            setActionError('Section dates could not be loaded. Tasks are still available.')
        }
    }, [authHeaders, id])

    useEffect(() => {
        fetchData()
        fetchTimeframes()
    }, [fetchData, fetchTimeframes])

    useEffect(() => {
        if (!isTocOpen) return undefined

        const lockPage = window.matchMedia('(max-width: 860px)').matches
        const handleKeyDown = (event) => {
            if (event.key === 'Escape') {
                setIsTocOpen(false)
                window.requestAnimationFrame(() => tocTriggerRef.current?.focus())
                return
            }
            if (event.key === 'Tab' && lockPage && tocPanelRef.current) {
                const focusable = [...tocPanelRef.current.querySelectorAll(
                    'button:not(:disabled), input:not(:disabled), a[href], [tabindex]:not([tabindex="-1"])'
                )].filter((element) => element.getClientRects().length > 0)
                if (focusable.length === 0) return
                const first = focusable[0]
                const last = focusable[focusable.length - 1]
                if (event.shiftKey && document.activeElement === first) {
                    event.preventDefault()
                    last.focus()
                } else if (!event.shiftKey && document.activeElement === last) {
                    event.preventDefault()
                    first.focus()
                }
            }
        }
        const previousOverflow = document.body.style.overflow
        if (lockPage) document.body.style.overflow = 'hidden'
        document.addEventListener('keydown', handleKeyDown)
        window.requestAnimationFrame(() => tocPanelRef.current?.querySelector('button')?.focus())

        return () => {
            document.removeEventListener('keydown', handleKeyDown)
            if (lockPage) document.body.style.overflow = previousOverflow
        }
    }, [isTocOpen])

    useEffect(() => {
        if (!isExportMenuOpen) return undefined

        const handlePointerDown = (event) => {
            if (!exportMenuRef.current?.contains(event.target)) setIsExportMenuOpen(false)
        }
        const handleKeyDown = (event) => {
            if (event.key !== 'Escape') return
            setIsExportMenuOpen(false)
            exportTriggerRef.current?.focus()
        }
        document.addEventListener('pointerdown', handlePointerDown)
        document.addEventListener('keydown', handleKeyDown)
        window.requestAnimationFrame(() => exportMenuRef.current?.querySelector('[role="menuitem"]')?.focus())

        return () => {
            document.removeEventListener('pointerdown', handlePointerDown)
            document.removeEventListener('keydown', handleKeyDown)
        }
    }, [isExportMenuOpen])

    const groupedData = useMemo(() => groupRoadmapTasks(tasks), [tasks])
    const groupedTasks = groupedData.tasks
    const groupMeta = groupedData.meta

    const groupEntries = useMemo(() => Object.entries(groupedTasks), [groupedTasks])
    const groupNames = useMemo(() => Object.keys(groupedTasks), [groupedTasks])
    const dailyPlan = useMemo(() => buildDailyPlan(groupEntries, groupMeta, timeframes), [groupEntries, groupMeta, timeframes])
    const activeDay = dailyPlan.byGroup[activeGroup]
    const nextDay = dailyPlan.days.find(day => day.done < day.total)
    const isLargeRoadmap = tasks.length >= 100 || groupNames.length >= 15

    const visibleGroupedTasks = useMemo(() => {
        const query = deferredSearchTerm.trim().toLowerCase()

        return Object.entries(groupedTasks)
            .map(([group, groupTasks]) => {
                const filtered = groupTasks.filter((task) => {
                    const meta = groupMeta[group] || { timeframe: group, roadmap: '' }
                    const matchesSearch =
                        !query ||
                        getTaskSearchText(task, meta.timeframe, meta.roadmap).includes(query)
                    const matchesStatus =
                        statusFilter === 'all' ||
                        (statusFilter === 'done' && task.is_done) ||
                        (statusFilter === 'open' && !task.is_done)
                    return matchesSearch && matchesStatus
                })
                return [group, filtered]
            })
            .filter(([, groupTasks]) => groupTasks.length > 0)
    }, [deferredSearchTerm, groupMeta, groupedTasks, statusFilter])

    const visibleOverviewRoots = useMemo(() => {
        const roots = new Map()
        visibleGroupedTasks.forEach(([group, groupTasks]) => {
            const meta = groupMeta[group] || { roadmap: '', timeframe: group }
            const rootKey = meta.roadmap || '__legacy__'
            if (!roots.has(rootKey)) {
                roots.set(rootKey, { title: meta.roadmap, groups: [] })
            }
            roots.get(rootKey).groups.push([group, groupTasks])
        })
        return [...roots.values()]
    }, [groupMeta, visibleGroupedTasks])

    const outline = useMemo(() => buildOutline(groupEntries, groupMeta), [groupEntries, groupMeta])
    const visibleOutlineSections = useMemo(() => {
        const query = deferredSectionSearch.trim().toLowerCase()
        if (!query) return outline.sections

        return outline.sections
            .map((section) => {
                const sectionMatches = section.title.toLowerCase().includes(query)
                const entry = section.entry && (sectionMatches || section.entry.title.toLowerCase().includes(query))
                    ? section.entry
                    : null
                const children = section.children.filter((child) =>
                    sectionMatches || child.title.toLowerCase().includes(query)
                )
                if (!entry && children.length === 0) return null
                return {
                    ...section,
                    entry,
                    children,
                }
            })
            .filter(Boolean)
    }, [deferredSectionSearch, outline.sections])

    const totalTasks = tasks.length
    const completedTasks = tasks.filter((task) => task.is_done).length
    const percentage = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0
    const activeGroupTasks = useMemo(() => {
        const query = deferredSearchTerm.trim().toLowerCase()
        return (groupedTasks[activeGroup] || []).filter((task) => {
            const meta = groupMeta[activeGroup] || { timeframe: activeGroup, roadmap: '' }
            const matchesSearch = !query || getTaskSearchText(task, meta.timeframe, meta.roadmap).includes(query)
            const matchesStatus =
                statusFilter === 'all' ||
                (statusFilter === 'done' && task.is_done) ||
                (statusFilter === 'open' && !task.is_done)
            return matchesSearch && matchesStatus
        })
    }, [activeGroup, deferredSearchTerm, groupMeta, groupedTasks, statusFilter])
    const visibleTasksCount = viewMode === 'overview'
        ? visibleGroupedTasks.reduce((count, [, groupTasks]) => count + groupTasks.length, 0)
        : activeDay ? visibleGroupedTasks.filter(([group]) => activeDay.groups.includes(group)).reduce((count, [, items]) => count + items.length, 0) : activeGroupTasks.length
    const groupIndexByName = useMemo(
        () => new Map(groupNames.map((group, index) => [group, index])),
        [groupNames],
    )
    const activeGroupIndex = groupIndexByName.get(activeGroup) ?? -1
    const activeGroupMeta = groupMeta[activeGroup] || { timeframe: activeGroup, roadmap: '' }
    const resumeEntry = groupEntries.find(([, groupTasks]) => groupTasks.some((task) => !task.is_done)) || groupEntries[0]
    const resumeTask = resumeEntry?.[1].find((task) => !task.is_done) || resumeEntry?.[1][0]
    const resumeMeta = resumeEntry ? (groupMeta[resumeEntry[0]] || { timeframe: resumeEntry[0], roadmap: '' }) : null
    const activeEntry =
        outline.byGroup[activeGroup] ||
        (visibleOutlineSections[0]?.entry || visibleOutlineSections[0]?.children[0]) ||
        null

    useEffect(() => {
        if (!groupNames.length) {
            setActiveGroup('')
            return undefined
        }

        if (!activeGroup || !groupedTasks[activeGroup]) {
            setActiveGroup(dailyPlan.days[0]?.groups[0] || groupNames[0])
        }
        return undefined
    }, [activeGroup, groupedTasks, groupNames, dailyPlan])

    const toggleTask = async (taskId, currentStatus) => {
        if (pendingStatusTaskIdsRef.current.has(taskId)) return
        setActionError('')
        markStatusPending([taskId], true)
        setTasks((current) =>
            current.map((task) => (task.id === taskId ? { ...task, is_done: !currentStatus } : task))
        )
        try {
            await axios.put(
                `${API_URL}/tasks/${taskId}/status`,
                { is_done: !currentStatus, timezone },
                { headers: authHeaders }
            )
        } catch (error) {
            console.error('Failed to update task', error)
            setTasks((current) =>
                current.map((task) => (task.id === taskId ? { ...task, is_done: currentStatus } : task))
            )
            setActionError('Task progress could not be saved. Your previous status was restored.')
        } finally {
            markStatusPending([taskId], false)
        }
    }

    const updateGroupStatus = async (groupTasks, isDone) => {
        if (groupTasks.length === 0) return
        if (groupTasks.some((task) => pendingStatusTaskIdsRef.current.has(task.id))) return
        const taskIds = new Set(groupTasks.map((task) => task.id))
        const taskIdList = [...taskIds]
        setActionError('')
        markStatusPending(taskIdList, true)
        setTasks((current) =>
            current.map((task) => (taskIds.has(task.id) ? { ...task, is_done: isDone } : task))
        )

        try {
            await axios.post(`${API_URL}/roadmaps/${id}/tasks/status`,
                { task_ids: taskIdList, is_done: isDone, timezone }, { headers: authHeaders })
        } catch (error) {
            console.error('Failed to update group status', error)
            await fetchData()
            setActionError('Not every task status could be saved. Progress was reloaded from the server.')
        } finally {
            markStatusPending(taskIdList, false)
        }
    }

    const createTask = async (group) => {
        const title = (newTaskTitles[group] || '').trim()
        if (!title || creatingGroup === group) return
        const meta = groupMeta[group] || { timeframe: group, roadmap: '' }
        setCreatingGroup(group)
        setActionError('')

        try {
            const response = await axios.post(
                `${API_URL}/tasks`,
                taskCreatePayload(id, title, meta),
                { headers: authHeaders }
            )
            let createdTask = response.data
            if (meta.roadmap) {
                try {
                    const propertyResponse = await axios.put(
                        `${API_URL}/tasks/${createdTask.id}/properties`,
                        { properties: { ...(createdTask.properties || {}), Roadmap: meta.roadmap } },
                        { headers: authHeaders },
                    )
                    createdTask = propertyResponse.data
                } catch (propertyError) {
                    console.error('Failed to inherit task roadmap grouping', propertyError)
                    setActionError('The task was created, but its roadmap grouping could not be attached. It remains available in this roadmap.')
                }
            }
            setTasks((current) => (
                current.some((task) => task.id === createdTask.id) ? current : [...current, createdTask]
            ))
            setNewTaskTitles((current) => ({ ...current, [group]: '' }))
            fetchTimeframes()
        } catch (error) {
            console.error('Failed to create task', error)
            setActionError('The task could not be created. Your text is still in the add field.')
        } finally {
            setCreatingGroup('')
        }
    }

    const saveTaskTitle = async (taskId) => {
        const title = editingTaskTitle.trim()
        if (!title || savingTaskId === taskId) return

        const previousTitle = tasks.find((task) => task.id === taskId)?.title
        if (previousTitle === undefined) return
        setActionError('')
        setSavingTaskId(taskId)
        setTasks((current) =>
            current.map((task) => (task.id === taskId ? { ...task, title } : task))
        )

        try {
            const response = await axios.put(
                `${API_URL}/tasks/${taskId}`,
                { title },
                { headers: authHeaders }
            )
            setTasks((current) =>
                current.map((task) => (task.id === taskId ? { ...task, title: response.data.title } : task))
            )
            setEditingTaskId(null)
            setEditingTaskTitle('')
        } catch (error) {
            console.error('Failed to rename task', error)
            setTasks((current) => current.map((task) => (
                task.id === taskId ? { ...task, title: previousTitle } : task
            )))
            setActionError('The task title could not be saved. Your edit is still open.')
        } finally {
            setSavingTaskId(null)
        }
    }

    const deleteTask = async (taskId) => {
        if (!window.confirm('Delete this task?')) return

        const deletedIndex = tasks.findIndex((task) => task.id === taskId)
        const deletedTask = tasks[deletedIndex]
        if (!deletedTask) return
        setActionError('')
        setTasks((current) => current.filter((task) => task.id !== taskId))
        try {
            await axios.delete(`${API_URL}/tasks/${taskId}`, { headers: authHeaders })
        } catch (error) {
            console.error('Failed to delete task', error)
            setTasks((current) => {
                if (current.some((task) => task.id === taskId)) return current
                const restored = [...current]
                restored.splice(Math.min(deletedIndex, restored.length), 0, deletedTask)
                return restored
            })
            setActionError('The task could not be deleted, so it was restored.')
        }
    }

    const updateTaskBlocks = (taskId, update) => {
        setTasks((current) => current.map((task) => {
            if (task.id !== taskId) return task
            const currentBlocks = Array.isArray(task.blocks) ? task.blocks : []
            const nextBlocks = typeof update === 'function' ? update(currentBlocks) : update
            return { ...task, blocks: Array.isArray(nextBlocks) ? nextBlocks : currentBlocks }
        }))
    }

    const updateBulkTaskBlocks = (createdBlocks) => {
        const blocksByTask = createdBlocks.reduce((result, block) => {
            const taskId = Number(block?.task_id)
            if (!Number.isFinite(taskId)) return result
            if (!result.has(taskId)) result.set(taskId, [])
            result.get(taskId).push(block)
            return result
        }, new Map())

        setTasks((current) => current.map((task) => {
            const additions = blocksByTask.get(Number(task.id))
            if (!additions?.length) return task
            const nextBlocks = [...(Array.isArray(task.blocks) ? task.blocks : []), ...additions]
                .sort((left, right) => (Number(left.position) || 0) - (Number(right.position) || 0))
            return { ...task, blocks: nextBlocks }
        }))
    }

    const saveName = async () => {
        const name = newName.trim()
        if (!name || isSavingName) return
        setActionError('')
        setIsSavingName(true)
        try {
            await axios.put(`${API_URL}/roadmaps/${id}/name`, { name }, { headers: authHeaders })
            setRoadmap((current) => ({ ...current, name }))
            setNewName(name)
            setIsEditingName(false)
        } catch (error) {
            console.error('Failed to rename roadmap', error)
            setActionError('The roadmap name could not be saved. Your edit is still open.')
        } finally {
            setIsSavingName(false)
        }
    }

    const goToGroup = (group) => {
        setActiveGroup(group)
        setViewMode('focus')
        setSearchTerm('')
        setIsTocOpen(false)

        window.requestAnimationFrame(() => {
            roadmapRef.current?.scrollIntoView({ behavior: reducedMotion || profile.reduced_motion ? 'auto' : 'smooth', block: 'start' })
        })
    }

    const moveFocus = (direction) => {
        if (activeDay) {
            const next = dailyPlan.days[dailyPlan.days.indexOf(activeDay) + direction]
            if (next) goToGroup(next.groups[0])
            return
        }
        if (activeGroupIndex < 0) return
        const nextIndex = activeGroupIndex + direction
        if (nextIndex < 0 || nextIndex >= groupNames.length) return
        goToGroup(groupNames[nextIndex])
    }

    async function recoverDays() {
        setRecovering(true); setActionError('')
        try {
            if (!recovery) {
                const { data } = await axios.get(`${API_URL}/roadmaps/${id}/recover-days`)
                setRecovery(data)
            } else {
                const { data } = await axios.post(`${API_URL}/roadmaps/${id}/recover-days`, { revision: recovery.revision })
                hasInitializedView.current = false
                setRecovery(null)
                navigate(`/roadmap/${data.id}`)
            }
        } catch (error) { setActionError(error.response?.data?.detail || 'The daily copy could not be prepared. Your original plan is still here.') }
        finally { setRecovering(false) }
    }

    const startEditingTask = (task) => {
        setEditingTaskId(task.id)
        setEditingTaskTitle(task.title)
    }

    const handleExportJSON = async () => {
        setIsExportMenuOpen(false)
        setIsExporting(true)
        setActionError('')
        try {
            const { data } = await axios.get(`${API_URL}/roadmaps/${id}/export`, { headers: authHeaders })
            const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }))
            const link = document.createElement('a')
            link.href = url
            link.download = `${roadmap.name.replace(/[^\p{L}\p{N}._-]/gu, '_')}.json`
            link.click()
            window.setTimeout(() => URL.revokeObjectURL(url), 2000)
        } catch (error) {
            console.error(error)
            setActionError('The JSON backup could not be saved. Try again.')
        } finally { setIsExporting(false) }
    }

    const handleExportPDF = async () => {
        setIsExporting(true)
        setIsExportMenuOpen(false)
        setActionError('')
        try {
            const [{ savePrintablePDF }, { data }] = await Promise.all([
                import('../utils/printDocument'),
                axios.get(`${API_URL}/roadmaps/${id}/export`, { headers: authHeaders }),
            ])
            await savePrintablePDF(data)
        } catch (error) {
            console.error('PDF Export failed', error)
            setActionError('The PDF could not be saved. Your roadmap is unchanged.')
        } finally { setIsExporting(false) }
    }

    const handleExportDoc = async () => {
        setIsExporting(true)
        setIsExportMenuOpen(false)
        setActionError('')
        try {
            const [{ Document, Packer, Paragraph, HeadingLevel }, { saveAs }] = await Promise.all([
                import('docx'),
                import('file-saver'),
            ])
            const children = [
                new Paragraph({
                    text: roadmap.name,
                    heading: HeadingLevel.TITLE,
                    spacing: { after: 300 },
                }),
                new Paragraph({
                    text: `Generated by Traqu - ${new Date().toLocaleDateString()}`,
                    spacing: { after: 500 },
                    style: 'Subtitle',
                }),
            ]

            let currentRoadmap = ''
            groupEntries.forEach(([group, groupTasks]) => {
                const meta = groupMeta[group] || { timeframe: group, roadmap: '' }
                if (meta.roadmap && meta.roadmap !== currentRoadmap) {
                    children.push(new Paragraph({
                        text: meta.roadmap,
                        heading: HeadingLevel.HEADING_1,
                        spacing: { before: 400, after: 200 },
                    }))
                    currentRoadmap = meta.roadmap
                }
                if (!meta.roadmap || meta.timeframe !== meta.roadmap) {
                    const scheduled = timeframes.find((timeframe) => timeframe.id === meta.timeframeId)
                    const dates = [scheduled?.start_date, scheduled?.end_date].filter(Boolean).join(' to ')
                    children.push(new Paragraph({
                        text: `${meta.timeframe}${dates ? ` · ${dates}` : ''}`,
                        heading: meta.roadmap ? HeadingLevel.HEADING_2 : HeadingLevel.HEADING_1,
                        spacing: { before: 300, after: 160 },
                    }))
                }

                groupTasks.forEach((task) => {
                    children.push(
                        new Paragraph({
                            text: `${task.is_done ? '[x]' : '[ ]'} ${task.title}`,
                            bullet: { level: 0 },
                        })
                    )
                    Object.entries(task.properties || {}).forEach(([key, value]) => {
                        const formatted = formatSemanticValue(value)
                        if (!formatted) return
                        children.push(new Paragraph({
                            text: `${key}: ${formatted}`,
                            indent: { left: 720 },
                            spacing: { after: 60 },
                        }))
                    })
                    ;(task.blocks || []).map(formatTaskBlockForText).filter(Boolean).forEach((blockText) => {
                        children.push(
                            new Paragraph({
                                text: blockText,
                                indent: { left: 720 },
                                spacing: { after: 80 },
                            })
                        )
                    })
                })
            })

            if (documentElements.length > 0) {
                children.push(new Paragraph({
                    text: 'Preserved source',
                    heading: HeadingLevel.HEADING_1,
                    pageBreakBefore: true,
                    spacing: { before: 400, after: 200 },
                }))
                children.push(new Paragraph({
                    text: 'Guidance, reference tables, dependencies, and source context from the imported document.',
                    spacing: { after: 240 },
                }))
                documentElements.forEach((element) => {
                    const isHeading = element?.type === 'heading'
                    documentElementToLines(element).forEach((line) => {
                        children.push(new Paragraph({
                            text: line,
                            heading: isHeading ? HeadingLevel.HEADING_2 : undefined,
                            spacing: { after: isHeading ? 140 : 70 },
                        }))
                    })
                })
            }

            const doc = new Document({
                sections: [{ properties: {}, children }],
            })

            const blob = await Packer.toBlob(doc)
            saveAs(blob, `${roadmap.name.replace(/\s+/g, '_')}.docx`)
        } catch (err) {
            console.error('Word Export failed', err)
            setActionError('The Word document could not be generated. No file was saved.')
        } finally {
            setIsExporting(false)
        }
    }

    if (loadError) return (
        <div className="feedback-state error-state" role="alert">
            <div><strong>Roadmap unavailable</strong><p>{loadError}</p></div>
            <Link to="/" className="btn-secondary"><ArrowLeft size={16} /> Back to library</Link>
        </div>
    )

    if (!roadmap) return (
        <div className="loading-state" role="status" aria-live="polite">
            <span className="loading-spinner" aria-hidden="true" />
            <strong>Building your roadmap view</strong>
            <span>Organizing sections, tasks, and progress…</span>
        </div>
    )

    return (
        <div className={`roadmap-shell ${isTocOpen ? 'toc-open' : ''}`}>
            <button
                ref={tocTriggerRef}
                type="button"
                className="toc-floating-btn btn-secondary"
                onClick={() => setIsTocOpen(true)}
                aria-expanded={isTocOpen}
                aria-controls="roadmap-contents"
                data-html2canvas-ignore
            >
                <PanelLeftOpen size={18} />
                Contents
            </button>

            <div className="toc-backdrop" onClick={() => setIsTocOpen(false)} aria-hidden="true" data-html2canvas-ignore />

            <aside
                id="roadmap-contents"
                ref={tocPanelRef}
                className="toc-panel glass-panel"
                role={isTocOpen ? 'dialog' : undefined}
                aria-modal={isTocOpen ? 'true' : undefined}
                aria-label="Roadmap contents"
                data-html2canvas-ignore
            >
                <div className="toc-header">
                    <div>
                        <span className="toc-kicker">Roadmap position</span>
                        <h3>
                            <ListTree size={18} />
                            Contents
                        </h3>
                    </div>
                    <button className="icon-btn toc-close" onClick={() => setIsTocOpen(false)} aria-label="Close contents">
                        <X size={18} />
                    </button>
                </div>

                <div className="toc-current">
                    <span>Current</span>
                    <strong>{viewMode === 'overview' ? (dailyPlan.days.length ? 'Your daily plan' : 'Roadmap overview') : (activeDay ? `${activeDay.week} / ${activeDay.title}` : activeEntry?.sectionTitle || 'No section selected')}</strong>
                    {viewMode === 'overview' ? (
                        <small>{dailyPlan.days.length || groupNames.length} {dailyPlan.days.length ? 'days' : 'sections'} · {totalTasks} tasks</small>
                    ) : (
                        <>
                            {activeEntry?.depth > 0 && <small>{activeEntry.title}</small>}
                            {activeEntry?.timeHint && <em>{activeEntry.timeHint}</em>}
                        </>
                    )}
                </div>

                <label className="toc-search">
                    <Search size={15} aria-hidden="true" />
                    <span className="sr-only">Filter sections</span>
                    <input
                        type="search"
                        placeholder={dailyPlan.days.length ? 'Find a week or day' : 'Filter sections'}
                        value={sectionSearch}
                        onChange={(event) => setSectionSearch(event.target.value)}
                    />
                </label>

                {dailyPlan.days.length > 0 && <DayContents plan={dailyPlan} onGroup={goToGroup} activeDay={activeDay} query={sectionSearch} onSelect={day => goToGroup(day.groups[0])} />}
                <div className="toc-list" hidden={dailyPlan.days.length > 0}>
                    {visibleOutlineSections.map((section) => (
                        <div className="toc-section" key={section.id}>
                            {section.entry ? (
                                <button
                                    type="button"
                                    className={`toc-section-header toc-section-button ${activeGroup === section.entry.group ? 'active' : ''}`}
                                    onClick={() => goToGroup(section.entry.group)}
                                >
                                    <span>{section.title}</span>
                                    <small>
                                        {section.doneCount}/{section.taskCount}
                                    </small>
                                    {section.entry.timeHint && <em>{section.entry.timeHint}</em>}
                                </button>
                            ) : (
                                <div className="toc-section-header">
                                    <span>{section.title}</span>
                                    <small>
                                        {section.doneCount}/{section.taskCount}
                                    </small>
                                </div>
                            )}

                            {section.children.map((child) => (
                                <button
                                    type="button"
                                    key={child.group}
                                    className={`toc-item depth-1 ${activeGroup === child.group ? 'active' : ''}`}
                                    onClick={() => goToGroup(child.group)}
                                >
                                    <span>{child.title}</span>
                                    <small>
                                        {child.doneCount}/{child.taskCount}
                                    </small>
                                    {child.timeHint && <em>{child.timeHint}</em>}
                                </button>
                            ))}
                        </div>
                    ))}
                </div>
            </aside>

            <main className={`roadmap-view ${dailyPlan.days.length ? 'has-daily-plan' : ''}`} ref={roadmapRef}>
            <div className="view-header" data-html2canvas-ignore>
                <div className="header-left">
                    <Link to="/" className="btn-secondary back-btn">
                        <ArrowLeft size={16} /> Library
                    </Link>
                </div>

                <div className="header-right">
                    <div className="export-menu-container" ref={exportMenuRef}>
                        <button
                            ref={exportTriggerRef}
                            className="btn-secondary"
                            onClick={() => setIsExportMenuOpen((current) => !current)}
                            disabled={isExporting}
                            aria-haspopup="menu"
                            aria-expanded={isExportMenuOpen}
                        >
                            {isExporting ? (
                                <span className="spinner-small"></span>
                            ) : (
                                <Download size={16} style={{ marginRight: '8px' }} />
                            )}
                            Save As
                            <ChevronDown size={14} style={{ marginLeft: '6px' }} />
                        </button>

                        {isExportMenuOpen && (
                                <div className="dropdown-menu" role="menu" aria-label="Export format">
                                    <button className="dropdown-item" role="menuitem" onClick={handleExportPDF}>
                                        <FileText size={16} /> PDF
                                    </button>
                                    <button className="dropdown-item" role="menuitem" onClick={handleExportJSON}>
                                        <Download size={16} /> JSON backup
                                    </button>
                                    <button className="dropdown-item" role="menuitem" onClick={handleExportDoc}>
                                        <FileText size={16} /> Word Doc
                                    </button>
                                </div>
                        )}
                    </div>

                    <Link to={`/edit/${id}`} className="btn-secondary">
                            <Edit2 size={16} />
                            Edit raw
                    </Link>
                </div>
            </div>

            {actionError && (
                <div className="inline-error roadmap-action-error" role="alert">
                    <span>{actionError}</span>
                    <button type="button" className="icon-btn" onClick={() => setActionError('')} aria-label="Dismiss error">
                        <X size={15} />
                    </button>
                </div>
            )}

            <div className="roadmap-hero">
                <div className="hero-top">
                    {isEditingName ? (
                        <div className="edit-name-container">
                            <input
                                type="text"
                                value={newName}
                                onChange={(event) => setNewName(event.target.value)}
                                onKeyDown={(event) => {
                                    if (event.key === 'Enter') saveName()
                                    if (event.key === 'Escape') {
                                        setNewName(roadmap.name)
                                        setIsEditingName(false)
                                    }
                                }}
                                disabled={isSavingName}
                                className="name-input"
                                autoFocus
                            />
                            <button className="icon-btn save-btn" onClick={saveName} disabled={isSavingName} aria-label="Save roadmap name">
                                <Save size={20} />
                            </button>
                            <button
                                className="icon-btn cancel-btn"
                                onClick={() => {
                                    setNewName(roadmap.name)
                                    setIsEditingName(false)
                                }}
                                disabled={isSavingName}
                                aria-label="Cancel roadmap rename"
                            >
                                <X size={20} />
                            </button>
                        </div>
                    ) : (
                        <div className="title-container">
                            <h2>{roadmap.name}</h2>
                            <button
                                className="icon-btn edit-name-btn"
                                onClick={() => {
                                    setNewName(roadmap.name)
                                    setActionError('')
                                    setIsEditingName(true)
                                }}
                                data-html2canvas-ignore
                                aria-label="Rename roadmap"
                            >
                                <Edit2 size={16} />
                            </button>
                        </div>
                    )}
                    <span className="date-badge">
                        <Calendar size={14} /> {new Date(roadmap.created_at).toLocaleDateString()}
                    </span>
                </div>

                <div className="progress-section large">
                    <div className="progress-info">
                        <span className="progress-text">
                            {completedTasks}/{totalTasks} tasks completed
                        </span>
                        <span className="progress-percentage">{percentage}%</span>
                    </div>
                    <div
                        className="progress-bar large"
                        role="progressbar"
                        aria-label="Roadmap completion"
                        aria-valuemin="0"
                        aria-valuemax="100"
                        aria-valuenow={percentage}
                    >
                        <div className="progress-fill" style={{ width: `${percentage}%` }} />
                    </div>
                </div>

                <div className="roadmap-tools" data-html2canvas-ignore>
                    {percentage === 100 && tasks.length > 0 && <div className="completion-note" role="status">
                    <Companion mood="complete" size={72} />
                    <div><strong>A little further along.</strong><p>Every step in this plan is complete. Nice work.</p></div>
                </div>}
                <div className="view-mode-row">
                        <div className="segmented-control view-mode-control" role="group" aria-label="Roadmap view">
                            <button
                                type="button"
                                className={viewMode === 'overview' ? 'active' : ''}
                                onClick={() => setViewMode('overview')}
                                aria-pressed={viewMode === 'overview'}
                            >
                                <LayoutGrid size={15} /> {dailyPlan.days.length ? 'Days' : 'Overview'}
                            </button>
                            <button
                                type="button"
                                className={viewMode === 'focus' ? 'active' : ''}
                                onClick={() => setViewMode('focus')}
                                disabled={!activeGroup}
                                aria-pressed={viewMode === 'focus'}
                            >
                                <ListTree size={15} /> {dailyPlan.days.length ? 'Day checklist' : 'Focus'}
                            </button>
                        </div>
                        {isLargeRoadmap && <span className="scale-badge">{totalTasks} tasks · one {dailyPlan.days.length ? 'day' : 'section'} at a time</span>}
                    </div>

                    {viewMode === 'focus' && activeEntry && (
                        <div className="location-strip">
                            <span>Current location</span>
                            <strong>{activeEntry.sectionTitle}</strong>
                            {activeEntry.depth > 0 && <small>{activeEntry.title}</small>}
                            {activeEntry.timeHint && <em>{activeEntry.timeHint}</em>}
                        </div>
                    )}

                    <div className="roadmap-search">
                        <Search size={18} aria-hidden="true" />
                        <input
                            type="search"
                            placeholder={viewMode === 'overview' ? 'Search tasks, fields, and details' : `Search in ${activeGroupMeta.timeframe || 'this section'}`}
                            value={searchTerm}
                            onChange={(event) => setSearchTerm(event.target.value)}
                        />
                    </div>

                    <div className="tool-row">
                        <div className="segmented-control" role="group" aria-label="Task status filter">
                            {statusFilters.map((filter) => (
                                <button
                                    key={filter.value}
                                    type="button"
                                    className={statusFilter === filter.value ? 'active' : ''}
                                    onClick={() => setStatusFilter(filter.value)}
                                    aria-pressed={statusFilter === filter.value}
                                >
                                    {filter.label}
                                </button>
                            ))}
                        </div>

                    </div>

                    <div className="result-summary" role="status" aria-live="polite">
                        {viewMode === 'overview'
                            ? `${dailyPlan.days.length ? `${dailyPlan.days.length} days` : `${visibleGroupedTasks.length} sections`} · ${visibleTasksCount} matching tasks`
                            : `${visibleTasksCount} of ${activeDay?.total ?? (groupedTasks[activeGroup] || []).length} tasks in this ${activeDay ? 'day' : 'section'}`}
                    </div>
                </div>
            </div>

            {!dailyPlan.days.length && documentElements.some(element => /\bday\s*\d+\b/i.test(element.text || '')) && <section className="recover-days" aria-label="Recover day structure">
                <div><strong>Your source has days. Let’s bring them back.</strong><p>{recovery?.available ? `${recovery.days} days · ${recovery.tasks.length} actions · ${recovery.matched} task states matched. ${recovery.unmatched || 0} unmatched rows remain in your original. Your original plan and full source will stay available.` : recovery?.message || 'Preview a daily copy with dates, real checkboxes, and context attached to each action.'}</p></div>
                <button type="button" className="btn-secondary" onClick={recoverDays} disabled={recovering || recovery?.available === false}>{recovering ? 'Preparing…' : recovery?.available ? 'Create daily copy' : 'Preview daily copy'}</button>
            </section>}
            <ImportedDocument elements={documentElements} />

            {dailyPlan.days.length > 0 && viewMode === 'overview' && <DayCards visibleTasks={visibleGroupedTasks.flatMap(([, items]) => items)} plan={dailyPlan} onSelect={day => goToGroup(day.groups[0])} />}

            {activeDay && viewMode === 'focus' && <section className={`day-session ${activeDay.done === activeDay.total ? 'complete' : ''}`} aria-label={`${activeDay.title} session`}>
                <div><span className="eyebrow">{activeDay.week}</span><h2>{activeDay.title}<span>{dayDate(activeDay.date)}</span></h2><p>{activeDay.done === activeDay.total ? 'A day well spent. Your progress is saved.' : `${activeDay.total - activeDay.done} actions left · one small step at a time`}</p></div>
                <div className="day-session-actions"><button type="button" className="btn-quiet" onClick={() => setViewMode('overview')}>All days</button>
                {activeDay.done === activeDay.total ? nextDay && <button className="btn-primary" type="button" onClick={() => goToGroup(nextDay.groups[0])}>Start {nextDay.title}<ArrowRight size={15} /></button>
                    : <><button type="button" className="btn-primary" onClick={() => { setStartedDay(activeDay.key); document.getElementById('day-checklist')?.scrollIntoView({ behavior: reducedMotion || profile.reduced_motion ? 'auto' : 'smooth', block: 'start' }) }}>{startedDay === activeDay.key ? 'Continue' : 'Start'} {activeDay.title}<ArrowRight size={15} /></button>
                    <button type="button" className="btn-secondary" onClick={() => updateGroupStatus(activeDay.tasks, true)} disabled={activeDay.tasks.some(task => pendingStatusTaskIds.has(task.id))}><CheckCircle2 size={15} />Mark day complete</button></>}
                </div>
            </section>}

            {viewMode === 'overview' && !dailyPlan.days.length ? (
                <section className="roadmap-overview" aria-label="Roadmap section overview">
                    {resumeEntry && resumeTask && (
                        <button type="button" className="continue-card" onClick={() => goToGroup(resumeEntry[0])}>
                            <span className="continue-icon"><ArrowRight size={20} /></span>
                            <span className="continue-copy">
                                <small>Continue roadmap</small>
                                <strong>{resumeMeta?.timeframe}</strong>
                                {resumeMeta?.roadmap && resumeMeta.roadmap !== resumeMeta.timeframe && <small>{resumeMeta.roadmap}</small>}
                                <span>{resumeTask.title}</span>
                            </span>
                            <span className="continue-action">Open section <ArrowRight size={15} /></span>
                        </button>
                    )}

                    <div className="overview-heading">
                        <div>
                            <span className="eyebrow">Section index</span>
                            <h3>Choose one area to work on</h3>
                        </div>
                        <span>{visibleGroupedTasks.length} of {groupNames.length} sections</span>
                    </div>

                    {visibleGroupedTasks.length === 0 ? (
                        <div className="empty-state glass-panel">
                            No sections contain tasks matching this search and status.
                        </div>
                    ) : (
                        <div className="overview-roots">
                            {visibleOverviewRoots.map((root, rootIndex) => (
                                <section className="overview-root" key={root.title || `legacy-${rootIndex}`}>
                                    {root.title && (
                                        <div className="overview-root-heading">
                                            <h4>{root.title}</h4>
                                            <span>{root.groups.length} {root.groups.length === 1 ? 'section' : 'sections'}</span>
                                        </div>
                                    )}
                                    <div className="section-grid">
                                        {root.groups.map(([group, matchingTasks]) => {
                                            const meta = groupMeta[group] || { timeframe: group, roadmap: '' }
                                            const allGroupTasks = groupedTasks[group] || []
                                            const doneCount = allGroupTasks.filter((task) => task.is_done).length
                                            const groupPercentage = allGroupTasks.length
                                                ? Math.round((doneCount / allGroupTasks.length) * 100)
                                                : 0
                                            const nextTask = allGroupTasks.find((task) => !task.is_done)
                                            const sectionNumber = (groupIndexByName.get(group) ?? 0) + 1

                                            return (
                                                <button type="button" className="section-overview-card" key={group} onClick={() => goToGroup(group)}>
                                                    <span className="section-card-meta">
                                                        <span>{String(sectionNumber).padStart(2, '0')}</span>
                                                        <strong>{doneCount}/{allGroupTasks.length}</strong>
                                                    </span>
                                                    <h4>{meta.timeframe}</h4>
                                                    <span
                                                        className="section-card-progress"
                                                        role="progressbar"
                                                        aria-label={`${meta.timeframe} completion`}
                                                        aria-valuemin="0"
                                                        aria-valuemax="100"
                                                        aria-valuenow={groupPercentage}
                                                    >
                                                        <span style={{ width: `${groupPercentage}%` }} />
                                                    </span>
                                                    <span className="section-card-next">
                                                        {nextTask ? `Next · ${nextTask.title}` : 'Section complete'}
                                                    </span>
                                                    {deferredSearchTerm.trim() && (
                                                        <span className="section-match-count">{matchingTasks.length} matching tasks</span>
                                                    )}
                                                    <span className="section-card-open">Focus <ArrowRight size={14} /></span>
                                                </button>
                                            )
                                        })}
                                    </div>
                                </section>
                            ))}
                        </div>
                    )}
                </section>
            ) : viewMode === 'focus' ? (
                <div className="timeline" id="day-checklist">
                    <nav className="focus-navigation" aria-label="Section navigation" data-html2canvas-ignore>
                        <button
                            type="button"
                            className="btn-secondary btn-small"
                            onClick={() => moveFocus(-1)}
                            disabled={activeDay ? dailyPlan.days.indexOf(activeDay) <= 0 : activeGroupIndex <= 0}
                        >
                            <ChevronLeft size={16} /> Previous
                        </button>
                        <span>{activeDay ? `${activeDay.title} · ${dailyPlan.days.indexOf(activeDay) + 1} of ${dailyPlan.days.length} days` : `Section ${activeGroupIndex + 1} of ${groupNames.length}`}</span>
                        <button
                            type="button"
                            className="btn-secondary btn-small"
                            onClick={() => moveFocus(1)}
                            disabled={activeDay ? dailyPlan.days.indexOf(activeDay) >= dailyPlan.days.length - 1 : activeGroupIndex < 0 || activeGroupIndex >= groupNames.length - 1}
                        >
                            Next <ChevronRight size={16} />
                        </button>
                    </nav>

                    {!activeGroup ? (
                        <div className="empty-state glass-panel">This roadmap has no sections yet.</div>
                    ) : (
                        (activeDay ? activeDay.groups.map(group => [group, visibleGroupedTasks.find(([key]) => key === group)?.[1] || []]) : [[activeGroup, activeGroupTasks]]).map(([group, groupTasks], groupIndex) => {
                        const meta = groupMeta[group] || { timeframe: group, roadmap: '' }
                        const timeframeData = meta.timeframeId
                            ? timeframes.find((timeframe) => Number(timeframe.id) === meta.timeframeId)
                            : timeframes.find((timeframe) => timeframe.label === meta.timeframe)
                        const allGroupTasks = groupedTasks[group] || []
                        const groupDoneCount = allGroupTasks.filter((task) => task.is_done).length
                        const groupIsDone = allGroupTasks.length > 0 && groupDoneCount === allGroupTasks.length

                        return (
                            <section
                                key={group}
                                data-group={meta.timeframe}
                                id={`roadmap-section-${outline.byGroup[group]?.id || activeGroupIndex || groupIndex}`}
                                className="timeframe-group"
                            >
                                {outline.byGroup[group]?.depth > 0 && (
                                    <div className="section-breadcrumb" data-html2canvas-ignore>
                                        <span>{outline.byGroup[group].sectionTitle}</span>
                                        <ChevronRight size={14} />
                                        <strong>{outline.byGroup[group].title}</strong>
                                        {outline.byGroup[group].timeHint && <em>{outline.byGroup[group].timeHint}</em>}
                                    </div>
                                )}

                                {timeframeData ? (
                                    <TimeframeHeader timeframe={timeframeData} onUpdate={fetchTimeframes} />
                                ) : (
                                    <h3 className="timeframe-label">{meta.timeframe}</h3>
                                )}

                                <div className="group-toolbar" data-html2canvas-ignore>
                                    <span className="group-progress">
                                        {groupDoneCount}/{allGroupTasks.length} done
                                    </span>
                                    <button
                                        type="button"
                                        className="btn-secondary btn-small"
                                        onClick={() => updateGroupStatus(allGroupTasks, !groupIsDone)}
                                        disabled={allGroupTasks.some((task) => pendingStatusTaskIds.has(task.id))}
                                    >
                                        {groupIsDone ? <Circle size={15} /> : <CheckCircle2 size={15} />}
                                        {groupIsDone ? 'Mark open' : 'Mark done'}
                                    </button>
                                </div>

                                <div className="tasks-list">
                                            {groupTasks.length === 0 && (
                                                <div className="task-filter-empty">
                                                    No tasks in this section match the current search and status.
                                                </div>
                                            )}
                                            {groupTasks.map((task) => {
                                                const isEditingTask = editingTaskId === task.id
                                                return (
                                                    <div
                                                        key={task.id}
                                                        className={`task-item ${task.is_done ? 'done' : ''}`}
                                                    >
                                                        <button
                                                            type="button"
                                                            className={`custom-checkbox ${task.is_done ? 'checked' : ''}`}
                                                            onClick={() => toggleTask(task.id, task.is_done)}
                                                            disabled={pendingStatusTaskIds.has(task.id)}
                                                            aria-label={`${task.is_done ? 'Mark open' : 'Mark complete'}: ${task.title}`}
                                                            aria-pressed={task.is_done}
                                                        />

                                                        {isEditingTask ? (
                                                            <div
                                                                className="task-edit-row"
                                                                onClick={(event) => event.stopPropagation()}
                                                            >
                                                                <input
                                                                    value={editingTaskTitle}
                                                                    onChange={(event) => setEditingTaskTitle(event.target.value)}
                                                                    onKeyDown={(event) => {
                                                                        if (event.key === 'Enter') saveTaskTitle(task.id)
                                                                        if (event.key === 'Escape') setEditingTaskId(null)
                                                                    }}
                                                                    disabled={savingTaskId === task.id}
                                                                    autoFocus
                                                                />
                                                                <button
                                                                    className="icon-btn save-btn"
                                                                    onClick={() => saveTaskTitle(task.id)}
                                                                    disabled={savingTaskId === task.id}
                                                                    aria-label="Save task title"
                                                                >
                                                                    <Save size={17} />
                                                                </button>
                                                                <button
                                                                    className="icon-btn cancel-btn"
                                                                    onClick={() => setEditingTaskId(null)}
                                                                    disabled={savingTaskId === task.id}
                                                                    aria-label="Cancel task edit"
                                                                >
                                                                    <X size={17} />
                                                                </button>
                                                            </div>
                                                        ) : (
                                                            <>
                                                                <div className="task-content">
                                                                    <span className="task-title">{task.title}</span>
                                                                    <TaskBlocks
                                                                        task={task}
                                                                        sectionTasks={allGroupTasks}
                                                                        roadmapTasks={tasks}
                                                                        onBlocksChange={(blocks) => updateTaskBlocks(task.id, blocks)}
                                                                        onBulkBlocksChange={updateBulkTaskBlocks}
                                                                    />
                                                                </div>
                                                                <div className="task-actions">
                                                                    <button
                                                                        className="icon-btn"
                                                                        onClick={() => startEditingTask(task)}
                                                                        aria-label="Edit task"
                                                                    >
                                                                        <Edit2 size={16} />
                                                                    </button>
                                                                    <button
                                                                        className="icon-btn delete-btn-visible"
                                                                        onClick={() => deleteTask(task.id)}
                                                                        aria-label="Delete task"
                                                                    >
                                                                        <Trash2 size={16} />
                                                                    </button>
                                                                </div>
                                                            </>
                                                        )}
                                                    </div>
                                                )
                                            })}

                                            <div className="add-task-row" data-html2canvas-ignore>
                                                <input
                                                    value={newTaskTitles[group] || ''}
                                                    onChange={(event) =>
                                                        setNewTaskTitles((current) => ({
                                                            ...current,
                                                            [group]: event.target.value,
                                                        }))
                                                    }
                                                    onKeyDown={(event) => {
                                                        if (event.key === 'Enter') createTask(group)
                                                    }}
                                                    disabled={creatingGroup === group}
                                                    placeholder={`Add task to ${meta.timeframe}`}
                                                />
                                                <button
                                                    className="btn-primary btn-small"
                                                    onClick={() => createTask(group)}
                                                    disabled={creatingGroup === group || !(newTaskTitles[group] || '').trim()}
                                                >
                                                    <Plus size={16} />
                                                    {creatingGroup === group ? 'Adding…' : 'Add'}
                                                </button>
                                            </div>
                                </div>
                            </section>
                        )
                    })
                )}
            </div>
            ) : null}

            </main>
        </div>
    )
}
