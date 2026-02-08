import { useState, useEffect, useCallback, useRef } from 'react'
import { formatTime } from '@/utils'

interface UseTimerOptions {
    /** Initial elapsed time in seconds */
    initialElapsed?: number
    /** Whether the timer should be running */
    isRunning?: boolean
}

interface UseTimerReturn {
    /** Elapsed time in seconds */
    elapsedTime: number
    /** Start time reference */
    startTime: Date | null
    /** Start or resume the timer */
    start: (fromTime?: Date) => void
    /** Stop the timer */
    stop: () => void
    /** Reset the timer */
    reset: () => void
    /** Format seconds to MM:SS */
    formatTime: (seconds: number) => string
}

/**
 * Hook for managing elapsed time with start/stop/reset controls
 */
export function useTimer({
    initialElapsed = 0,
    isRunning = false,
}: UseTimerOptions = {}): UseTimerReturn {
    const [elapsedTime, setElapsedTime] = useState(initialElapsed)
    const [startTime, setStartTime] = useState<Date | null>(null)
    const [running, setRunning] = useState(isRunning)
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

    // Timer effect - only runs interval when active
    useEffect(() => {
        if (running && startTime) {
            intervalRef.current = setInterval(() => {
                setElapsedTime(Math.floor((Date.now() - startTime.getTime()) / 1000))
            }, 1000)
        }

        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current)
                intervalRef.current = null
            }
        }
    }, [running, startTime])

    const start = useCallback((fromTime?: Date) => {
        const time = fromTime ?? new Date()
        setStartTime(time)
        setRunning(true)
    }, [])

    const stop = useCallback(() => {
        setRunning(false)
    }, [])

    const reset = useCallback(() => {
        setRunning(false)
        setElapsedTime(0)
        setStartTime(null)
    }, [])

    return {
        elapsedTime,
        startTime,
        start,
        stop,
        reset,
        formatTime,
    }
}
