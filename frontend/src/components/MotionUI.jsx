import { LazyMotion, domAnimation, MotionConfig, AnimatePresence, useReducedMotion } from 'motion/react'
import * as m from 'motion/react-m'
import { useCallback, useEffect, useId, useRef, useState } from 'react'

export function MotionProvider({ children }) {
    return <LazyMotion features={domAnimation} strict>
        <MotionConfig reducedMotion="user" transition={{ type: 'spring', stiffness: 420, damping: 36, mass: 0.85 }}>
            {children}
        </MotionConfig>
    </LazyMotion>
}

export function RouteTransition({ routeKey, children }) {
    const reduced = useReducedMotion()
    return <AnimatePresence initial={false} mode="wait">
        <m.div key={routeKey} className="route-view"
            initial={reduced ? { opacity: 0 } : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduced ? { opacity: 0 } : { opacity: 0, y: -4 }}
            transition={{ duration: reduced ? 0.08 : 0.22, ease: [0.22, 1, 0.36, 1] }}>
            {children}
        </m.div>
    </AnimatePresence>
}

export function Companion({ mood = 'welcome', size = 136, className = '' }) {
    const reduced = useReducedMotion()
    const helpId = useId()
    const stage = useRef(null)
    const settle = useRef(null)
    const current = useRef('steady')
    const resting = useRef(false)
    const sequence = useRef(0)
    const [action, setAction] = useState({ name: 'steady', sequence: 0, direction: 1 })
    const [visible, setVisible] = useState(true)
    const [paused, setPaused] = useState(false)

    const play = useCallback((name, direction = 1, loops = 1) => {
        window.clearTimeout(settle.current)
        const next = reduced ? 'steady' : name
        current.current = next
        setAction({ name: next, direction, loops, sequence: ++sequence.current })
        if (next !== 'steady') {
            const duration = next === 'run' ? 660 : next === 'hop' ? 620 : 1080
            settle.current = window.setTimeout(() => {
                current.current = 'steady'
                setAction(previous => ({ ...previous, name: 'steady' }))
            }, duration * loops)
        }
    }, [reduced])

    useEffect(() => {
        let inView = true
        const update = () => setVisible(inView && !document.hidden && document.hasFocus())
        const observer = new IntersectionObserver(([entry]) => { inView = entry.isIntersecting; update() })
        observer.observe(stage.current)
        document.addEventListener('visibilitychange', update)
        window.addEventListener('focus', update)
        window.addEventListener('blur', update)
        return () => {
            observer.disconnect()
            document.removeEventListener('visibilitychange', update)
            window.removeEventListener('focus', update)
            window.removeEventListener('blur', update)
            window.clearTimeout(settle.current)
        }
    }, [])

    useEffect(() => {
        if (!visible || reduced || resting.current) { play('steady'); return }
        play(mood === 'thinking' ? 'run' : 'wave', 1, mood === 'thinking' ? 3 : 1)
    }, [mood, visible, reduced, play])

    useEffect(() => {
        if (!visible || reduced || paused || mood === 'thinking') return
        let count = 0
        const timer = window.setInterval(() => {
            if (current.current === 'steady') play(++count % 3 === 0 ? 'sway' : 'blink')
        }, 18_000)
        return () => window.clearInterval(timer)
    }, [visible, reduced, paused, mood, play])

    const interact = (name, direction = 1) => { resting.current = false; setPaused(false); play(name, direction, name === 'run' ? 2 : 1) }
    const row = action.name === 'run' ? 1 : action.name === 'sway' ? 2 : ['wave', 'hop'].includes(action.name) ? 3 : 0
    return <div className={`companion companion-${mood} ${className}`} style={{ width: size, height: size }}>
        <button ref={stage} type="button" className="qu-stage" data-state={action.name}
            aria-label="Play with Qu, your Traqu companion" aria-describedby={helpId}
            title="Qu · click to hop · double-click to run · S to sway · Esc to rest"
            onPointerEnter={() => { if (!paused && current.current === 'steady') play('wave') }}
            onClick={() => interact('hop')} onDoubleClick={() => interact('run')}
            onKeyDown={event => {
                if (event.ctrlKey || event.metaKey || event.altKey) return
                const key = event.key.toLowerCase()
                if (!['escape', 'arrowleft', 'arrowright', 'r', 's', 'w'].includes(key)) return
                event.preventDefault()
                if (key === 'escape') { resting.current = true; setPaused(true); play('steady') }
                else interact(key === 's' ? 'sway' : key === 'w' ? 'wave' : 'run', key === 'arrowleft' ? -1 : 1)
            }}>
            <span key={action.sequence} className={`qu-body qu-${action.name}`} style={{ '--qu-direction': action.direction, '--qu-loops': action.loops || 1 }}>
                <span className="qu-sprite" style={{ '--qu-row': row, '--qu-duration': action.name === 'run' ? '660ms' : '1080ms', '--qu-loops': action.loops || 1 }}>
                    <img className={`qu-sheet ${action.name === 'steady' || action.name === 'hop' ? '' : 'qu-animate'}`}
                        src="/characters/qu-sprites.png" alt="" draggable="false" decoding="async" />
                </span>
            </span>
        </button>
        <span id={helpId} className="qu-help">Click or press Enter to hop. Double-click, R, or arrow keys to run. S to sway, W to wave, Escape to rest.</span>
    </div>
}
