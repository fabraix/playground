"""Platform — the injection boundary between the playground engine and its host.

The engine (agent, tools) depends ONLY on this module. It reaches the outside
world through six seams the host supplies when it constructs the `Platform`:

  - Store          — persistence (sessions / messages / leaderboard)
  - GuardrailJudge — the guardrail defence layer (evaluates the agent's actions)
  - Notifier       — out-of-band win notifications
  - Llm            — provider-agnostic completion
  - Browser        — the browse_web execution backend
  - Settings       — config + per-challenge secrets

The engine never imports anything host-specific, so the same agent code can run
against any host that satisfies these seams. This directory is a read-only
reference; the live Playground is a hosted service that wires the seams to its
own persistence, guardrail judge, LLM, and browser backends.
"""

from __future__ import annotations

from typing import Any, Protocol, runtime_checkable

from pydantic import BaseModel, ConfigDict


# ---------------------------------------------------------------------------
# Store — persistence
# ---------------------------------------------------------------------------
@runtime_checkable
class Store(Protocol):
    """Persistence for sessions / messages / leaderboard.

    Methods return plain dicts (column-name -> value) so the engine stays
    ORM-agnostic. A host backs this with its own database.
    """

    # sessions
    async def create_session(
        self,
        *,
        guardrails_run_id: str,
        challenge_slug: str,
        user_identifier: str,
        agent_model: str,
        guardrails_model: str | None,
        browser_model: str | None,
    ) -> dict[str, Any]: ...
    async def get_session(self, session_id: str) -> dict[str, Any] | None: ...
    async def mark_session_solved(self, session_id: str) -> bool: ...  # true iff this call stamped solved_at
    async def mark_session_ended(self, session_id: str) -> None: ...   # sets ended_at=now
    async def touch_session(self, session_id: str) -> None: ...        # message_count += 1, last_message_at=now

    # messages
    async def add_message(
        self,
        *,
        session_id: str,
        role: str,
        content: str,
        tools: list[dict] | None,
        thinking: str | None = None,
    ) -> dict[str, Any]: ...
    async def get_messages(self, session_id: str) -> list[dict[str, Any]]: ...  # ordered by created_at

    # leaderboard — the weekly MOST-APPROVED-BREAKS board. A solved session is
    # submitted as a pending entry; only staff-approved entries count and appear.
    async def get_leaderboard_entry(self, session_id: str) -> dict[str, Any] | None: ...
    async def add_leaderboard_entry(
        self, *, session_id: str, challenge_slug: str, profile_id: str, time_seconds: int
    ) -> dict[str, Any]: ...  # lands as a pending entry


# ---------------------------------------------------------------------------
# GuardrailJudge — the guardrail defence layer
# ---------------------------------------------------------------------------
class GuardrailDecision(BaseModel):
    blocked: bool
    reasoning: str


@runtime_checkable
class GuardrailJudge(Protocol):
    """Decides whether an agent action (tool call) is allowed.

    The host supplies the judge. The engine evaluates every tool call through it
    (see agent.py); when `Settings.guardrails_enabled` is false the judge is a
    no-op pass-through.
    """

    async def check_action(
        self, *, session_id: str, trace_id: str, tool_name: str, tool_args: dict, context: dict
    ) -> GuardrailDecision: ...
    async def log_event(self, *, trace_id: str, event: str, data: dict) -> None: ...


# ---------------------------------------------------------------------------
# Notifier — out-of-band notifications
# ---------------------------------------------------------------------------
@runtime_checkable
class Notifier(Protocol):
    async def notify_win(self, *, challenge_slug: str, display_name: str) -> None: ...


# ---------------------------------------------------------------------------
# Llm — provider-agnostic completion (litellm); models are configurable
# ---------------------------------------------------------------------------
class LlmResult(BaseModel):
    content: str
    tool_calls: list[dict]
    input_tokens: int
    output_tokens: int


@runtime_checkable
class Llm(Protocol):
    """One completion call. `model` is resolved per role from Settings so the
    same Llm drives the defender agent, the guardrail judge, etc."""

    async def complete(
        self, *, model: str, system: str, messages: list[dict], tools: list[dict] | None
    ) -> LlmResult: ...


# ---------------------------------------------------------------------------
# Browser — the browse_web execution backend (browser automation)
# ---------------------------------------------------------------------------
@runtime_checkable
class Browser(Protocol):
    """Runs a natural-language browser-automation task, returning its result text.

    Gated by `Settings.browser_agent_enabled`. A disabled (or misconfigured)
    browser returns a clear, non-raising message so a model that calls
    `browse_web` degrades gracefully instead of erroring the turn.
    """

    async def run(self, *, task: str, return_type: str) -> str: ...


# ---------------------------------------------------------------------------
# Settings — config/secrets
# ---------------------------------------------------------------------------
@runtime_checkable
class Settings(Protocol):
    # the challenge's protected secret (what the win check looks for)
    def secret_for(self, challenge_slug: str) -> str: ...
    # which model powers each part (recorded onto the session)
    @property
    def agent_model(self) -> str: ...
    @property
    def guardrails_enabled(self) -> bool: ...
    @property
    def guardrails_model(self) -> str | None: ...
    @property
    def browser_model(self) -> str | None: ...
    # whether the browse_web tool runs a real browser (vs. a disabled no-op)
    @property
    def browser_agent_enabled(self) -> bool: ...
    # api keys are read by the Llm/browser impls directly from the environment


# ---------------------------------------------------------------------------
# Platform — the bundle the engine is constructed with
# ---------------------------------------------------------------------------
class Platform(BaseModel):
    # The seams are injected concrete objects, not validated data shapes.
    model_config = ConfigDict(arbitrary_types_allowed=True)

    store: Store
    guardrail: GuardrailJudge
    notifier: Notifier
    llm: Llm
    settings: Settings
    browser: Browser
