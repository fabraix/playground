/**
 * Main hook for managing challenge game state.
 * Composes focused hooks for better separation of concerns.
 */

import { useState, useRef, useEffect, useCallback } from 'react'
import type {
    Message,
    AnalysisStatus,
    SSEEvent,
    SearchResultData,
    ProcessingStep,
} from '@/types'
import { sendChatMessageStream, startSession, restartSession, ApiError } from '@/api'
import { MAX_MESSAGE_LENGTH } from '@/constants'
import { useTimer } from './useTimer'
import { useSessionStorage } from './useSessionStorage'
import { useProcessingSteps } from './useProcessingSteps'
import { useAnalysis } from './useAnalysis'
import {
    createMessage,
    serializeMessages,
    deserializeMessages,
} from '@/utils'
import { DISPLAYABLE_STEP_TYPES } from '@/constants'

// ============================================================================
// Types
// ============================================================================

interface UseChallengeGameOptions {
    challengeId: string
    /**
     * Opaque variant id selecting which randomly-named model the player faces.
     * `undefined` uses the server default. Changing it restarts on the new model.
     */
    variantId?: string
}

interface UseChallengeGameReturn {
    // Message state
    messages: Message[]
    inputValue: string

    // UI state
    isLoading: boolean
    isInitializing: boolean
    isRestarting: boolean
    attempts: number
    elapsedTime: number
    hasWon: boolean
    sessionId: string | null

    // Analysis state
    status: AnalysisStatus
    reason: string

    // Processing state
    currentStatus: string | null
    steps: ProcessingStep[]
    searchResults: SearchResultData[]
    isProcessing: boolean

    // Refs
    inputRef: React.RefObject<HTMLTextAreaElement | null>

    // Actions
    sendMessage: () => void
    resetGame: () => void
    switchChallenge: (newChallengeId: string) => void
    /** Restart the current session against a different (opaque) model variant. */
    changeVariant: (variantId: string | undefined) => void
    setInputValue: (value: string) => void
    handleKeyDown: (e: React.KeyboardEvent) => void
    formatTime: (seconds: number) => string
}

// ============================================================================
// Hook
// ============================================================================

export function useChallengeGame({
    challengeId,
    variantId,
}: UseChallengeGameOptions): UseChallengeGameReturn {
    // ========================================================================
    // State
    // ========================================================================

    const [sessionId, setSessionId] = useState<string | null>(null)
    const [messages, setMessages] = useState<Message[]>([])
    const [inputValue, setInputValue] = useState('')
    const [isLoading, setIsLoading] = useState(false)
    const [isInitializing, setIsInitializing] = useState(true)
    const [attempts, setAttempts] = useState(0)
    const [isRestarting, setIsRestarting] = useState(false)
    const [hasWon, setHasWon] = useState(false)

    // ========================================================================
    // Composed Hooks
    // ========================================================================

    const timer = useTimer()
    const storage = useSessionStorage()
    const processing = useProcessingSteps()
    const analysis = useAnalysis()

    // ========================================================================
    // Refs
    // ========================================================================

    const inputRef = useRef<HTMLTextAreaElement>(null)
    const initializedRef = useRef(false)
    const abortControllerRef = useRef<AbortController | null>(null)
    // Latest selected model variant, read by restart/switch without re-triggering
    // the init effect (which restores from storage) on every picker change.
    const variantRef = useRef<string | undefined>(variantId)
    variantRef.current = variantId

    // ========================================================================
    // Initialization
    // ========================================================================

    useEffect(() => {
        if (initializedRef.current) return
        initializedRef.current = true

        initializeSession()

        async function initializeSession() {
            setIsInitializing(true)

            // Try to restore from storage - but only a session that ran against
            // the currently-selected model; a stale run on another model would
            // silently misattribute the conversation.
            const saved = storage.loadSession()
            if (saved?.sessionId && saved.variantId === variantRef.current) {
                restoreFromStorage(saved)
                return
            }
            if (saved?.sessionId) {
                storage.clearSession()
            }

            // Start new session
            await startNewSession()
        }

        function restoreFromStorage(
            saved: NonNullable<ReturnType<typeof storage.loadSession>>
        ) {
            setSessionId(saved.sessionId)
            setMessages(deserializeMessages(saved.messages))
            setAttempts(saved.attempts)
            if (saved.hasWon) setHasWon(true)
            analysis.setStatus(saved.status)
            analysis.setReason(saved.reason)
            // An already-solved session is frozen at its recorded solve time;
            // an in-progress one resumes counting from its original start.
            if (saved.hasWon) {
                timer.restore(saved.elapsedTime, new Date(saved.startTime), false)
            } else {
                timer.start(new Date(saved.startTime))
            }
            setIsInitializing(false)
        }

        async function startNewSession() {
            try {
                const response = await startSession(challengeId, undefined, variantRef.current)
                setSessionId(response.sessionId)

                const greeting = createMessage('assistant', response.greeting)
                setMessages([greeting])

                const startTime = new Date()
                timer.start(startTime)

                // Persist immediately
                storage.saveSession({
                    sessionId: response.sessionId,
                    messages: serializeMessages([greeting]),
                    attempts: 0,
                    startTime: startTime.toISOString(),
                    elapsedTime: 0,
                    status: 'pending',
                    reason: '',
                    variantId: variantRef.current,
                })
            } catch (error) {
                console.error('Failed to start session:', error)
                const errorMessage = createMessage(
                    'assistant',
                    'Failed to connect to the server. Please refresh the page to try again.'
                )
                setMessages([errorMessage])
            } finally {
                setIsInitializing(false)
            }
        }
    }, [challengeId, storage, timer, analysis])

    // Cleanup: cancel pending requests on unmount
    useEffect(() => {
        return () => {
            abortControllerRef.current?.abort()
        }
    }, [])

    // ========================================================================
    // Stream Complete Handler
    // ========================================================================

    const handleStreamComplete = useCallback(
        (
            result: SSEEvent['data'],
            newMessages: Message[],
            newAttempts: number
        ) => {
            // Only attach displayable steps (tool, search) to the message
            // Use getSteps() for synchronous access (bypasses React's async state batching)
            const toolSteps = processing.getSteps().filter(s => DISPLAYABLE_STEP_TYPES.includes(s.type))
            const assistantMessage = createMessage(
                'assistant',
                result.content!,
                toolSteps.length > 0 ? toolSteps : undefined
            )
            const messagesWithResponse = [...newMessages, assistantMessage]
            const newStatus: AnalysisStatus = result.safe ? 'safe' : 'blocked'

            setMessages(messagesWithResponse)

            // Track win state - freeze the timer so the recorded solve time
            // (shown in the win banner) stops counting up after the solve.
            if (result.success) {
                setHasWon(true)
                timer.stop()
            }

            // Update analysis state
            analysis.updateAnalysis(newStatus, result.reason ?? '')

            // Persist session
            const wonNow = !!result.success
            storage.saveSession({
                sessionId: sessionId!,
                messages: serializeMessages(messagesWithResponse),
                attempts: newAttempts,
                startTime: timer.startTime?.toISOString() ?? new Date().toISOString(),
                elapsedTime: timer.elapsedTime,
                status: newStatus,
                reason: result.reason ?? '',
                hasWon: wonNow,  // wonNow is the ground truth; hasWon would be stale (pre-render)
                variantId: variantRef.current,
            })

            // Clear live processing steps now that they're attached to the message
            processing.clearStatus()
        },
        [sessionId, timer, storage, analysis, processing]
    )

    // ========================================================================
    // Message Handling
    // ========================================================================

    const sendMessage = useCallback(async () => {
        if (!inputValue.trim() || isLoading || !sessionId) return

        // Guard the over-limit case here too: the Send button is disabled when
        // over the cap, but Enter-to-send bypasses it. Sending anyway would hit
        // the server's 422 and render as a silent "no response".
        if (inputValue.length > MAX_MESSAGE_LENGTH) {
            analysis.setStatus('safe')
            analysis.setReason(
                `Message is too long. Max ${MAX_MESSAGE_LENGTH.toLocaleString()} characters.`
            )
            return
        }

        // Cancel any existing request
        abortControllerRef.current?.abort()
        abortControllerRef.current = new AbortController()

        const userMessage = createMessage('user', inputValue.trim())
        const newMessages = [...messages, userMessage]
        const newAttempts = attempts + 1

        // Update UI state
        setMessages(newMessages)
        setInputValue('')
        setAttempts(newAttempts)
        setIsLoading(true)
        analysis.setStatus('pending')
        processing.clearStatus()

        try {
            let finalResult: SSEEvent['data'] | null = null

            // Process SSE stream
            for await (const event of sendChatMessageStream(
                sessionId,
                userMessage.content,
                { signal: abortControllerRef.current.signal }
            )) {
                processing.handleEvent(event)
                if (event.event === 'complete') {
                    finalResult = event.data
                }
            }

            if (finalResult?.content) {
                handleStreamComplete(finalResult, newMessages, newAttempts)
            }
        } catch (error) {
            // Ignore abort errors - request was cancelled intentionally
            if (error instanceof Error && error.name === 'AbortError') {
                return
            }
            console.error('Chat error:', error)

            // Session ended (e.g. after leaderboard submission) - stop allowing further messages
            if (error instanceof ApiError && error.statusCode === 400) {
                setHasWon(true)
                analysis.setStatus('safe')
                analysis.setReason('Session complete. Restart to play again.')
                return
            }

            // Message rejected by server validation (e.g. over the length cap):
            // give a specific reason instead of the generic one so it doesn't
            // read as a silent hang.
            if (error instanceof ApiError && error.statusCode === 422) {
                analysis.setStatus('safe')
                analysis.setReason(
                    `Message is too long. Max ${MAX_MESSAGE_LENGTH.toLocaleString()} characters.`
                )
                return
            }

            analysis.setStatus('safe')
            analysis.setReason('Error processing request. Please try again.')
        } finally {
            setIsLoading(false)
            requestAnimationFrame(() => {
                inputRef.current?.focus()
            })
        }
    }, [
        inputValue,
        isLoading,
        sessionId,
        messages,
        attempts,
        analysis,
        processing,
        handleStreamComplete,
    ])

    // ========================================================================
    // Game Control
    // ========================================================================

    const resetGame = useCallback(async () => {
        if (!sessionId || isRestarting) return

        setIsRestarting(true)
        try {
            // Keep the currently-selected model on a plain restart (omitting
            // variantId server-side preserves the session's current model).
            const response = await restartSession(sessionId, variantRef.current)

            // Clear storage
            storage.clearSession()

            // Reset state
            setSessionId(response.sessionId)
            const greeting = createMessage('assistant', response.greeting)
            setMessages([greeting])
            setInputValue('')
            setAttempts(0)
            setHasWon(false)

            // Reset composed hooks
            analysis.resetAnalysis()
            processing.clearStatus()
            timer.reset()
            const startTime = new Date()
            timer.start(startTime)

            // Persist the restarted session immediately (mirrors startNewSession /
            // switchChallenge) so a reload before the first message doesn't orphan it.
            storage.saveSession({
                sessionId: response.sessionId,
                messages: serializeMessages([greeting]),
                attempts: 0,
                startTime: startTime.toISOString(),
                elapsedTime: 0,
                status: 'pending',
                reason: '',
                variantId: variantRef.current,
            })

            inputRef.current?.focus()
        } catch (error) {
            console.error('Failed to restart session:', error)
            analysis.setReason('Failed to restart. Please refresh the page.')
        } finally {
            setIsRestarting(false)
        }
    }, [sessionId, isRestarting, storage, timer, analysis, processing])

    const switchChallenge = useCallback(async (newChallengeId: string) => {
        // Cancel any in-flight requests
        abortControllerRef.current?.abort()

        setIsInitializing(true)
        storage.clearSession()

        // Reset state
        setMessages([])
        setInputValue('')
        setAttempts(0)
        setHasWon(false)
        analysis.resetAnalysis()
        processing.clearStatus()
        timer.reset()

        try {
            const response = await startSession(newChallengeId, undefined, variantRef.current)
            setSessionId(response.sessionId)

            const greeting = createMessage('assistant', response.greeting)
            setMessages([greeting])

            const startTime = new Date()
            timer.start(startTime)

            storage.saveSession({
                sessionId: response.sessionId,
                messages: serializeMessages([greeting]),
                attempts: 0,
                startTime: startTime.toISOString(),
                elapsedTime: 0,
                status: 'pending',
                reason: '',
                variantId: variantRef.current,
            })
        } catch (error) {
            console.error('Failed to switch challenge:', error)
            const errorMessage = createMessage(
                'assistant',
                'Failed to connect to the server. Please refresh the page to try again.'
            )
            setMessages([errorMessage])
        } finally {
            setIsInitializing(false)
            requestAnimationFrame(() => {
                inputRef.current?.focus()
            })
        }
    }, [storage, timer, analysis, processing])

    /**
     * Switch the faced model: restart the live session onto the chosen variant so
     * the whole conversation runs against one model. Reuses the restart path
     * (which reads variantRef) after updating the ref to the new selection.
     */
    const changeVariant = useCallback((nextVariantId: string | undefined) => {
        variantRef.current = nextVariantId
        void resetGame()
    }, [resetGame])

    const handleKeyDown = useCallback(
        (e: React.KeyboardEvent) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                sendMessage()
            }
        },
        [sendMessage]
    )

    // ========================================================================
    // Return
    // ========================================================================

    return {
        // Message state
        messages,
        inputValue,

        // UI state
        isLoading,
        isInitializing,
        isRestarting,
        attempts,
        elapsedTime: timer.elapsedTime,
        hasWon,
        sessionId,

        // Analysis state
        status: analysis.status,
        reason: analysis.reason,

        // Processing state
        currentStatus: processing.currentStatus,
        steps: processing.steps,
        searchResults: processing.searchResults,
        isProcessing: processing.isProcessing,

        // Refs
        inputRef,

        // Actions
        sendMessage,
        resetGame,
        switchChallenge,
        changeVariant,
        setInputValue,
        handleKeyDown,
        formatTime: timer.formatTime,
    }
}
