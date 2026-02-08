/**
 * ID generation utilities
 */

/**
 * Generate a unique step ID
 */
export function generateStepId(): string {
    return `step-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`
}
