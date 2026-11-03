import { Link, useLocation } from 'react-router-dom'
import { Plus, Library, Sparkles, ArrowDownToLine } from 'lucide-react'
import TraquLogo from './TraquLogo'
import { IS_DESKTOP } from '../config'

export default function Navbar() {
    const location = useLocation()
    const links = [
        { path: '/', label: 'Library', icon: Library },
        { path: '/import', label: 'New', icon: Plus },
        ...(!IS_DESKTOP ? [
            { path: '/agents', label: 'Agent guide', icon: Sparkles },
            { path: '/downloads', label: 'Downloads', icon: ArrowDownToLine },
        ] : []),
    ]

    return (
        <header className={`navbar-custom ${IS_DESKTOP ? 'desktop-navbar' : ''}`}>
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

                <span className="local-status"><i aria-hidden="true" /> {IS_DESKTOP ? 'Local' : 'Web'}</span>
            </div>
        </header>
    )
}
