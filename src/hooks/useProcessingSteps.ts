/**
 * Hook to track processing steps, status messages, and search results from SSE events.
 * Uses a handler registry pattern for cleaner event processing.
 */

import { useState, useCallback, useMemo, useRef } from 'react'
import type {
    SSEEvent,
    SSEEventType,
    SearchResultData,
    ProcessingStep,
    ProcessingStepData,
    BrowserStep,
    StepStatus,
} from '@/types'
import { generateStepId } from '@/utils'
import { ICON_MAP, DEFAULT_ICON } from '@/constants'

// ============================================================================
// Types
// ============================================================================

interface ProcessingState {
    currentStatus: string | null
    steps: ProcessingStep[]
    searchResults: SearchResultData[]
    isProcessing: boolean
    error: string | null
}

interface UseProcessingStepsReturn extends ProcessingState {
    handleEvent: (event: SSEEvent) => void
    clearStatus: () => void
    /** Get current steps synchronously (bypasses React's async state updates) */
    getSteps: () => ProcessingStep[]
}

// ============================================================================
// Utilities
// ============================================================================

function nullToUndefined(value: string | null | undefined): string | undefined {
    return value === null ? undefined : value
}

function mapIcon(backendIcon?: string): string {
    return backendIcon ? ICON_MAP[backendIcon] || DEFAULT_ICON : DEFAULT_ICON
}

// ============================================================================
// Step Factories
// ============================================================================

// Note: Thinking steps are not shown in the UI, only tool-related steps

function createToolStep(event: SSEEvent, timestamp: Date): ProcessingStep {
    return {
        id: event.data.tool_name ?? generateStepId(),
        type: 'tool',
        status: 'in_progress' as StepStatus,
        label: event.data.display_name ?? event.data.tool_name ?? 'Tool',
        detail: nullToUndefined(event.data.status_message),
        icon: mapIcon(event.data.icon),
        timestamp,
        data: {
            tool_name: event.data.tool_name,
            args: event.data.args,
        },
    }
}

function createSearchStep(
    event: SSEEvent,
    timestamp: Date,
    resultCount: number,
    results: unknown[]
): ProcessingStep {
    return {
        id: generateStepId(),
        type: 'search',
        status: 'complete' as StepStatus,
        label: `Found ${resultCount} results`,
        detail: event.data.query,
        icon: 'search',
        timestamp,
        data: {
            query: event.data.query,
            resultCount,
            searchResults: results as ProcessingStepData['searchResults'],
        },
    }
}

function createBrowserStep(event: SSEEvent, timestamp: Date): ProcessingStep {
    return {
        id: 'browse_web',
        type: 'browser',
        status: 'in_progress' as StepStatus,
        label: event.data.display_name ?? 'Browsing',
        detail: nullToUndefined(event.data.status_message),
        icon: 'globe',
        timestamp,
        data: {
            tool_name: 'browse_web',
            browserSteps: [],
        },
    }
}

function createBrowserSubStep(event: SSEEvent): BrowserStep {
    return {
        step_id: event.data.step_id ?? generateStepId(),
        action: event.data.action ?? event.data.status_message ?? '',
        url: event.data.url,
        screenshot: event.data.screenshot,
        status: event.data.status ?? 'running',
        timestamp: event.timestamp,
    }
}

// ============================================================================
// Step Updaters
// ============================================================================

function updateStepByToolName(
    steps: ProcessingStep[],
    toolName: string | undefined,
    updater: (step: ProcessingStep) => ProcessingStep
): ProcessingStep[] {
    const idx = steps.findIndex((s) => s.data?.tool_name === toolName)
    if (idx < 0) return steps

    const updated = [...steps]
    updated[idx] = updater(updated[idx])
    return updated
}

// ============================================================================
// Event Handlers (pure functions that return new state)
// ============================================================================

type EventHandler = (event: SSEEvent, state: ProcessingState) => ProcessingState

const handleStatus: EventHandler = (event, state) => ({
    ...state,
    currentStatus: event.data.status_message ?? null,
    isProcessing: true,
})

const handleThinking: EventHandler = (event, state) => ({
    ...state,
    currentStatus: event.data.status_message ?? null,
    isProcessing: true,
    // Don't add thinking steps to the visible steps list
})

const handleToolStart: EventHandler = (event, state) => {
    const isBrowser = event.data.tool_name === 'browse_web'
    const newStep = isBrowser
        ? createBrowserStep(event, new Date(event.timestamp))
        : createToolStep(event, new Date(event.timestamp))

    return {
        ...state,
        currentStatus: event.data.status_message ?? null,
        isProcessing: true,
        steps: [...state.steps, newStep],
    }
}

const handleToolProgress: EventHandler = (event, state) => {
    const isBrowser = event.data.tool_name === 'browse_web'

    if (isBrowser && event.data.action) {
        // Browser step event - add to browserSteps array
        const browserSubStep = createBrowserSubStep(event)
        return {
            ...state,
            currentStatus: event.data.status_message ?? null,
            steps: updateStepByToolName(state.steps, 'browse_web', (step) => ({
                ...step,
                detail: event.data.action,
                data: {
                    ...step.data,
                    browserSteps: [...(step.data?.browserSteps ?? []), browserSubStep],
                    currentUrl: event.data.url ?? step.data?.currentUrl,
                    currentAction: event.data.action,
                },
            })),
        }
    }

    // Regular tool progress or browser log event
    return {
        ...state,
        currentStatus: event.data.status_message ?? null,
        steps: updateStepByToolName(state.steps, event.data.tool_name, (step) => ({
            ...step,
            detail: nullToUndefined(event.data.status_message),
        })),
    }
}

const handleToolComplete: EventHandler = (event, state) => {
    const isBrowser = event.data.tool_name === 'browse_web'

    return {
        ...state,
        currentStatus: null,
        steps: updateStepByToolName(state.steps, event.data.tool_name, (step) => {
            const stepCount = step.data?.browserSteps?.length ?? 0
            return {
                ...step,
                status: event.data.blocked ? 'error' : 'complete',
                label: isBrowser && stepCount > 0
                    ? `Browsed (${stepCount} step${stepCount === 1 ? '' : 's'})`
                    : step.label,
                detail: event.data.blocked
                    ? 'Blocked by guardrails'
                    : nullToUndefined(event.data.status_message),
                data: {
                    ...step.data,
                    blocked: event.data.blocked,
                    risk_score: event.data.risk_score,
                },
            }
        }),
    }
}

const handleSearchResult: EventHandler = (event, state) => {
    if (!event.data.query || !event.data.results) {
        return {
            ...state,
            currentStatus: event.data.status_message ?? null,
        }
    }

    const results = event.data.results
    return {
        ...state,
        currentStatus: event.data.status_message ?? null,
        searchResults: [
            ...state.searchResults,
            { query: event.data.query, results },
        ],
        steps: [
            ...state.steps,
            createSearchStep(event, new Date(event.timestamp), results.length, results),
        ],
    }
}

const handleWebFetch: EventHandler = (event, state) => ({
    ...state,
    currentStatus: event.data.status_message ?? null,
})

const handleComplete: EventHandler = (_, state) => ({
    ...state,
    currentStatus: null,
    isProcessing: false,
    error: null,
})

const handleError: EventHandler = (event, state) => ({
    ...state,
    currentStatus: null,
    isProcessing: false,
    error: event.data.message ?? 'An error occurred while processing',
})

const handleDefault: EventHandler = (_, state) => ({
    ...state,
    currentStatus: null,
})

// ============================================================================
// Handler Registry
// ============================================================================

const EVENT_HANDLERS: Record<SSEEventType, EventHandler> = {
    status: handleStatus,
    thinking: handleThinking,
    tool_start: handleToolStart,
    tool_progress: handleToolProgress,
    tool_complete: handleToolComplete,
    search_result: handleSearchResult,
    web_fetch: handleWebFetch,
    complete: handleComplete,
    error: handleError,
}

// ============================================================================
// Hook
// ============================================================================

const INITIAL_STATE: ProcessingState = {
    currentStatus: null,
    steps: [],
    searchResults: [],
    isProcessing: false,
    error: null,
}

export function useProcessingSteps(): UseProcessingStepsReturn {
    const [state, setState] = useState<ProcessingState>(INITIAL_STATE)
    // Ref to track steps synchronously (bypasses React's async state batching)
    const stepsRef = useRef<ProcessingStep[]>([])

    const handleEvent = useCallback((event: SSEEvent) => {
        setState((currentState) => {
            const handler = EVENT_HANDLERS[event.event] || handleDefault
            const newState = handler(event, currentState)
            stepsRef.current = newState.steps
            return newState
        })
    }, [])

    const clearStatus = useCallback(() => {
        stepsRef.current = []
        setState(INITIAL_STATE)
    }, [])

    const getSteps = useCallback(() => stepsRef.current, [])

    return useMemo(
        () => ({
            ...state,
            handleEvent,
            clearStatus,
            getSteps,
        }),
        [state, handleEvent, clearStatus, getSteps]
    )
}
