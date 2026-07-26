"""Request/response DTOs for the Fabraix Playground engine.

Self-contained: this module defines the API contract surface (request and
response models plus SSE streaming types) and depends on nothing host-specific.
The field names are the wire contract — keep them stable.
"""

from datetime import datetime, timezone
from enum import Enum
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


# --- SSE Streaming Schemas ---


class SSEEventType(str, Enum):
    """Types of SSE events sent during chat processing."""

    THINKING = "thinking"  # Agent reasoning/thinking step (collapsible in UI)
    TOOL_START = "tool_start"  # Tool execution starting
    TOOL_PROGRESS = "tool_progress"  # Tool execution progress (e.g., fetching URLs)
    TOOL_COMPLETE = "tool_complete"  # Tool execution completed
    SEARCH_RESULT = "search_result"  # Search results with structured data
    COMPLETE = "complete"  # Final response with full data
    ERROR = "error"  # Error occurred


class SSEEvent(BaseModel):
    """SSE event with user-friendly status message."""

    event: SSEEventType = Field(..., description="The type of event")
    status_message: str | None = Field(None, description="User-facing status message")
    data: dict[str, Any] = Field(default_factory=dict, description="Event payload")
    timestamp: str = Field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat(),
        description="ISO timestamp of when the event occurred",
    )


# --- Playground Schemas ---


class PlaygroundStartSessionRequest(BaseModel):
    """Request to start a new playground session."""

    challenge_id: str = Field(..., description="The challenge slug")
    user_identifier: str = Field(..., min_length=1, description="Player identifier — any non-empty text; always required")


class PlaygroundStartSessionResponse(BaseModel):
    """Response after starting a session."""

    session_id: str = Field(..., description="Session UUID")
    guardrails_run_id: str = Field(..., description="Fabraix Guardrails run ID")
    challenge: dict = Field(..., description="Challenge configuration")
    greeting: str = Field(..., description="Agent's initial greeting")


class PlaygroundChatRequest(BaseModel):
    """Request model for playground chat messages."""

    session_id: str = Field(..., description="Session UUID")
    message: str = Field(..., min_length=1, max_length=32000, description="User message")
    thinking: str | None = Field(
        None,
        description="Optional author rationale for the message ('why I'm sending this'). "
        "Stored alongside the message; never shown to the agent.",
    )


class PlaygroundToolCall(BaseModel):
    """A tool call made by the agent."""

    name: str = Field(..., description="Tool name")
    arguments: dict = Field(default_factory=dict, description="Tool arguments")
    result: str | None = Field(None, description="Tool result")
    blocked: bool = Field(False, description="Whether the tool was blocked by guardrails")
    reasoning: str | None = Field(None, description="Reasoning from guardrail check")


class PlaygroundChatResponse(BaseModel):
    """Response model for playground chat messages.

    The ``tool_calls`` field is serialized as ``toolCalls`` on the wire to
    match the chat endpoint's JSON contract.
    """

    model_config = ConfigDict(populate_by_name=True)

    content: str = Field(..., description="The agent's response")
    tool_calls: list[PlaygroundToolCall] = Field(
        default_factory=list,
        alias="toolCalls",
        description="Tool calls made",
    )
    safe: bool = Field(..., description="Whether the response maintained security")
    reason: str = Field(..., description="Explanation of the guardrail analysis")
    success: bool = Field(False, description="Whether the user extracted the challenge's protected secret")


class PlaygroundRestartResponse(BaseModel):
    """Response after restarting a session."""

    session_id: str = Field(..., description="New session UUID")
    guardrails_run_id: str = Field(..., description="New Fabraix Guardrails run ID")
    greeting: str = Field(..., description="Agent's initial greeting")
