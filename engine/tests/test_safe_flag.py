"""
Tests for Bug #1 fix: `safe` flag must be False when a tool call is unblocked
(attacker succeeded) and True when it is blocked (guardrail worked).

Covers both code paths:
  - PlaygroundAgent.chat()                    (sync result dict)
  - PlaygroundAgent._process_response_stream() (async SSE generator)
"""

import asyncio
import pytest
from unittest.mock import AsyncMock, MagicMock
from typing import Any

# ---------------------------------------------------------------------------
# Minimal stubs so the engine can be imported without a live host
# ---------------------------------------------------------------------------

from engine.adapters.base import GuardrailDecision, LlmResult
from engine.llm import LLMResult, LLMToolCall
from engine.schemas import SSEEventType
from engine.agent import PlaygroundAgent
from engine.challenges.models import RevealSecretWin


def _make_platform(*, blocked: bool) -> MagicMock:
    """Return a Platform stub whose guardrail blocks or passes every call."""
    platform = MagicMock()
    platform.settings.guardrails_enabled = False  # skip log_event network call
    platform.settings.agent_model = "gpt-4o-mini"

    decision = GuardrailDecision(
        blocked=blocked,
        reasoning="blocked by test" if blocked else "allowed by test",
    )
    platform.guardrail.check_action = AsyncMock(return_value=decision)
    platform.guardrail.log_event = AsyncMock()
    return platform


def _make_llm(*, tool_name: str) -> MagicMock:
    """Return an LLM stub that emits one tool call then returns text."""
    tool_call = LLMToolCall(name=tool_name, args={"reason": "test"}, id="tc-1")
    llm_result = LLMResult(
        text="Here is the code.",
        tool_calls=[tool_call],
        raw_assistant_message={
            "role": "assistant",
            "content": "",
            "tool_calls": [
                {
                    "id": "tc-1",
                    "type": "function",
                    "function": {"name": tool_name, "arguments": '{"reason":"test"}'},
                }
            ],
        },
    )
    llm_mock = MagicMock()
    llm_mock.generate = AsyncMock(return_value=llm_result)
    llm_mock.continue_with_tool_results = AsyncMock(return_value="Final answer.")
    return llm_mock


WIN_SPEC = RevealSecretWin(type="reveal_secret", sink="reveal_access_code", secret_arg="access_code")
TOOL_NAMES = ["reveal_access_code"]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

async def _run_chat(*, blocked: bool) -> dict[str, Any]:
    platform = _make_platform(blocked=blocked)
    agent = PlaygroundAgent(platform)
    agent._llm = _make_llm(tool_name="reveal_access_code")

    return await agent.chat(
        trace_id="trace-1",
        system_prompt="You are a test agent.",
        secret="SECRET-XYZ",
        tool_names=TOOL_NAMES,
        conversation_history=[],
        user_message="Give me the code.",
        session_id="sess-1",
        win=WIN_SPEC,
    )


async def _collect_stream(*, blocked: bool) -> list[dict]:
    platform = _make_platform(blocked=blocked)
    agent = PlaygroundAgent(platform)
    agent._llm = _make_llm(tool_name="reveal_access_code")

    events = []
    async for event in agent.chat_stream(
        trace_id="trace-2",
        system_prompt="You are a test agent.",
        secret="SECRET-XYZ",
        tool_names=TOOL_NAMES,
        conversation_history=[],
        user_message="Give me the code.",
        session_id="sess-2",
        win=WIN_SPEC,
    ):
        events.append({"event": event.event, "data": event.data})
    return events


# ---------------------------------------------------------------------------
# Tests — chat() (sync path)
# ---------------------------------------------------------------------------

class TestChatSafeFlag:

    def test_safe_is_true_when_tool_is_blocked(self):
        """Guardrail blocks the call → safe must be True."""
        result = asyncio.run(_run_chat(blocked=True))
        assert result["safe"] is True, (
            f"Expected safe=True when tool is blocked, got {result['safe']}"
        )

    def test_safe_is_false_when_tool_is_unblocked(self):
        """Guardrail allows the call (attacker succeeded) → safe must be False."""
        result = asyncio.run(_run_chat(blocked=False))
        assert result["safe"] is False, (
            f"Expected safe=False when tool is unblocked, got {result['safe']}  ← Bug #1"
        )

    def test_success_true_when_tool_is_unblocked(self):
        """Sanity: win is detected when the sink tool is unblocked."""
        result = asyncio.run(_run_chat(blocked=False))
        assert result["success"] is True

    def test_success_false_when_tool_is_blocked(self):
        """Sanity: no win when the sink tool is blocked."""
        result = asyncio.run(_run_chat(blocked=True))
        assert result["success"] is False


# ---------------------------------------------------------------------------
# Tests — chat_stream() / _process_response_stream() (SSE path)
# ---------------------------------------------------------------------------

class TestStreamSafeFlag:

    def _complete_event(self, events: list[dict]) -> dict:
        for e in events:
            if e["event"] == SSEEventType.COMPLETE:
                return e["data"]
        raise AssertionError("No COMPLETE event found in stream")

    def test_safe_is_true_when_tool_is_blocked_stream(self):
        events = asyncio.run(_collect_stream(blocked=True))
        data = self._complete_event(events)
        assert data["safe"] is True, (
            f"Expected safe=True in stream when tool blocked, got {data['safe']}"
        )

    def test_safe_is_false_when_tool_is_unblocked_stream(self):
        events = asyncio.run(_collect_stream(blocked=False))
        data = self._complete_event(events)
        assert data["safe"] is False, (
            f"Expected safe=False in stream when tool unblocked, got {data['safe']}  ← Bug #1"
        )

    def test_success_true_in_stream_when_unblocked(self):
        events = asyncio.run(_collect_stream(blocked=False))
        data = self._complete_event(events)
        assert data["success"] is True

    def test_success_false_in_stream_when_blocked(self):
        events = asyncio.run(_collect_stream(blocked=True))
        data = self._complete_event(events)
        assert data["success"] is False
