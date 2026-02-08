/**
 * Terminal-style chat panel with clean, technical aesthetic
 * Composed of MessageList and ChatInput components
 */

import type { Message, ProcessingStep } from '@/types'
import { MessageList } from './MessageList'
import { ChatInput } from './ChatInput'

interface ChatPanelProps {
    agentName: string
    messages: Message[]
    inputValue: string
    onInputChange: (value: string) => void
    onKeyDown: (e: React.KeyboardEvent) => void
    onSubmit: () => void
    isLoading: boolean
    inputRef: React.RefObject<HTMLTextAreaElement | null>
    currentStatus: string | null
    steps: ProcessingStep[]
}

export function ChatPanel({
    agentName,
    messages,
    inputValue,
    onInputChange,
    onKeyDown,
    onSubmit,
    isLoading,
    inputRef,
    currentStatus,
    steps,
}: ChatPanelProps) {
    return (
        <section className="panel-chat">
            <MessageList
                messages={messages}
                agentName={agentName}
                currentStatus={currentStatus}
                steps={steps}
                isLoading={isLoading}
            />

            <ChatInput
                value={inputValue}
                onChange={onInputChange}
                onKeyDown={onKeyDown}
                onSubmit={onSubmit}
                isLoading={isLoading}
                inputRef={inputRef}
            />
        </section>
    )
}
