/**
 * Message utility functions
 */

import type { Message, SerializedMessage, MessageRole, ProcessingStep } from '@/types'

/**
 * Create a new message with auto-generated ID and timestamp
 */
export function createMessage(
    role: MessageRole,
    content: string,
    processingSteps?: ProcessingStep[]
): Message {
    return {
        id: crypto.randomUUID(),
        role,
        content,
        timestamp: new Date(),
        processingSteps,
    }
}

/**
 * Serialize a message for storage/API
 */
export function serializeMessage(message: Message): SerializedMessage {
    return {
        id: message.id,
        role: message.role,
        content: message.content,
        timestamp: message.timestamp.toISOString(),
        processingSteps: message.processingSteps,
    }
}

/**
 * Deserialize a message from storage/API
 */
export function deserializeMessage(message: SerializedMessage): Message {
    return {
        ...message,
        timestamp: new Date(message.timestamp),
    }
}

/**
 * Serialize an array of messages
 */
export function serializeMessages(messages: Message[]): SerializedMessage[] {
    return messages.map(serializeMessage)
}

/**
 * Deserialize an array of messages
 */
export function deserializeMessages(messages: SerializedMessage[]): Message[] {
    return messages.map(deserializeMessage)
}
