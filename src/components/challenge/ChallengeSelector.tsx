import { useState } from 'react'
import { ChevronDown, ChevronRight, Lock } from 'lucide-react'
import type { Challenge, ChallengeListItem, GlobalStats } from '@/types'

interface ChallengeSelectorProps {
    currentChallenge: Challenge
    challenges: ChallengeListItem[]
    globalStats: GlobalStats
    onSelectChallenge?: (id: string) => void
}

/**
 * Collapsible challenge selector with global stats
 */
export function ChallengeSelector({
    currentChallenge,
    challenges,
    globalStats,
    onSelectChallenge,
}: ChallengeSelectorProps) {
    const [isExpanded, setIsExpanded] = useState(false)

    return (
        <div className="challenge-selector">
            {/* Toggle header */}
            <button
                className="challenge-selector-toggle"
                onClick={() => setIsExpanded(!isExpanded)}
                aria-expanded={isExpanded}
            >
                <div className="challenge-selector-left">
                    {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    <span className="challenge-selector-label">Challenges</span>
                    <span className="challenge-selector-current">{currentChallenge.name}</span>
                </div>

                {/* Global stats (always visible) */}
                <div className="challenge-selector-stats">
                    <div className="challenge-selector-stat">
                        <span className="challenge-selector-stat-value">{globalStats.totalAttempts}</span>
                        <span className="challenge-selector-stat-label">Attempts</span>
                    </div>
                    <div className="challenge-selector-stat">
                        <span className="challenge-selector-stat-value">{globalStats.successRate}</span>
                        <span className="challenge-selector-stat-label">Success Rate</span>
                    </div>
                    <div className="challenge-selector-stat">
                        <span className="challenge-selector-stat-value">{globalStats.bestTime}</span>
                        <span className="challenge-selector-stat-label">Best Time</span>
                    </div>
                </div>
            </button>

            {/* Expandable challenge list */}
            {isExpanded && (
                <div className="challenge-list">
                    {challenges.map((challenge) => (
                        <button
                            key={challenge.id}
                            className={`challenge-list-item ${challenge.id === currentChallenge.id ? 'active' : ''} ${challenge.locked ? 'locked' : ''}`}
                            onClick={() => !challenge.locked && onSelectChallenge?.(challenge.id)}
                            disabled={challenge.locked}
                        >
                            <div className="challenge-list-item-info">
                                <span className="challenge-list-item-name">{challenge.name}</span>
                                <span className="challenge-list-item-difficulty">
                                    {'◆'.repeat(challenge.difficulty)}{'◇'.repeat(5 - challenge.difficulty)}
                                </span>
                            </div>
                            <div className="challenge-list-item-right">
                                {challenge.stats && (
                                    <div className="challenge-list-item-stats">
                                        <span className="challenge-list-item-stat">{challenge.stats.totalAttempts} attempts</span>
                                        <span className="challenge-list-item-stat">{challenge.stats.successRate} success</span>
                                        <span className="challenge-list-item-stat">{challenge.stats.bestTime} best</span>
                                    </div>
                                )}
                                {challenge.locked && (
                                    <div className="challenge-list-item-lock">
                                        {challenge.comingSoon ? (
                                            <span className="challenge-list-item-soon">Soon</span>
                                        ) : (
                                            <Lock size={12} />
                                        )}
                                    </div>
                                )}
                            </div>
                        </button>
                    ))}
                </div>
            )}
        </div>
    )
}
