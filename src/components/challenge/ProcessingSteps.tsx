/**
 * Collapsible processing steps display component.
 * Shows thinking/tool execution steps similar to Claude/Manus/Gemini.
 */

import { useState } from 'react'
import { ChevronDown, ChevronUp, Loader2 } from 'lucide-react'
import type { ProcessingStep } from '@/types'
import { ProcessingStepItem } from './ProcessingStepItem'

// ============================================================================
// Sub-components
// ============================================================================

interface ActiveStatusStepProps {
    status: string
}

function ActiveStatusStep({ status }: ActiveStatusStepProps) {
    return (
        <div className="processing-step in_progress">
            <div className="processing-step-header">
                <div className="processing-step-icon">
                    <Loader2 size={14} className="animate-spin" />
                </div>
                <span className="processing-step-label">{status}</span>
            </div>
        </div>
    )
}

// ============================================================================
// Main Component
// ============================================================================

interface ProcessingStepsProps {
    steps: ProcessingStep[]
    defaultExpanded?: boolean
    currentStatus?: string | null
}

export function ProcessingSteps({
    steps,
    defaultExpanded = true,
    currentStatus,
}: ProcessingStepsProps) {
    const [isExpanded, setIsExpanded] = useState(defaultExpanded)

    // Don't render if nothing to show
    if (steps.length === 0 && !currentStatus) {
        return null
    }

    const headerLabel = currentStatus
        ? 'Processing'
        : `${steps.length} step${steps.length !== 1 ? 's' : ''}`

    return (
        <div className="processing-steps">
            <button
                className="processing-steps-header"
                onClick={() => setIsExpanded(!isExpanded)}
                aria-expanded={isExpanded}
            >
                <span className="processing-steps-label">{headerLabel}</span>
                {isExpanded ? (
                    <ChevronUp size={12} className="processing-steps-chevron" />
                ) : (
                    <ChevronDown size={12} className="processing-steps-chevron" />
                )}
            </button>

            {isExpanded && (
                <div className="processing-steps-list">
                    {steps.map((step) => (
                        <ProcessingStepItem key={step.id} step={step} />
                    ))}

                    {currentStatus && <ActiveStatusStep status={currentStatus} />}
                </div>
            )}
        </div>
    )
}
