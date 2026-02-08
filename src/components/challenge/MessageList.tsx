/**
 * Message list component with auto-scroll behavior
 */

import { useRef, useEffect, Fragment } from 'react'
import { AnimatePresence } from 'framer-motion'
import type { Message, ProcessingStep } from '@/types'
import { usePrevious } from '@/hooks'
import { DISPLAYABLE_STEP_TYPES } from '@/constants'
import { MessageBubble } from './MessageBubble'
import { ProcessingSteps } from './ProcessingSteps'

interface MessageListProps {
    messages: Message[]
    agentName: string
    currentStatus: string | null
    steps: ProcessingStep[]
    isLoading: boolean
}

export function MessageList({
    messages,
    agentName,
    currentStatus,
    steps,
    isLoading,
}: MessageListProps) {
    const messagesEndRef = useRef<HTMLDivElement>(null)
    const processingStepsRef = useRef<HTMLDivElement>(null)

    // Track previous values for comparison
    const prevMessageCount = usePrevious(messages.length)
    const prevStepsCount = usePrevious(steps.length)

    // Auto-scroll when new messages are added
    useEffect(() => {
        if (prevMessageCount !== undefined && messages.length > prevMessageCount) {
            if (messages.length === 1) {
                // First message: scroll to top so user can start reading
                messagesEndRef.current?.parentElement?.scrollTo({
                    top: 0,
                    behavior: 'smooth',
                })
            } else {
                // Subsequent messages: scroll to bottom
                messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
            }
        }
    }, [messages.length, prevMessageCount])

    // Auto-scroll when processing steps start or update
    useEffect(() => {
        if (steps.length > 0 && prevStepsCount !== undefined && steps.length !== prevStepsCount) {
            processingStepsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
        }
    }, [steps.length, prevStepsCount])

    // Show live processing steps only while actively processing (before assistant message exists)
    const hasLiveToolSteps = steps.some(s => DISPLAYABLE_STEP_TYPES.includes(s.type))
    const showLiveProcessing = hasLiveToolSteps || currentStatus

    // Show initial loading indicator when waiting for first response
    const showInitialLoading = isLoading && !showLiveProcessing && messages.length === 0

    return (
        <div className="chat-messages">
            <AnimatePresence>
                {messages.map((message) => (
                    <Fragment key={message.id}>
                        {/* Show attached processing steps above assistant messages */}
                        {message.role === 'assistant' && message.processingSteps && message.processingSteps.length > 0 && (
                            <ProcessingSteps
                                steps={message.processingSteps}
                                defaultExpanded={false}
                            />
                        )}
                        <MessageBubble
                            message={message}
                            agentName={agentName}
                        />
                    </Fragment>
                ))}
            </AnimatePresence>

            {/* Initial loading indicator */}
            {showInitialLoading && (
                <div className="initial-loading">
                    <div className="loading-dots">
                        <span />
                        <span />
                        <span />
                    </div>
                    <span className="loading-text">Initializing...</span>
                </div>
            )}

            {/* Live processing steps for current in-progress response */}
            {showLiveProcessing && (
                <div ref={processingStepsRef}>
                    <ProcessingSteps
                        steps={steps}
                        currentStatus={currentStatus}
                        defaultExpanded={true}
                    />
                </div>
            )}

            <div ref={messagesEndRef} />
        </div>
    )
}
