import { useState } from 'react'
import { Menu, Trophy } from 'lucide-react'

interface NavProps {
    onMobileMenuClick?: () => void
}

/**
 * Navigation component matching www site branding
 */
export function Nav({ onMobileMenuClick }: NavProps) {
    const [showLeaderboardMsg, setShowLeaderboardMsg] = useState(false)

    return (
        <>
        <nav className="nav">
            <div className="nav-left">
                <a href="https://fabraix.com" className="logo">FABRAIX</a>
            </div>
            <div className="nav-right">
                <button
                    className="nav-link"
                    onClick={() => setShowLeaderboardMsg(true)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                >
                    <Trophy size={16} />
                    Leaderboard
                </button>
                <a
                    href="https://github.com/fabraix/playground"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="nav-link"
                    aria-label="GitHub"
                >
                    <svg
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                        aria-hidden="true"
                    >
                        <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
                    </svg>
                </a>
                <a
                    href="https://docs.fabraix.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="nav-link"
                >
                    Docs
                </a>
                <a href="https://app.fabraix.com" className="nav-cta">
                    Try the Platform
                </a>
                {onMobileMenuClick && (
                    <button
                        className="mobile-menu-btn"
                        onClick={onMobileMenuClick}
                        aria-label="Open analysis panel"
                    >
                        <Menu size={20} />
                    </button>
                )}
            </div>
        </nav>
        {showLeaderboardMsg && (
            <div
                style={{
                    position: 'fixed',
                    inset: 0,
                    zIndex: 1000,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'rgba(0,0,0,0.6)',
                    backdropFilter: 'blur(4px)',
                }}
                onClick={() => setShowLeaderboardMsg(false)}
            >
                <div
                    style={{
                        background: 'var(--bg-secondary, #1a1a1b)',
                        border: '1px solid var(--border, #333)',
                        borderRadius: '0.75rem',
                        padding: '2rem 2.5rem',
                        textAlign: 'center',
                        maxWidth: '400px',
                    }}
                    onClick={(e) => e.stopPropagation()}
                >
                    <Trophy size={32} style={{ margin: '0 auto 1rem', color: 'var(--accent, #D08B5B)' }} />
                    <h3 style={{ margin: '0 0 0.5rem', fontSize: '1.1rem', color: 'var(--text-primary, #fafafa)' }}>
                        Leaderboard Coming Soon
                    </h3>
                    <p style={{ margin: '0 0 1.5rem', fontSize: '0.85rem', color: 'var(--text-tertiary, #888)' }}>
                        Need more submissions to display the leaderboard.
                    </p>
                    <button
                        onClick={() => setShowLeaderboardMsg(false)}
                        className="nav-cta"
                        style={{ cursor: 'pointer' }}
                    >
                        Got it
                    </button>
                </div>
            </div>
        )}
        </>
    )
}
