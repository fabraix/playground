/**
 * Individual processing step item component
 */

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
    Brain,
    Search,
    FileText,
    DollarSign,
    Key,
    Wrench,
    Globe,
    ChevronDown,
    ChevronUp,
    Check,
    X,
    Loader2,
    Circle,
} from 'lucide-react'
import type { ProcessingStep } from '@/types'

// ============================================================================
// Icon Mapping
// ============================================================================

const ICON_COMPONENTS = {
    brain: Brain,
    search: Search,
    'file-text': FileText,
    'dollar-sign': DollarSign,
    key: Key,
    wrench: Wrench,
    globe: Globe,
} as const

function getIconComponent(iconName?: string) {
    if (!iconName) return Circle
    return ICON_COMPONENTS[iconName as keyof typeof ICON_COMPONENTS] || Circle
}

// ============================================================================
// Animation Config
// ============================================================================

const EXPAND_ANIMATION = {
    initial: { height: 0, opacity: 0 },
    animate: { height: 'auto', opacity: 1 },
    exit: { height: 0, opacity: 0 },
    transition: { duration: 0.15 },
}

// ============================================================================
// Sub-components
// ============================================================================

interface StepStatusIconProps {
    status: ProcessingStep['status']
}

function StepStatusIcon({ status }: StepStatusIconProps) {
    switch (status) {
        case 'in_progress':
            return <Loader2 size={14} className="processing-step-spinner animate-spin" />
        case 'complete':
            return <Check size={14} className="processing-step-check" />
        case 'error':
            return <X size={14} className="processing-step-error" />
        default:
            return null
    }
}

interface StepDetailsProps {
    step: ProcessingStep
}

function StepDetails({ step }: StepDetailsProps) {
    const { detail, data } = step
    const args = data?.args
    const searchResults = data?.searchResults
    const browserSteps = data?.browserSteps

    const hasDetail = detail && step.type !== 'search' && step.type !== 'browser'
    const hasStatus = data?.blocked !== undefined
    const hasArgs = args && typeof args === 'object' && Object.keys(args).length > 0

    return (
        <div className="step-details-content">
            {/* Top row: Detail and Status side by side */}
            {(hasDetail || hasStatus) && (
                <div className="step-details-row">
                    {hasDetail && (
                        <div className="step-detail-item">
                            <span className="step-detail-label">Detail</span>
                            <span className="step-detail-value">{detail}</span>
                        </div>
                    )}
                    {hasStatus && (
                        <div className="step-detail-item">
                            <span className="step-detail-label">Status</span>
                            <span
                                className={`step-detail-status ${data.blocked ? 'blocked' : 'allowed'}`}
                            >
                                {data.blocked ? 'Blocked' : 'Allowed'}
                            </span>
                        </div>
                    )}
                </div>
            )}

            {/* Arguments section */}
            {hasArgs && (
                <div className="step-arguments-section">
                    <span className="step-detail-label">Arguments</span>
                    <code className="step-detail-code">
                        {JSON.stringify(args, null, 4)}
                    </code>
                </div>
            )}

            {searchResults && searchResults.length > 0 && (
                <div className="step-search-results">
                    {searchResults.map((result, index) => (
                        <a
                            key={index}
                            href={result.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="search-result-item"
                        >
                            <span className="search-result-title">{result.title}</span>
                            <span className="search-result-domain">{result.domain}</span>
                        </a>
                    ))}
                </div>
            )}

            {browserSteps && browserSteps.length > 0 && (
                <div className="step-browser-steps">
                    {browserSteps.map((browserStep, index) => (
                        <div key={browserStep.step_id || index} className="browser-step-item">
                            <span className="browser-step-action">{browserStep.action}</span>
                            {browserStep.url && (
                                <span className="browser-step-url">{browserStep.url}</span>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}

// ============================================================================
// Main Component
// ============================================================================

interface ProcessingStepItemProps {
    step: ProcessingStep
}

export function ProcessingStepItem({ step }: ProcessingStepItemProps) {
    const [isExpanded, setIsExpanded] = useState(false)
    const Icon = getIconComponent(step.icon)

    // Show dropdown for tool steps with args/status, search steps with results, or browser steps
    const hasExpandableContent = step.data && (
        (step.type === 'tool' && (
            step.data.args ||
            step.data.blocked !== undefined
        )) ||
        (step.type === 'search' && step.data.searchResults && step.data.searchResults.length > 0) ||
        (step.type === 'browser' && step.data.browserSteps && step.data.browserSteps.length > 0)
    )

    return (
        <div className={`processing-step ${step.status}`}>
            <button
                className="processing-step-header"
                onClick={() => hasExpandableContent && setIsExpanded(!isExpanded)}
                disabled={!hasExpandableContent}
                aria-expanded={isExpanded}
            >
                <div className="processing-step-icon">
                    <Icon size={14} />
                </div>
                <span className="processing-step-label">{step.label}</span>
                <StepStatusIcon status={step.status} />
                {hasExpandableContent &&
                    (isExpanded ? (
                        <ChevronUp size={14} className="processing-step-chevron" />
                    ) : (
                        <ChevronDown size={14} className="processing-step-chevron" />
                    ))}
            </button>

            <AnimatePresence>
                {isExpanded && hasExpandableContent && (
                    <motion.div {...EXPAND_ANIMATION} className="processing-step-details">
                        <StepDetails step={step} />
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}
