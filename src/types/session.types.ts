/**
 * Session and persistence types
 */

import type { SerializedMessage } from './message.types'
import type { AnalysisStatus, GuardrailState } from './analysis.types'

/**
 * Session start response from API
 */
export interface SessionStartResponse {
    sessionId: string
    traceId: string
    challenge: {
        id: string
        name: string
        agentPersona: string
        agentSubtitle: string
    }
    greeting: string
}

/**
 * Session restart response from API
 */
export interface SessionRestartResponse {
    sessionId: string
    traceId: string
    greeting: string
}

/**
 * Session data for persistence
 */
export interface SessionData {
    sessionId: string
    messages: SerializedMessage[]
    attempts: number
    startTime: string
    elapsedTime: number
    activeGuardrails: GuardrailState[]
    status: AnalysisStatus
    reason: string
    hasWon?: boolean
}
