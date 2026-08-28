import { LogIn, X } from 'lucide-react'
import { useAuth } from '@/context/auth'

/**
 * Re-login prompt shown when a live session's token lapsed mid-play. It replaces
 * the two confusing symptoms of an expired token — a silent logout on /auth/me and
 * a misleading "this session isn't yours" 403 on restart — with one clear, actionable
 * message. Rendered in the persistent shell so it surfaces on whatever tab the player
 * is on. Dismissable, since anonymous play is still allowed (just not prize-eligible).
 */
export function SessionExpiredBanner() {
    const { sessionExpired, login, dismissSessionExpired } = useAuth()

    if (!sessionExpired) return null

    return (
        <div className="pg-session-banner" role="alert">
            <span className="pg-session-banner-text">
                Your session expired. Log in again to keep playing and stay on the leaderboard.
            </span>
            <div className="pg-session-banner-actions">
                <button className="nav-cta" onClick={() => login()}>
                    <LogIn size={15} />
                    Log in
                </button>
                <button
                    className="pg-session-banner-close"
                    onClick={dismissSessionExpired}
                    aria-label="Dismiss"
                    title="Dismiss"
                >
                    <X size={16} />
                </button>
            </div>
        </div>
    )
}
