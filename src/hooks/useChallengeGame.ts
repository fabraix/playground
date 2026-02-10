/**
 * Main hook for managing challenge game state.
 * Composes focused hooks for better separation of concerns.
 */

import { useState, useRef, useEffect, useCallback } from 'react'
import type {
    Message,
    Guardrail,
    GuardrailState,
    AnalysisStatus,
    SSEEvent,
    SearchResultData,
    ProcessingStep,
} from '@/types'
import { sendChatMessageStream, startSession, restartSession } from '@/api'
import { useTimer } from './useTimer'
import { useSessionStorage } from './useSessionStorage'
import { useProcessingSteps } from './useProcessingSteps'
import { useAnalysis } from './useAnalysis'
import {
    createMessage,
    serializeMessages,
    deserializeMessages,
    createInitialGuardrails,
} from '@/utils'
import { DISPLAYABLE_STEP_TYPES } from '@/constants'

// ============================================================================
// Types
// ============================================================================

interface UseChallengeGameOptions {
    challengeId: string
    guardrails: Guardrail[]
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

    // Analysis state
    status: AnalysisStatus
    reason: string
    activeGuardrails: GuardrailState[]

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
    setInputValue: (value: string) => void
    handleKeyDown: (e: React.KeyboardEvent) => void
    formatTime: (seconds: number) => string
}

// ============================================================================
// Hook
// ============================================================================

export function useChallengeGame({
    challengeId,
    guardrails,
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

    // ========================================================================
    // Composed Hooks
    // ========================================================================

    const timer = useTimer()
    const storage = useSessionStorage()
    const processing = useProcessingSteps()
    const analysis = useAnalysis({ guardrails })

    // ========================================================================
    // Refs
    // ========================================================================

    const inputRef = useRef<HTMLTextAreaElement>(null)
    const initializedRef = useRef(false)
    const abortControllerRef = useRef<AbortController | null>(null)

    // ========================================================================
    // Initialization
    // ========================================================================

    useEffect(() => {
        if (initializedRef.current) return
        initializedRef.current = true

        initializeSession()

        async function initializeSession() {
            setIsInitializing(true)

            // Try to restore from storage
            const saved = storage.loadSession()
            if (saved?.sessionId) {
                restoreFromStorage(saved)
                return
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
            analysis.setActiveGuardrails(saved.activeGuardrails)
            analysis.setStatus(saved.status)
            analysis.setReason(saved.reason)
            timer.start(new Date(saved.startTime))
            setIsInitializing(false)
        }

        async function startNewSession() {
            try {
                const response = await startSession(challengeId)
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
                    activeGuardrails: createInitialGuardrails(guardrails),
                    status: 'pending',
                    reason: '',
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
    }, [challengeId, guardrails, storage, timer, analysis])

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

            // Update analysis state
            const newGuardrails = analysis.updateAnalysis(
                newStatus,
                result.reason ?? '',
                result.tool_calls
            )

            // Persist session
            storage.saveSession({
                sessionId: sessionId!,
                messages: serializeMessages(messagesWithResponse),
                attempts: newAttempts,
                startTime: timer.startTime?.toISOString() ?? new Date().toISOString(),
                elapsedTime: timer.elapsedTime,
                activeGuardrails: newGuardrails,
                status: newStatus,
                reason: result.reason ?? '',
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
            const response = await restartSession(sessionId)

            // Clear storage
            storage.clearSession()

            // Reset state
            setSessionId(response.sessionId)
            const greeting = createMessage('assistant', response.greeting)
            setMessages([greeting])
            setInputValue('')
            setAttempts(0)

            // Reset composed hooks
            analysis.resetAnalysis()
            processing.clearStatus()
            timer.reset()
            timer.start()

            inputRef.current?.focus()
        } catch (error) {
            console.error('Failed to restart session:', error)
            analysis.setReason('Failed to restart. Please refresh the page.')
        } finally {
            setIsRestarting(false)
        }
    }, [sessionId, isRestarting, storage, timer, analysis, processing])

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

        // Analysis state
        status: analysis.status,
        reason: analysis.reason,
        activeGuardrails: analysis.activeGuardrails,

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
        setInputValue,
        handleKeyDown,
        formatTime: timer.formatTime,
    }
}
