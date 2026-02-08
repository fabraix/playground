/**
 * Challenge-related types
 */

/**
 * Difficulty levels (1-5 stars)
 */
export type Difficulty = 1 | 2 | 3 | 4 | 5

/**
 * Challenge configuration from API
 */
export interface Challenge {
    id: string
    name: string
    difficulty: Difficulty
    description: string
    objective: string
    agentPersona: string
    agentSubtitle: string
    systemPrompt: string
    greeting: string
    deadline?: string
    stats?: ChallengeStats
}

/**
 * Challenge statistics
 */
export interface ChallengeStats {
    totalAttempts: number
    successRate: string
}

/**
 * Challenge list item for selector
 */
export interface ChallengeListItem {
    id: string
    name: string
    difficulty: Difficulty
    locked: boolean
    comingSoon?: boolean
}

/**
 * Global stats display
 */
export interface GlobalStats {
    totalAttempts: string
    successRate: string
    bestTime: string
}
