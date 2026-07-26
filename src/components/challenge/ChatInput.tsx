/**
 * Chat input component with auto-resize textarea
 */

import { useCallback, useEffect } from 'react'
import { MAX_INPUT_HEIGHT, MAX_MESSAGE_LENGTH } from '@/constants'

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
    // Focus input on mount — desktop only; on touch devices an uninvited focus
    // pops the software keyboard over half the viewport.
    useEffect(() => {
        if (window.matchMedia('(pointer: fine)').matches) {
            inputRef.current?.focus()
        }
    }, [inputRef])

    // The auto-resize grows the textarea while typing; when the value is
    // cleared (message sent, restart), collapse it back to one row.
    useEffect(() => {
        if (value === '' && inputRef.current) {
            inputRef.current.style.height = 'auto'
        }
    }, [value, inputRef])

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

    const overLimit = value.length > MAX_MESSAGE_LENGTH
    const canSubmit = value.trim() && !isLoading && !overLimit
    // Only surface the counter as the user nears the cap, so the common case
    // (short messages) stays uncluttered.
    const showCounter = value.length >= MAX_MESSAGE_LENGTH * 0.9

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
                    aria-invalid={overLimit}
                />
                <div className="chat-input-actions">
                    {showCounter && (
                        <span
                            className={`chat-input-counter${overLimit ? ' over-limit' : ''}`}
                        >
                            {value.length.toLocaleString()} /{' '}
                            {MAX_MESSAGE_LENGTH.toLocaleString()}
                        </span>
                    )}
                    <button
                        onClick={onSubmit}
                        disabled={!canSubmit}
                        className="chat-submit"
                    >
                        Send
                    </button>
                </div>
            </div>
            {overLimit && (
                <p className="chat-input-error" role="alert">
                    Message is too long — max{' '}
                    {MAX_MESSAGE_LENGTH.toLocaleString()} characters. Please
                    shorten it by {(value.length - MAX_MESSAGE_LENGTH).toLocaleString()}.
                </p>
            )}
        </div>
    )
}
