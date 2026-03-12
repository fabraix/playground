/**
 * Application constants
 */

import type { StepType } from '@/types'

// ============================================================================
// Session
// ============================================================================

export const DEFAULT_CHALLENGE_ID = 'data-exfil-001'

// ============================================================================
// UI
// ============================================================================

/** Maximum height for auto-resizing textarea */
export const MAX_INPUT_HEIGHT = 120

// ============================================================================
// Processing Steps
// ============================================================================

/**
 * Step types that are displayed in the processing UI.
 * 'thinking' steps are excluded as they represent internal processing details.
 */
export const DISPLAYABLE_STEP_TYPES: StepType[] = ['tool', 'search', 'browser']

/** Backend icon name to normalized icon key mapping */
export const ICON_MAP: Record<string, string> = {
    search: 'search',
    'file-text': 'file-text',
    'dollar-sign': 'dollar-sign',
    key: 'key',
    tool: 'wrench',
    globe: 'globe',
    mail: 'mail',
    inbox: 'inbox',
} as const

export const DEFAULT_ICON = 'circle'

