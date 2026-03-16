import { useState, useEffect } from 'react'
import { Menu, Trophy, Loader2 } from 'lucide-react'
import { fetchLeaderboard } from '@/api'
import type { LeaderboardEntry } from '@/types'

interface NavProps {
    challengeId?: string
    onMobileMenuClick?: () => void
}

/**
 * Navigation component matching www site branding
 */
export function Nav({ challengeId, onMobileMenuClick }: NavProps) {
    const [showLeaderboard, setShowLeaderboard] = useState(false)
    const [entries, setEntries] = useState<LeaderboardEntry[]>([])
    const [isLoading, setIsLoading] = useState(false)

    useEffect(() => {
        if (!showLeaderboard || !challengeId) return

        setIsLoading(true)
        fetchLeaderboard(challengeId)
            .then(setEntries)
            .catch(() => setEntries([]))
            .finally(() => setIsLoading(false))
    }, [showLeaderboard, challengeId])

    return (
        <>
        <nav className="nav">
            <div className="nav-left">
                <a href="https://fabraix.com" className="logo">FABRAIX</a>
            </div>
            <div className="nav-right">
                <button
                    className="nav-link"
                    onClick={() => setShowLeaderboard(true)}
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
        {showLeaderboard && (
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
                onClick={() => setShowLeaderboard(false)}
            >
                <div
                    style={{
                        background: 'var(--bg-surface, #111113)',
                        border: '1px solid var(--border, rgba(255,255,255,0.06))',
                        borderRadius: '0.75rem',
                        padding: '2rem 2.5rem',
                        maxWidth: '480px',
                        width: '90%',
                        maxHeight: '80vh',
                        overflowY: 'auto',
                    }}
                    onClick={(e) => e.stopPropagation()}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
                        <Trophy size={24} style={{ color: 'var(--accent, #D08B5B)' }} />
                        <h3 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--text-primary, #fafafa)' }}>
                            Leaderboard
                        </h3>
                    </div>

                    {isLoading ? (
                        <div style={{ textAlign: 'center', padding: '2rem 0' }}>
                            <Loader2 size={24} style={{ animation: 'spin 1s linear infinite', color: 'var(--text-tertiary, #888)' }} />
                        </div>
                    ) : entries.length === 0 ? (
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-tertiary, #888)', textAlign: 'center', padding: '1rem 0' }}>
                            No entries yet. Be the first to complete this challenge!
                        </p>
                    ) : (
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid var(--border-default, rgba(255,255,255,0.08))' }}>
                                    <th style={{ textAlign: 'left', padding: '0.5rem 0.75rem', color: 'var(--text-muted, rgba(255,255,255,0.25))', fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 600 }}>#</th>
                                    <th style={{ textAlign: 'left', padding: '0.5rem 0.75rem', color: 'var(--text-muted, rgba(255,255,255,0.25))', fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 600 }}>Name</th>
                                    <th style={{ textAlign: 'right', padding: '0.5rem 0.75rem', color: 'var(--text-muted, rgba(255,255,255,0.25))', fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 600 }}>Time</th>
                                </tr>
                            </thead>
                            <tbody>
                                {entries.map((entry, i) => (
                                    <tr
                                        key={`${entry.username}-${i}`}
                                        style={{ borderBottom: '1px solid var(--border, rgba(255,255,255,0.06))' }}
                                    >
                                        <td style={{ padding: '0.6rem 0.75rem', color: i < 3 ? 'var(--accent, #D08B5B)' : 'var(--text-tertiary, #888)', fontWeight: i < 3 ? 600 : 400 }}>
                                            {i + 1}
                                        </td>
                                        <td style={{ padding: '0.6rem 0.75rem', color: 'var(--text-primary, #fafafa)' }}>
                                            {entry.username}
                                        </td>
                                        <td style={{ padding: '0.6rem 0.75rem', color: 'var(--text-secondary, rgba(255,255,255,0.65))', textAlign: 'right', fontFamily: 'var(--font-mono)' }}>
                                            {entry.time}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}

                    <div style={{ textAlign: 'right', marginTop: '1.5rem' }}>
                        <button
                            onClick={() => setShowLeaderboard(false)}
                            className="nav-cta"
                            style={{ cursor: 'pointer' }}
                        >
                            Close
                        </button>
                    </div>
                </div>
            </div>
        )}
        </>
    )
}
