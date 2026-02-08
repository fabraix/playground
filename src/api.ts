// API service for the playground application
import { config } from './config'
import type {
    GlobalStats,
    ChallengeListItem,
    Challenge,
    SessionStartResponse,
    SessionRestartResponse,
    Guardrail,
    SSEEvent,
} from './types'

/**
 * API error with status code
 */
export class ApiError extends Error {
    constructor(
        message: string,
        public statusCode?: number,
        public originalError?: unknown
    ) {
        super(message)
        this.name = 'ApiError'
    }
}

/**
 * Make an API request with error handling
 */
async function apiRequest<T>(
    endpoint: string,
    options: RequestInit = {}
): Promise<T> {
    try {
        const response = await fetch(`${config.apiUrl}${endpoint}`, {
            headers: {
                'Content-Type': 'application/json',
                ...options.headers,
            },
            ...options,
        })

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}))
            throw new ApiError(
                errorData.detail || `API request failed with status ${response.status}`,
                response.status
            )
        }

        return await response.json()
    } catch (error) {
        if (error instanceof ApiError) {
            throw error
        }
        throw new ApiError(
            'Failed to connect to API',
            undefined,
            error
        )
    }
}

/**
 * Fetch global playground statistics
 */
export async function fetchStats(): Promise<GlobalStats> {
    return apiRequest<GlobalStats>('/playground/stats')
}

/**
 * Fetch list of available challenges
 */
export async function fetchChallenges(): Promise<ChallengeListItem[]> {
    return apiRequest<ChallengeListItem[]>('/playground/challenges')
}

/**
 * Fetch detailed challenge configuration
 */
export async function fetchChallenge(challengeId: string): Promise<Challenge> {
    return apiRequest<Challenge>(`/playground/challenges/${challengeId}`)
}

/**
 * Fetch list of active guardrails
 */
export async function fetchGuardrails(): Promise<Guardrail[]> {
    return apiRequest<Guardrail[]>('/playground/guardrails')
}

/**
 * Start a new playground session
 */
export async function startSession(
    challengeId: string,
    userIdentifier?: string
): Promise<SessionStartResponse> {
    return apiRequest<SessionStartResponse>('/playground/sessions/start', {
        method: 'POST',
        body: JSON.stringify({
            challenge_id: challengeId,
            user_identifier: userIdentifier,
        }),
    })
}

/**
 * Restart a session (creates new trace)
 */
export async function restartSession(
    sessionId: string
): Promise<SessionRestartResponse> {
    return apiRequest<SessionRestartResponse>(`/playground/sessions/${sessionId}/restart`, {
        method: 'POST',
    })
}

/**
 * Extract complete JSON objects from a string buffer.
 * Handles concatenated JSON objects (possibly pretty-printed).
 * Returns [extracted objects, remaining buffer].
 */
function extractJSONObjects(buffer: string): [string[], string] {
    const objects: string[] = []
    let depth = 0
    let inString = false
    let escape = false
    let objectStart = -1

    for (let i = 0; i < buffer.length; i++) {
        const char = buffer[i]

        if (escape) {
            escape = false
            continue
        }

        if (char === '\\' && inString) {
            escape = true
            continue
        }

        if (char === '"') {
            inString = !inString
            continue
        }

        if (inString) continue

        if (char === '{') {
            if (depth === 0) objectStart = i
            depth++
        } else if (char === '}') {
            depth--
            if (depth === 0 && objectStart !== -1) {
                objects.push(buffer.slice(objectStart, i + 1))
                objectStart = -1
            }
        }
    }

    // Return remaining incomplete content (from last object start, or empty if all complete)
    const remaining = objectStart !== -1 ? buffer.slice(objectStart) : ''
    return [objects, remaining]
}

/**
 * Options for streaming chat messages
 */
export interface StreamOptions {
    signal?: AbortSignal
}

/**
 * Send a chat message with streaming response.
 * Handles concatenated JSON objects (including pretty-printed format).
 */
export async function* sendChatMessageStream(
    sessionId: string,
    message: string,
    options: StreamOptions = {}
): AsyncGenerator<SSEEvent, void, unknown> {
    const { signal } = options

    const response = await fetch(`${config.apiUrl}/playground/chat/stream`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            session_id: sessionId,
            message,
        }),
        signal,
    })

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new ApiError(
            errorData.detail || `API request failed with status ${response.status}`,
            response.status
        )
    }

    if (!response.body) {
        throw new ApiError('No response body')
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    try {
        while (true) {
            const { done, value } = await reader.read()
            if (done) break

            buffer += decoder.decode(value, { stream: true })

            // Extract complete JSON objects from buffer
            const [objects, remaining] = extractJSONObjects(buffer)
            buffer = remaining

            for (const jsonStr of objects) {
                try {
                    yield JSON.parse(jsonStr) as SSEEvent
                } catch {
                    // Skip malformed JSON
                }
            }
        }

        // Process any remaining complete objects after stream ends
        if (buffer.trim()) {
            const [objects] = extractJSONObjects(buffer)
            for (const jsonStr of objects) {
                try {
                    yield JSON.parse(jsonStr) as SSEEvent
                } catch {
                    console.error('Failed to parse final JSON object:', jsonStr)
                }
            }
        }
    } finally {
        reader.releaseLock()
    }
}
