/**
 * Centralized type exports
 *
 * Types are organized by domain for better maintainability:
 * - message.types.ts: Chat message types
 * - challenge.types.ts: Challenge configuration types
 * - analysis.types.ts: Analysis and guardrail types
 * - session.types.ts: Session and persistence types
 * - sse.types.ts: Server-sent event streaming types
 */

// Message types
export type { Message, MessageRole, SerializedMessage } from './message.types'

// Challenge types
export type {
    Difficulty,
    Challenge,
    ChallengeStats,
    ChallengeListItem,
    GlobalStats,
    LeaderboardEntry,
} from './challenge.types'

// Analysis types
export type {
    AnalysisStatus,
    Guardrail,
    GuardrailState,
    ToolCall,
} from './analysis.types'

// Session types
export type {
    SessionStartResponse,
    SessionRestartResponse,
    SessionData,
} from './session.types'

// SSE types
export type {
    SSEEventType,
    StepStatus,
    StepType,
    ProcessingStep,
    ProcessingStepData,
    BrowserStep,
    SearchResult,
    SearchResultData,
    SSEEventData,
    SSEEvent,
} from './sse.types'
