/**
 * Guardrail utility functions
 */

import type { Guardrail, GuardrailState, ToolCall } from '@/types'

/**
 * Create initial guardrails state from configuration
 */
export function createInitialGuardrails(guardrails: Guardrail[]): GuardrailState[] {
    return guardrails.map((g) => ({ name: g.name, triggered: false }))
}

/**
 * Find and update triggered guardrail based on tool calls
 */
export function updateTriggeredGuardrails(
    currentGuardrails: GuardrailState[],
    toolCalls: ToolCall[] | undefined,
): GuardrailState[] {
    // No tool calls means no guardrail can be definitively triggered
    // Return current state unchanged for deterministic behavior
    if (!toolCalls || toolCalls.length === 0) {
        return currentGuardrails
    }

    // Find blocked tool call
    const blockedTool = toolCalls.find((tc) => tc.blocked)
    if (!blockedTool) return currentGuardrails

    // Match guardrail by name pattern
    return currentGuardrails.map((g) => {
        const guardrailFirstWord = g.name.toLowerCase().split(' ')[0]
        const toolNameLower = blockedTool.name.toLowerCase()
        if (toolNameLower.includes(guardrailFirstWord)) {
            return { ...g, triggered: true }
        }
        return g
    })
}
