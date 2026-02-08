/**
 * Time utility functions
 */

/**
 * Format seconds to MM:SS string
 */
export function formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
}

/**
 * Format a Date to HH:MM time string
 */
export function formatTimestamp(date: Date): string {
    return date.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
    })
}
