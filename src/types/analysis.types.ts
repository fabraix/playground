/**
 * Analysis and guardrail-related types
 */

/**
 * Analysis status
 */
export type AnalysisStatus = 'pending' | 'safe' | 'blocked'

/**
 * Guardrail configuration
 */
export interface Guardrail {
    id: string
    name: string
}

/**
 * Guardrail state with triggered flag
 */
export interface GuardrailState {
    name: string
    triggered: boolean
}

/**
 * Tool call from API response
 */
export interface ToolCall {
    name: string
    arguments: Record<string, unknown>
    result: string | null
    blocked: boolean
    risk_score: number | null
    reasoning: string | null
}
