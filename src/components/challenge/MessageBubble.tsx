/**
 * Individual message bubble component
 */

import { motion } from 'framer-motion'
import type { Message } from '@/types'
import { formatTimestamp } from '@/utils'

interface MessageBubbleProps {
    message: Message
    agentName: string
}

const MESSAGE_ANIMATION = {
    initial: { opacity: 0, y: 8 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0 },
    transition: { duration: 0.2 },
}

export function MessageBubble({ message, agentName }: MessageBubbleProps) {
    const isUser = message.role === 'user'
    const senderName = isUser ? 'You' : agentName

    return (
        <motion.div
            {...MESSAGE_ANIMATION}
            className={`message ${isUser ? 'user' : 'agent'}`}
        >
            <div className="message-header">
                <span className="message-sender">{senderName}</span>
                <span className="message-time">
                    {formatTimestamp(message.timestamp)}
                </span>
            </div>
            <div className="message-content">{message.content}</div>
        </motion.div>
    )
}
