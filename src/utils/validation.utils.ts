/**
 * Validation utilities for runtime type checking
 */

import type { SessionData } from '@/types'

/**
 * Valid analysis status values
 */
const VALID_ANALYSIS_STATUSES = ['pending', 'safe', 'blocked'] as const

/**
 * Type guard to validate SessionData structure.
 * Returns true if the data has the expected shape for session restoration.
 */
export function isValidSessionData(data: unknown): data is SessionData {
    if (!data || typeof data !== 'object') {
        return false
    }

    const d = data as Record<string, unknown>

    // Required string fields
    if (typeof d.sessionId !== 'string' || d.sessionId.length === 0) {
        return false
    }
    if (typeof d.startTime !== 'string') {
        return false
    }
    if (typeof d.reason !== 'string') {
        return false
    }

    // Required number fields
    if (typeof d.attempts !== 'number' || d.attempts < 0) {
        return false
    }
    if (typeof d.elapsedTime !== 'number' || d.elapsedTime < 0) {
        return false
    }

    // Required array fields
    if (!Array.isArray(d.messages)) {
        return false
    }
    if (!Array.isArray(d.activeGuardrails)) {
        return false
    }

    // Validate status enum
    if (!VALID_ANALYSIS_STATUSES.includes(d.status as typeof VALID_ANALYSIS_STATUSES[number])) {
        return false
    }

    return true
}

/**
 * Safely parse and validate session data.
 * Returns null if validation fails instead of throwing.
 */
export function validateSessionData(data: unknown): SessionData | null {
    if (!isValidSessionData(data)) {
        console.warn('Invalid session data structure, starting fresh session')
        return null
    }
    return data
}
