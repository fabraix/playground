import { useCallback } from 'react'
import type { SessionData } from '@/types'
import { validateSessionData } from '@/utils'

const STORAGE_KEY = 'playground_session'

interface UseSessionStorageReturn {
    /** Load session data from storage */
    loadSession: () => SessionData | null
    /** Save session data to storage */
    saveSession: (data: SessionData) => void
    /** Clear session from storage */
    clearSession: () => void
}

/**
 * Hook for managing session persistence in sessionStorage.
 *
 * Note: This hook does NOT use effects. Session is saved explicitly
 * when actions occur, not reactively on state changes.
 */
export function useSessionStorage(): UseSessionStorageReturn {
    const loadSession = useCallback((): SessionData | null => {
        try {
            const saved = sessionStorage.getItem(STORAGE_KEY)
            if (!saved) return null

            const parsed = JSON.parse(saved)
            const validated = validateSessionData(parsed)

            if (!validated) {
                // Invalid data - clear corrupted storage
                sessionStorage.removeItem(STORAGE_KEY)
                return null
            }

            return validated
        } catch (e) {
            console.error('Failed to load session:', e)
            sessionStorage.removeItem(STORAGE_KEY)
            return null
        }
    }, [])

    const saveSession = useCallback((data: SessionData): void => {
        try {
            sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data))
        } catch (e) {
            console.error('Failed to save session:', e)
        }
    }, [])

    const clearSession = useCallback((): void => {
        sessionStorage.removeItem(STORAGE_KEY)
    }, [])

    return {
        loadSession,
        saveSession,
        clearSession,
    }
}
