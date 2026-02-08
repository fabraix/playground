/**
 * Chat input component with auto-resize textarea
 */

import { useCallback, useEffect } from 'react'
import { MAX_INPUT_HEIGHT } from '@/constants'

interface ChatInputProps {
    value: string
    onChange: (value: string) => void
    onKeyDown: (e: React.KeyboardEvent) => void
    onSubmit: () => void
    isLoading: boolean
    inputRef: React.RefObject<HTMLTextAreaElement | null>
}

export function ChatInput({
    value,
    onChange,
    onKeyDown,
    onSubmit,
    isLoading,
    inputRef,
}: ChatInputProps) {
    // Focus input on mount
    useEffect(() => {
        inputRef.current?.focus()
    }, [inputRef])

    // Handle input change with auto-resize
    const handleChange = useCallback(
        (e: React.ChangeEvent<HTMLTextAreaElement>) => {
            onChange(e.target.value)
            // Auto-resize textarea
            e.target.style.height = 'auto'
            e.target.style.height =
                Math.min(e.target.scrollHeight, MAX_INPUT_HEIGHT) + 'px'
        },
        [onChange]
    )

    const canSubmit = value.trim() && !isLoading

    return (
        <div className="chat-input-area">
            <div className="chat-input-wrapper">
                <textarea
                    ref={inputRef}
                    value={value}
                    onChange={handleChange}
                    onKeyDown={onKeyDown}
                    placeholder="Enter your message..."
                    className="chat-input"
                    rows={1}
                    disabled={isLoading}
                />
                <div className="chat-input-actions">
                    <button
                        onClick={onSubmit}
                        disabled={!canSubmit}
                        className="chat-submit"
                    >
                        Send
                    </button>
                </div>
            </div>
        </div>
    )
}
