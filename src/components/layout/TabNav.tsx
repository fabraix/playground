import { useEffect, useRef } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { Lock } from 'lucide-react'
import { useAuth } from '@/context/auth'

interface TabDef {
    to: string
    label: string
    /** Requires login; anonymous users see a small lock indicator. */
    gated?: boolean
}

const TABS: TabDef[] = [
    { to: '/', label: 'Briefing' },
    { to: '/chat', label: 'Chat' },
    { to: '/standings', label: 'Standings' },
    { to: '/history', label: 'History', gated: true },
    { to: '/submissions', label: 'Submissions', gated: true },
    { to: '/rewards', label: 'Rewards' },
]

/**
 * The primary tab navigation - horizontal bottom-border underline tabs (mirrors
 * the product app). The challenge + prize context now lives in the left rail
 * (ChallengeRail), so this is just the tabs.
 */
export function TabNav() {
    const { user } = useAuth()
    const navRef = useRef<HTMLElement>(null)
    const { pathname } = useLocation()

    // The bar scrolls horizontally on phones - keep the active tab in view (a
    // deep link / reload on an off-screen tab would otherwise show no active
    // indicator at all).
    useEffect(() => {
        navRef.current
            ?.querySelector('.pg-tab-active')
            ?.scrollIntoView({ inline: 'nearest', block: 'nearest' })
    }, [pathname])

    return (
        <nav className="pg-tabnav" aria-label="Primary" ref={navRef}>
            <div className="pg-tabnav-inner">
                {TABS.map(({ to, label, gated }) => (
                    <NavLink
                        key={to}
                        to={to}
                        end={to === '/'}
                        className={({ isActive }) => `pg-tab${isActive ? ' pg-tab-active' : ''}`}
                    >
                        {label}
                        {gated && !user && (
                            <Lock size={12} className="pg-tab-lock" aria-label="Sign in required" />
                        )}
                    </NavLink>
                ))}
            </div>
        </nav>
    )
}
