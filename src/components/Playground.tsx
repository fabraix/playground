import { useState, useEffect } from 'react'
import { Nav } from '@/components/layout'
import { ChallengeSelector, ChallengeHeader, ChatPanel, AnalysisPanel } from '@/components/challenge'
import { useChallengeGame } from '@/hooks'
import { fetchStats, fetchChallenges, fetchChallenge, fetchGuardrails } from '@/api'
import { DEFAULT_CHALLENGE_ID } from '@/constants'
import type { GlobalStats, ChallengeListItem, Challenge, Guardrail } from '@/types'

/**
 * Main Playground page - single page layout with chat + analysis panels
 */
export function Playground() {
  // Mobile drawer state
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false)

  // API data state
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [globalStats, setGlobalStats] = useState<GlobalStats | null>(null)
  const [challengesList, setChallengesList] = useState<ChallengeListItem[]>([])
  const [challenge, setChallenge] = useState<Challenge | null>(null)
  const [guardrails, setGuardrails] = useState<Guardrail[]>([])

  // Fetch initial data on mount
  useEffect(() => {
    async function loadData() {
      setIsLoading(true)
      setError(null)

      try {
        // Fetch all data in parallel
        const [statsData, challengesData, guardrailsData] = await Promise.all([
          fetchStats(),
          fetchChallenges(),
          fetchGuardrails(),
        ])

        setGlobalStats(statsData)
        setChallengesList(challengesData)
        setGuardrails(guardrailsData)

        // Find first unlocked challenge or use default
        const firstUnlocked = challengesData.find(c => !c.locked)
        const challengeId = firstUnlocked?.id || DEFAULT_CHALLENGE_ID

        // Fetch challenge details
        const challengeData = await fetchChallenge(challengeId)
        setChallenge(challengeData)
      } catch (err) {
        console.error('Failed to load playground data:', err)
        setError('Failed to load playground. Please refresh the page.')
      } finally {
        setIsLoading(false)
      }
    }

    loadData()
  }, [])

  // Game hook - only initialize when we have challenge data
  const game = useChallengeGame({
    challengeId: challenge?.id || DEFAULT_CHALLENGE_ID,
    guardrails,
  })

  // Loading state
  if (isLoading) {
    return (
      <div className="app">
        <Nav onMobileMenuClick={() => setIsMobileDrawerOpen(true)} />
        <main className="main-layout">
          <div className="loading-container">
            <div className="loading-spinner" />
            <p>Initializing playground...</p>
          </div>
        </main>
      </div>
    )
  }

  // Error state
  if (error || !challenge) {
    return (
      <div className="app">
        <Nav onMobileMenuClick={() => setIsMobileDrawerOpen(true)} />
        <main className="main-layout">
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
      <Nav onMobileMenuClick={() => setIsMobileDrawerOpen(true)} />

      <main className="main-layout">
        {/* Left column: challenge info + chat */}
        <div className="left-column">
          <ChallengeSelector
            currentChallenge={challenge}
            challenges={challengesList}
            globalStats={globalStats || { totalAttempts: '0', successRate: '0%', bestTime: 'N/A' }}
            onSelectChallenge={() => {
              // Challenge switching not supported yet
            }}
          />

          <ChallengeHeader
            challenge={challenge}
            attempts={game.attempts}
            elapsedTime={game.formatTime(game.elapsedTime)}
          />

          <ChatPanel
            agentName={challenge.agentPersona}
            messages={game.messages}
            inputValue={game.inputValue}
            onInputChange={game.setInputValue}
            onKeyDown={game.handleKeyDown}
            onSubmit={game.sendMessage}
            isLoading={game.isLoading || game.isInitializing}
            inputRef={game.inputRef}
            currentStatus={game.currentStatus}
            steps={game.steps}
          />
        </div>

        {/* Right column: Analysis panel */}
        <AnalysisPanel
          hasMessages={game.attempts > 0}
          status={game.status}
          reason={game.reason}
          messageCount={game.attempts}
          elapsedTime={game.formatTime(game.elapsedTime)}
          guardrails={game.activeGuardrails}
          onRestart={game.resetGame}
          isRestarting={game.isRestarting}
          isMobileOpen={isMobileDrawerOpen}
          onMobileClose={() => setIsMobileDrawerOpen(false)}
        />
      </main>
    </div>
  )
}
