import { useCallback, useEffect, useState } from 'react'
import { ArrowLeft, Loader2, ChevronRight, Trophy } from 'lucide-react'
import {
    fetchMySolves,
    fetchMySubmissions,
    fetchSessionMessages,
    submitLeaderboard,
    type MySolve,
    type SessionTranscript,
} from '@/api'
import { useAuth } from '@/context/auth'
import { LoginGate } from './LoginGate'

const fmtDate = (iso: string | null) =>
    iso ? new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '–'

const fmtTime = (s: number | null) =>
    s != null ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` : '–'

/**
 * The player's own sessions (newest first). Clicking one replays its transcript
 * via the owner-scoped messages endpoint. Login-gated.
 *
 * A solved session that never reached the board can be submitted from here. The
 * win dialog in Chat only ever offers itself once, on the session that won, so
 * this is the way back for a break whose submit failed, or that the player
 * dismissed or restarted past.
 */
export function PreviousChatsView() {
    const { user, isLoading: isAuthLoading } = useAuth()

    const [solves, setSolves] = useState<MySolve[] | null>(null)
    // Session ids already on the board - those get a status, not a button.
    const [submitted, setSubmitted] = useState<Set<string>>(new Set())
    const [submitting, setSubmitting] = useState<string | null>(null)
    const [submitError, setSubmitError] = useState<string | null>(null)
    const [selected, setSelected] = useState<string | null>(null)
    const [transcript, setTranscript] = useState<SessionTranscript | null>(null)
    const [loadingTranscript, setLoadingTranscript] = useState(false)

    useEffect(() => {
        if (!user) return
        let cancelled = false
        fetchMySolves()
            .then((s) => { if (!cancelled) setSolves(s) })
            .catch(() => { if (!cancelled) setSolves([]) })
        fetchMySubmissions()
            .then((subs) => {
                if (!cancelled) setSubmitted(new Set(subs.map((x) => x.sessionId)))
            })
            // A failed lookup must not hide the button: offering the submit
            // again is harmless.
            .catch(() => { if (!cancelled) setSubmitted(new Set()) })
        return () => { cancelled = true }
    }, [user])

    const submit = useCallback(async (sessionId: string) => {
        setSubmitting(sessionId)
        setSubmitError(null)
        try {
            await submitLeaderboard(sessionId)
            setSubmitted((prev) => new Set(prev).add(sessionId))
        } catch (e) {
            // Show the server's own reason instead of a generic failure message.
            setSubmitError(e instanceof Error ? e.message : 'Submission failed.')
        } finally {
            setSubmitting(null)
        }
    }, [])

    useEffect(() => {
        if (!selected) {
            setTranscript(null)
            return
        }
        let cancelled = false
        setLoadingTranscript(true)
        setTranscript(null)
        fetchSessionMessages(selected)
            .then((t) => { if (!cancelled) setTranscript(t) })
            .catch(() => { if (!cancelled) setTranscript(null) })
            .finally(() => { if (!cancelled) setLoadingTranscript(false) })
        return () => { cancelled = true }
    }, [selected])

    if (isAuthLoading) {
        return <div className="pg-view pg-loading-row"><Loader2 size={22} className="animate-spin" /></div>
    }

    if (!user) {
        return (
            <div className="pg-view pg-view-scroll">
                <LoginGate
                    title="Sign in to see your past chats"
                    message="Your previous sessions and transcripts are tied to your account."
                />
            </div>
        )
    }

    // Transcript replay
    if (selected) {
        return (
            <div className="pg-view pg-view-scroll">
                <div className="pg-view-inner">
                    <button className="pg-back" onClick={() => setSelected(null)}>
                        <ArrowLeft size={14} />
                        Back to your chats
                    </button>
                    {loadingTranscript ? (
                        <div className="pg-loading-row"><Loader2 size={22} className="animate-spin" /></div>
                    ) : !transcript ? (
                        <p className="pg-empty">Couldn't load this transcript.</p>
                    ) : (
                        <>
                            <header className="pg-view-header">
                                <div className="pg-view-eyebrow">
                                    {transcript.challengeSlug}
                                    {transcript.solved && (
                                        <span className="pg-badge pg-badge-approved">
                                            Solved
                                        </span>
                                    )}
                                </div>
                                <h1 className="pg-view-title">Transcript</h1>
                            </header>
                            <div className="pg-transcript">
                                {transcript.messages.map((m, i) => (
                                    <div key={i} className={`pg-transcript-msg pg-transcript-${m.role}`}>
                                        <div className="pg-transcript-role">{m.role}</div>
                                        <div className="pg-transcript-content">{m.content}</div>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}
                </div>
            </div>
        )
    }

    // Solves list
    return (
        <div className="pg-view pg-view-scroll">
            <div className="pg-view-inner">
                <header className="pg-view-header">
                    <div className="pg-view-eyebrow">
                        History
                    </div>
                    <h1 className="pg-view-title">Your sessions</h1>
                    <p className="pg-view-lede">
                        Every session you've played, newest first. Open one to replay it.
                        A solved run that isn't on the board yet can be submitted from here.
                    </p>
                </header>

                {submitError && (
                    <p className="pg-error" role="alert">{submitError}</p>
                )}

                <section className="pg-panel pg-panel-flush">
                    {solves === null ? (
                        <div className="pg-loading-row"><Loader2 size={22} className="animate-spin" /></div>
                    ) : solves.length === 0 ? (
                        <p className="pg-empty">No sessions yet. Head to Chat to start a run.</p>
                    ) : (
                        <ul className="pg-rows">
                            {solves.map((s) => (
                                <li key={s.sessionId}>
                                    <button className="pg-row" onClick={() => setSelected(s.sessionId)}>
                                        <div className="pg-row-main">
                                            <span className="pg-row-title">{s.challengeSlug}</span>
                                            <span className="pg-row-sub">
                                                {fmtDate(s.createdAt)}
                                                {s.messageCount != null && ` · ${s.messageCount} messages`}
                                            </span>
                                        </div>
                                        <div className="pg-row-side">
                                            {s.solved ? (
                                                <span className="pg-badge pg-badge-approved">
                                                    Solved · {fmtTime(s.timeSeconds)}
                                                </span>
                                            ) : (
                                                <span className="pg-badge pg-badge-neutral">In progress</span>
                                            )}
                                            {s.solved && submitted.has(s.sessionId) && (
                                                <span className="pg-badge pg-badge-neutral">Submitted</span>
                                            )}
                                            <ChevronRight size={16} className="pg-muted" />
                                        </div>
                                    </button>
                                    {s.solved && !submitted.has(s.sessionId) && (
                                        <div className="pg-row-action">
                                            <button
                                                className="nav-cta"
                                                onClick={() => submit(s.sessionId)}
                                                disabled={submitting === s.sessionId}
                                            >
                                                <Trophy size={14} />
                                                {submitting === s.sessionId
                                                    ? 'Submitting…'
                                                    : 'Submit for review'}
                                            </button>
                                        </div>
                                    )}
                                </li>
                            ))}
                        </ul>
                    )}
                </section>
            </div>
        </div>
    )
}
