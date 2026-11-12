import { Link, useLocation } from 'react-router-dom'
import { Plus, Library, Sparkles, ArrowDownToLine, UserRound } from 'lucide-react'
import TraquLogo from './TraquLogo'
import NotificationCenter from './NotificationCenter'
import { IS_NATIVE, IS_MOBILE } from '../config'
import { Companion } from './MotionUI'

export default function Navbar() {
    const location = useLocation()
    const links = [
        { path: '/', label: 'Library', icon: Library },
        { path: '/import', label: 'New', icon: Plus },
        { path: '/profile', label: 'Profile', icon: UserRound },
        ...(!IS_NATIVE ? [
            { path: '/agents', label: 'Agent guide', icon: Sparkles },
            { path: '/downloads', label: 'Downloads', icon: ArrowDownToLine },
        ] : []),
    ]

    return (
        <header className={`navbar-custom ${IS_NATIVE ? 'desktop-navbar' : ''}`}>
            <div className="navbar-inner">
                <Link to="/" className="brand-lockup" aria-label="Traqu home">
                    <TraquLogo className="brand-mark" />
                    <span className="brand-wordmark">
                        <strong>Traqu</strong>
                        <small>Document workspace</small>
                    </span>
                </Link>

                <nav className="nav-links" aria-label="Primary navigation">
                    {links.map((link) => {
                        const isLibraryRoute = link.path === '/' && (
                            location.pathname === '/' ||
                            location.pathname.startsWith('/roadmap/') ||
                            location.pathname.startsWith('/edit/')
                        )
                        const isActive = isLibraryRoute || location.pathname === link.path
                        return (
                            <Link
                                to={link.path}
                                key={link.path}
                                className={`nav-link-container ${isActive ? 'active' : ''}`}
                                aria-current={isActive ? 'page' : undefined}
                            >
                                <link.icon size={15} aria-hidden="true" />
                                <span>{link.label}</span>
                            </Link>
                        )
                    })}
                </nav>

                <div className="navbar-status">
                    <NotificationCenter />
                    {/\/(?:roadmap|edit)\//.test(location.pathname) && <Companion size={48} className="qu-mini" />}
                    <span className="local-status"><i aria-hidden="true" /> {IS_MOBILE ? 'On device' : IS_NATIVE ? 'Local' : 'Web'}</span>
                </div>
            </div>
        </header>
    )
}
