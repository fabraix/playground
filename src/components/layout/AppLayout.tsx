import { Outlet } from 'react-router-dom'
import { Nav } from './Nav'
import { TabNav } from './TabNav'
import { ChallengeRail } from './ChallengeRail'
import { SessionExpiredBanner } from './SessionExpiredBanner'
import { usePlatform } from '@/context/platform'

/**
 * Persistent platform shell: a top header (wordmark + account controls), then a
 * body split into the left challenge rail (the arena's anchor) and a workspace
 * holding the underline tab nav + the centered routed <Outlet/>. Shared data
 * (active challenge, weekly summary) is loaded once by PlatformProvider and read
 * via usePlatform(), so the shell just orchestrates layout + the global gates.
 */
export function AppLayout() {
    const { isLoading, error, challenge } = usePlatform()

    if (isLoading) {
        return (
            <div className="app">
                <Nav />
                <main className="pg-main">
                    <div className="loading-container">
                        <div className="loading-spinner" />
                        <p>Initializing playground…</p>
                    </div>
                </main>
            </div>
        )
    }

    if (error || !challenge) {
        return (
            <div className="app">
                <Nav />
                <main className="pg-main">
                    <div className="error-container">
                        <p>{error || 'Failed to load challenge data'}</p>
                        <button onClick={() => window.location.reload()} className="btn">
                            Retry
                        </button>
                    </div>
                </main>
            </div>
        )
    }

    return (
        <div className="app">
            <Nav />
            <SessionExpiredBanner />
            <div className="pg-body">
                <ChallengeRail />
                <div className="pg-workspace">
                    <TabNav />
                    <main className="pg-main">
                        <div className="pg-container">
                            <Outlet />
                        </div>
                    </main>
                </div>
            </div>
        </div>
    )
}
