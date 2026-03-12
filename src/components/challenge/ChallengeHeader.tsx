import type { Challenge } from '@/types'

interface ChallengeHeaderProps {
    challenge: Challenge
    attempts: number
    elapsedTime: string
}

/**
 * Compact header showing current challenge info
 */
export function ChallengeHeader({ challenge, attempts, elapsedTime }: ChallengeHeaderProps) {
    // Extract number from slug (e.g. "data-exfil-001" → "001")
    const challengeNumber = challenge.id.match(/(\d+)$/)?.[1] || '001'

    return (
        <header className="challenge-header">
            <div className="challenge-info">
                <div className="challenge-label">
                    <span className="challenge-badge">CHALLENGE #{challengeNumber}</span>
                    <span>•</span>
                    <span>DIFFICULTY {challenge.difficulty}/5</span>
                </div>
                <h1 className="challenge-title">{challenge.name}</h1>
                <p className="challenge-objective">{challenge.objective}</p>
            </div>

            <div className="challenge-meta">
                <div className="challenge-stat">
                    <div className="challenge-stat-value">{attempts}</div>
                    <div className="challenge-stat-label">Messages</div>
                </div>
                <div className="challenge-stat">
                    <div className="challenge-stat-value">{elapsedTime}</div>
                    <div className="challenge-stat-label">Elapsed</div>
                </div>
            </div>
        </header>
    )
}
