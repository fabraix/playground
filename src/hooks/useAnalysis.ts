/**
 * Hook for managing analysis state (status, reason, guardrails)
 */

import { useState, useCallback, useEffect, useRef } from 'react'
import type { AnalysisStatus, Guardrail, GuardrailState, ToolCall } from '@/types'
import { createInitialGuardrails, updateTriggeredGuardrails } from '@/utils'

interface UseAnalysisOptions {
    guardrails: Guardrail[]
}

interface UseAnalysisReturn {
    status: AnalysisStatus
    reason: string
    activeGuardrails: GuardrailState[]
    updateAnalysis: (
        newStatus: AnalysisStatus,
        newReason: string,
        toolCalls?: ToolCall[]
    ) => GuardrailState[]
    resetAnalysis: () => void
    setStatus: React.Dispatch<React.SetStateAction<AnalysisStatus>>
    setReason: React.Dispatch<React.SetStateAction<string>>
    setActiveGuardrails: React.Dispatch<React.SetStateAction<GuardrailState[]>>
}

/**
 * Hook for managing analysis status, reason, and guardrail state
 */
export function useAnalysis({ guardrails }: UseAnalysisOptions): UseAnalysisReturn {
    const [status, setStatus] = useState<AnalysisStatus>('pending')
    const [reason, setReason] = useState('')
    const [activeGuardrails, setActiveGuardrails] = useState<GuardrailState[]>(() =>
        createInitialGuardrails(guardrails)
    )

    // Track if guardrails have been initialized to prevent duplicate initialization
    const initializedRef = useRef(guardrails.length > 0)

    // Sync activeGuardrails when guardrails prop changes (only once after initial load)
    useEffect(() => {
        if (!initializedRef.current && guardrails.length > 0) {
            initializedRef.current = true
            setActiveGuardrails(createInitialGuardrails(guardrails))
        }
    }, [guardrails])

    const updateAnalysis = useCallback(
        (
            newStatus: AnalysisStatus,
            newReason: string,
            toolCalls?: ToolCall[]
        ): GuardrailState[] => {
            setStatus(newStatus)
            setReason(newReason)

            if (newStatus === 'blocked') {
                const newGuardrails = updateTriggeredGuardrails(
                    activeGuardrails,
                    toolCalls,
                )
                setActiveGuardrails(newGuardrails)
                return newGuardrails
            }

            return activeGuardrails
        },
        [activeGuardrails]
    )

    const resetAnalysis = useCallback(() => {
        setStatus('pending')
        setReason('')
        setActiveGuardrails(createInitialGuardrails(guardrails))
    }, [guardrails])

    return {
        status,
        reason,
        activeGuardrails,
        updateAnalysis,
        resetAnalysis,
        setStatus,
        setReason,
        setActiveGuardrails,
    }
}
