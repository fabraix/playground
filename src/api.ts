// API service for the playground application
import { config } from './config'
import { getOrCreateUserId } from './utils/id.utils'
import { getToken, clearToken } from './utils/auth'
import type {
    ChallengeListItem,
    Challenge,
    SessionStartResponse,
    SessionRestartResponse,
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
 * Auth header for the current player (empty when anonymous). A logged-in token
 * makes the session prize-eligible; anonymous play sends nothing.
 */
function authHeaders(): Record<string, string> {
    const token = getToken()
    return token ? { 'X-Verification-Token': token } : {}
}

/** Broadcast name the AuthProvider listens on to drop the player to logged-out. */
export const SESSION_EXPIRED_EVENT = 'pg:session-expired'

/**
 * Announce that a live session lapsed, so the AuthProvider can drop the player to
 * logged-out and surface a clear "log in again" prompt. Safe to call redundantly.
 */
export function notifySessionExpired(): void {
    try {
        window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT))
    } catch {
        /* non-browser env (tests/SSR) — nothing to notify */
    }
}

/**
 * A 401 on a call we made WITH a token means the stored token is invalid/expired.
 * Forget it and announce the lapse — instead of the request silently degrading to
 * anonymous, which (on an owner-gated action like restart) comes back as a
 * misleading "this session isn't yours". A 401 WITHOUT a stored token is left for
 * the caller to interpret: an anonymous browser hitting a login-gated route needs
 * no prompt, whereas a lapsed player retrying their own session (no token left)
 * does — the restart flow calls notifySessionExpired() explicitly for that case.
 */
function handleUnauthorized(status: number): void {
    if (status !== 401 || !getToken()) return
    clearToken()
    notifySessionExpired()
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
                ...authHeaders(),
                ...options.headers,
            },
            ...options,
        })

        if (!response.ok) {
            handleUnauthorized(response.status)
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
 * Start a new playground session. `variantId` (optional) selects which
 * randomly-named model the player faces; the real model stays server-side.
 */
export async function startSession(
    challengeId: string,
    userIdentifier?: string,
    variantId?: string
): Promise<SessionStartResponse> {
    const query = variantId ? `?variant_id=${encodeURIComponent(variantId)}` : ''
    return apiRequest<SessionStartResponse>(`/playground/sessions/start${query}`, {
        method: 'POST',
        body: JSON.stringify({
            // The backend requires a user_identifier; fall back to a stable
            // anonymous per-browser id when the caller doesn't supply one.
            challenge_id: challengeId,
            user_identifier: userIdentifier ?? getOrCreateUserId(),
        }),
    })
}

/**
 * Restart a session (creates new trace). Passing `variantId` switches the faced
 * model; omitting it keeps the session's current model.
 */
export async function restartSession(
    sessionId: string,
    variantId?: string
): Promise<SessionRestartResponse> {
    const query = variantId ? `?variant_id=${encodeURIComponent(variantId)}` : ''
    return apiRequest<SessionRestartResponse>(
        `/playground/sessions/${sessionId}/restart${query}`,
        { method: 'POST' }
    )
}

// ============================================================================
// Model catalog (opaque display names → hidden server-side models)
// ============================================================================

export interface ModelOption {
    /** Opaque variant id to pass as `variantId` on startSession. */
    id: string
    /** Randomly-assigned public name; never reveals the real model. */
    displayName: string
}

/** The models a player can face, under opaque names only. */
export async function fetchModels(): Promise<ModelOption[]> {
    return apiRequest<ModelOption[]>('/playground/models')
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
            ...authHeaders(),
        },
        body: JSON.stringify({
            session_id: sessionId,
            message,
        }),
        signal,
    })

    if (!response.ok) {
        handleUnauthorized(response.status)
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

// ============================================================================
// Auth + account (Google login, display name, progress)
// ============================================================================

export interface PlaygroundUser {
    userId: string
    email: string
    name: string
    pictureUrl: string
    /** Null until the player sets a leaderboard display name at first login. */
    displayName: string | null
}

/** Begin Google login; returns the URL to redirect the browser to. */
export async function startPlaygroundLogin(): Promise<{ authUrl: string }> {
    return apiRequest<{ authUrl: string }>('/playground/auth/google/login', {
        method: 'POST',
    })
}

/** The authenticated player's identity + display name. 401 when not logged in. */
export async function fetchMe(): Promise<PlaygroundUser> {
    return apiRequest<PlaygroundUser>('/playground/auth/me')
}

/** Set/update the leaderboard display name (required, non-unique). */
export async function updateDisplayName(displayName: string): Promise<{ displayName: string }> {
    return apiRequest<{ displayName: string }>('/playground/profile', {
        method: 'PUT',
        body: JSON.stringify({ display_name: displayName }),
    })
}

/** Moderation state of a submitted break. */
export type ReviewStatus = 'pending' | 'approved' | 'rejected'

export interface LeaderboardSubmitResult {
    displayName: string
    timeSeconds?: number
    /** Submissions land 'pending' and only count once staff approve them. */
    reviewStatus?: ReviewStatus
    alreadyRecorded?: boolean
}

/** Submit the caller's solved session for the leaderboard (pending staff review). */
export async function submitLeaderboard(sessionId: string): Promise<LeaderboardSubmitResult> {
    return apiRequest<LeaderboardSubmitResult>('/playground/leaderboard', {
        method: 'POST',
        body: JSON.stringify({ session_id: sessionId }),
    })
}

export interface WeeklyLeaderboardEntry {
    rank: number
    displayName: string
    /** Number of approved breaks this week - the ranking key. */
    breakCount: number
    lastBreakAt: string
}

export interface WeeklyLeaderboard {
    weekStart: string
    weekEnd: string
    prize: string
    entries: WeeklyLeaderboardEntry[]
}

/** This week's prize board: MOST approved breaks wins (ties → who got there first). */
export async function fetchWeeklyLeaderboard(challengeSlug: string): Promise<WeeklyLeaderboard> {
    return apiRequest<WeeklyLeaderboard>(
        `/playground/leaderboard/weekly?challenge_slug=${challengeSlug}`
    )
}

export interface ModelBoardEntry {
    /** Opaque public name - the real model is never exposed. */
    displayName: string
    /** Sessions where the player actually engaged (≥1 turn). */
    attempts: number
    /** Solved sessions. */
    breaks: number
    /** breaks / attempts, 0..1. */
    successRate: number
}

/** All-time attack success rate per model, most-broken first. */
export async function fetchModelLeaderboard(
    challengeSlug: string
): Promise<{ models: ModelBoardEntry[] }> {
    return apiRequest<{ models: ModelBoardEntry[] }>(
        `/playground/leaderboard/models?challenge_slug=${challengeSlug}`
    )
}

export interface MySolve {
    sessionId: string
    challengeSlug: string
    solved: boolean
    solvedAt: string | null
    timeSeconds: number | null
    messageCount: number | null
    createdAt: string
}

/** The authenticated player's own attempts/solves (newest first) - "Previous Chats". */
export async function fetchMySolves(): Promise<MySolve[]> {
    return apiRequest<MySolve[]>('/playground/me/solves')
}

export interface Submission {
    id: string
    /** The solved session this break was submitted from. */
    sessionId: string
    challengeSlug: string
    timeSeconds: number
    reviewStatus: ReviewStatus
    rejectionReason: string | null
    /** The randomly-named model this break was scored against, if a variant was chosen. */
    modelName: string | null
    solvedAt: string | null
    createdAt: string
}

/** The caller's own leaderboard submissions + their moderation state - "Submissions". */
export async function fetchMySubmissions(): Promise<Submission[]> {
    return apiRequest<Submission[]>('/playground/me/submissions')
}

/** Light per-player summary for the sidebar: approved breaks in the challenge's prize window. */
export async function fetchMySummary(challengeSlug: string): Promise<{ weeklyBreaks: number }> {
    return apiRequest<{ weeklyBreaks: number }>(
        `/playground/me/summary?challenge_slug=${encodeURIComponent(challengeSlug)}`,
    )
}

export interface TranscriptMessage {
    role: string
    content: string
    tools: unknown[] | null
    createdAt: string
}

export interface SessionTranscript {
    sessionId: string
    challengeSlug: string
    solved: boolean
    messages: TranscriptMessage[]
}

/** Replay one of the caller's own past sessions (owner-scoped). */
export async function fetchSessionMessages(sessionId: string): Promise<SessionTranscript> {
    return apiRequest<SessionTranscript>(`/playground/me/sessions/${sessionId}/messages`)
}
