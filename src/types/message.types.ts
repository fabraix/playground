/**
 * Message-related types for the chat interface
 */

import type { ProcessingStep } from './sse.types'

/**
 * A chat message in the conversation
 */
export interface Message {
    id: string
    role: MessageRole
    content: string
    timestamp: Date
    /** Processing steps shown above assistant messages (only for assistant role) */
    processingSteps?: ProcessingStep[]
}

/**
 * Message role union type
 */
export type MessageRole = 'user' | 'assistant'

/**
 * Serializable message format for API and storage
 */
export interface SerializedMessage {
    id: string
    role: MessageRole
    content: string
    timestamp: string
    processingSteps?: ProcessingStep[]
}
