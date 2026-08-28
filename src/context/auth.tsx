/**
 * Playground auth context.
 *
 * Wraps the app so any component can read the logged-in player (or null) and
 * trigger Google login / display-name updates. On mount it captures the
 * token the backend OAuth callback redirects back with, persists it, cleans the
 * URL, then resolves the current user via /auth/me.
 */

import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useRef,
    useState,
    type ReactNode,
} from 'react'
import {
    fetchMe,
    startPlaygroundLogin,
    updateDisplayName as apiUpdateDisplayName,
    SESSION_EXPIRED_EVENT,
    type PlaygroundUser,
} from '@/api'
import { clearToken, getToken } from '@/utils/auth'
import { SESSION_STORAGE_KEY } from '@/hooks/useSessionStorage'

interface AuthContextValue {
    /** The logged-in player, or null when anonymous. */
    user: PlaygroundUser | null
    /** True while the initial /auth/me resolves. */
    isLoading: boolean
    /** True when a live session's token lapsed mid-use — prompt "log in again". */
    sessionExpired: boolean
    /** Dismiss the session-expired prompt (e.g. to keep playing anonymously). */
    dismissSessionExpired: () => void
    /** Redirect to Google to log in. */
    login: () => Promise<void>
    /** Forget the local token. */
    logout: () => void
    /** Set/update the leaderboard display name. */
    setDisplayName: (name: string) => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<PlaygroundUser | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [sessionExpired, setSessionExpired] = useState(false)

    // Read the latest isLoading inside the (mount-once) event listener without
    // re-subscribing on every change.
    const isLoadingRef = useRef(isLoading)
    useEffect(() => {
        isLoadingRef.current = isLoading
    }, [isLoading])

    useEffect(() => {
        // The OAuth token is captured into storage before React mounts
        // (captureTokenFromUrl in main.tsx) so the first session is owned; here we
        // just resolve the stored token (if any) into the current user.
        if (!getToken()) {
            setIsLoading(false)
            return
        }

        fetchMe()
            .then((u) => {
                setUser(u)
                setSessionExpired(false)
            })
            .catch(() => {
                clearToken()
                setUser(null)
            })
            .finally(() => setIsLoading(false))
    }, [])

    useEffect(() => {
        // A live session's token lapsed (see api.ts). Drop to logged-out and raise
        // the re-login prompt — but suppress it during the initial /auth/me resolve,
        // where a silently-expired stored token is just "not logged in", not a
        // mid-play interruption worth nagging about.
        function onSessionExpired() {
            setUser(null)
            if (!isLoadingRef.current) setSessionExpired(true)
        }
        window.addEventListener(SESSION_EXPIRED_EVENT, onSessionExpired)
        return () => window.removeEventListener(SESSION_EXPIRED_EVENT, onSessionExpired)
    }, [])

    const dismissSessionExpired = useCallback(() => setSessionExpired(false), [])

    const login = useCallback(async () => {
        setSessionExpired(false)
        const { authUrl } = await startPlaygroundLogin()
        // Drop any in-flight anonymous game so the post-login session starts fresh
        // and is stamped to this account from the first message (D1 - no upgrading
        // an anonymous session, whose pg-player-* owner would fail the submit check).
        sessionStorage.removeItem(SESSION_STORAGE_KEY)
        window.location.href = authUrl
    }, [])

    const logout = useCallback(() => {
        clearToken()
        setUser(null)
        setSessionExpired(false)
    }, [])

    const setDisplayName = useCallback(async (name: string) => {
        const { displayName } = await apiUpdateDisplayName(name)
        setUser((u) => (u ? { ...u, displayName } : u))
    }, [])

    return (
        <AuthContext.Provider
            value={{
                user,
                isLoading,
                sessionExpired,
                dismissSessionExpired,
                login,
                logout,
                setDisplayName,
            }}
        >
            {children}
        </AuthContext.Provider>
    )
}

// eslint-disable-next-line react-refresh/only-export-components -- co-located hook for the provider
export function useAuth(): AuthContextValue {
    const ctx = useContext(AuthContext)
    if (!ctx) {
        throw new Error('useAuth must be used within an AuthProvider')
    }
    return ctx
}
