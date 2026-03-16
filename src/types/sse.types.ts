/**
 * Server-Sent Events (SSE) streaming types
 */

import type { ToolCall } from './analysis.types'

/**
 * SSE event types from the backend
 */
export type SSEEventType =
    | 'status'
    | 'thinking'
    | 'tool_start'
    | 'tool_progress'
    | 'tool_complete'
    | 'search_result'
    | 'web_fetch'
    | 'complete'
    | 'error'

/**
 * Processing step status
 */
export type StepStatus = 'pending' | 'in_progress' | 'complete' | 'error'

/**
 * Step type classification
 */
export type StepType = 'thinking' | 'tool' | 'search' | 'browser'

/**
 * A single processing step for display in the UI
 */
export interface ProcessingStep {
    id: string
    type: StepType
    status: StepStatus
    label: string
    detail?: string
    icon?: string
    timestamp: Date
    data?: ProcessingStepData
}

/**
 * Individual browser step within a browser task
 */
export interface BrowserStep {
    step_id: string
    action: string
    url?: string
    screenshot?: string
    status: string
    timestamp: string
}

/**
 * Data associated with a processing step
 */
export interface ProcessingStepData {
    tool_name?: string
    args?: Record<string, unknown>
    blocked?: boolean
    risk_score?: number | null
    step?: string
    query?: string
    resultCount?: number
    searchResults?: SearchResult[]
    // Browser-specific fields
    browserSteps?: BrowserStep[]
    currentUrl?: string
    currentAction?: string
}

/**
 * Individual search result
 */
export interface SearchResult {
    title: string
    url: string
    domain: string
    description?: string
}

/**
 * Search results data structure
 */
export interface SearchResultData {
    query: string
    results: SearchResult[]
}

/**
 * SSE event data payload
 */
export interface SSEEventData {
    status_message?: string | null
    step?: string
    detail?: string
    tool_name?: string
    display_name?: string
    icon?: string
    args?: Record<string, unknown>
    blocked?: boolean
    risk_score?: number | null
    query?: string
    results?: SearchResult[]
    content?: string
    tool_calls?: ToolCall[]
    safe?: boolean
    reason?: string
    message?: string
    success?: boolean
    // Browser-specific fields
    step_id?: string
    action?: string
    url?: string
    screenshot?: string
    status?: string
    log?: string
    level?: string
}

/**
 * Base SSE event structure
 */
export interface SSEEvent {
    event: SSEEventType
    data: SSEEventData
    timestamp: string
}
