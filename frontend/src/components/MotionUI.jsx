import { LazyMotion, domAnimation, MotionConfig, AnimatePresence, useReducedMotion } from 'motion/react'
import * as m from 'motion/react-m'

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
    const moving = !reduced && mood === 'thinking'
    return <m.div className={`companion companion-${mood} ${className}`} aria-hidden="true"
        style={{ width: size, height: size }}
        initial={reduced ? false : { opacity: 0, y: 5, rotate: -4 }}
        animate={moving ? { opacity: 1, y: [0, -4, 0], rotate: [0, 2, 0] } : { opacity: 1, y: 0, rotate: 0 }}
        transition={moving ? { duration: 1.8, repeat: 2, ease: 'easeInOut' } : { duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        whileHover={reduced ? undefined : { y: -3, rotate: -3 }}>
        <img src="/characters/qu.png" width={size} height={size} alt="" draggable="false" decoding="async" />
    </m.div>
}
