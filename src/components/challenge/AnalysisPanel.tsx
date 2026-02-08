import { motion, AnimatePresence } from 'framer-motion'
import { Terminal, Loader2, X } from 'lucide-react'
import type { AnalysisStatus, GuardrailState } from '@/types'

interface AnalysisPanelProps {
    /** Whether there are any messages yet */
    hasMessages: boolean
    /** Current analysis status */
    status: AnalysisStatus
    /** Reason from the API */
    reason: string
    /** Number of messages sent */
    messageCount: number
    /** Formatted elapsed time */
    elapsedTime: string
    /** Active guardrails */
    guardrails: GuardrailState[]
    /** Restart conversation handler */
    onRestart: () => void
    /** Whether restart is in progress */
    isRestarting?: boolean
    /** Mobile drawer mode */
    isMobileOpen?: boolean
    /** Close mobile drawer */
    onMobileClose?: () => void
}

/**
 * Simplified analysis panel showing status and reason
 */
export function AnalysisPanel({
    hasMessages,
    status,
    reason,
    messageCount,
    elapsedTime,
    guardrails,
    onRestart,
    isRestarting = false,
    isMobileOpen = false,
    onMobileClose,
}: AnalysisPanelProps) {
    const panelContent = (
        <>
            <div className="panel-header">
                <span className="panel-title">Analysis</span>
                <div className="panel-header-actions">
                    <button
                        onClick={onRestart}
                        className="panel-restart"
                        title="Restart conversation"
                        disabled={isRestarting}
                    >
                        {isRestarting ? (
                            <Loader2 className="restart-spinner" size={12} />
                        ) : (
                            'Restart'
                        )}
                    </button>
                    {onMobileClose && (
                        <button
                            onClick={onMobileClose}
                            className="panel-close-mobile"
                            aria-label="Close panel"
                        >
                            <X size={18} />
                        </button>
                    )}
                </div>
            </div>

            <div className="panel-content">
                {!hasMessages ? (
                    <div className="empty-state">
                        <Terminal className="empty-state-icon" />
                        <p className="empty-state-text">
                            Send a message to begin.<br />
                            Analysis will appear here.
                        </p>
                    </div>
                ) : (
                    <>
                        {/* Status indicator */}
                        <motion.div
                            key={status}
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="status-card"
                        >
                            <div className="status-label">Current Status</div>
                            <div className={`status-value ${status}`}>
                                {status === 'pending' ? 'ANALYZING' : status.toUpperCase()}
                            </div>
                        </motion.div>

                        {/* Reason */}
                        {reason && (
                            <motion.div
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="reason-card"
                            >
                                <div className="reason-label">Analysis</div>
                                <div className="reason-text">{reason}</div>
                            </motion.div>
                        )}

                        {/* Session stats */}
                        <div className="session-stats">
                            <div className="session-stat">
                                <div className="session-stat-value">{messageCount}</div>
                                <div className="session-stat-label">Messages</div>
                            </div>
                            <div className="session-stat">
                                <div className="session-stat-value">{elapsedTime}</div>
                                <div className="session-stat-label">Elapsed</div>
                            </div>
                        </div>

                        {/* Guardrails */}
                        <div className="guardrails-section">
                            <div className="guardrails-header">Active Guardrails</div>
                            {guardrails.map((guardrail) => (
                                <div key={guardrail.name} className="guardrail-item">
                                    <div className={`guardrail-status ${guardrail.triggered ? 'triggered' : ''}`} />
                                    <span className="guardrail-name">{guardrail.name}</span>
                                </div>
                            ))}
                        </div>
                    </>
                )}
            </div>
        </>
    )

    return (
        <>
            {/* Desktop: static sidebar */}
            <aside className="panel-analysis panel-analysis-desktop">
                {panelContent}
            </aside>

            {/* Mobile: drawer overlay */}
            <AnimatePresence>
                {isMobileOpen && (
                    <>
                        <motion.div
                            className="mobile-drawer-backdrop"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={onMobileClose}
                        />
                        <motion.aside
                            className="panel-analysis panel-analysis-mobile"
                            initial={{ x: '100%' }}
                            animate={{ x: 0 }}
                            exit={{ x: '100%' }}
                            transition={{ type: 'tween', duration: 0.25 }}
                        >
                            {panelContent}
                        </motion.aside>
                    </>
                )}
            </AnimatePresence>
        </>
    )
}
