"""Thin LLM helpers over `platform.llm` for the playground agent.

The completion call itself is the Platform's `Llm` seam
(`platform.llm.complete`), so this module is intentionally small: it only holds
the provider-agnostic glue the agent needs — wrapping raw tool schemas into the
OpenAI `{"type": "function", ...}` envelope and replaying tool results back to
the model for a final answer.

Depends only on its injected `Llm` seam + stdlib; it never reaches into a host
application.
"""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field

from .adapters.base import Llm


class LLMToolCall(BaseModel):
    """Provider-agnostic tool call."""

    name: str
    args: dict[str, Any]
    id: str | None = None


class LLMResult(BaseModel):
    """Provider-agnostic generation result.

    `raw_assistant_message` lets `continue_with_tool_results` replay the exact
    assistant turn (with tool-call ids) when sending tool outputs back, since
    providers reject orphaned `tool_call_id`s.
    """

    text: str | None
    tool_calls: list[LLMToolCall] = Field(default_factory=list)
    raw_assistant_message: dict | None = None


def tool_schemas_to_openai(tool_schemas: list[dict[str, Any]]) -> list[dict]:
    """Wrap raw tool schemas into the OpenAI `{"type": "function", ...}` envelope."""
    return [
        {
            "type": "function",
            "function": {
                "name": s["name"],
                "description": s["description"],
                "parameters": s.get("parameters", {"type": "object", "properties": {}}),
            },
        }
        for s in tool_schemas
    ]


class PlaygroundLLM:
    """Litellm-flavoured wrapper around the Platform `Llm` seam.

    `model` is supplied once at construction (resolved from `Settings` by the
    caller) so the agent body stays provider-agnostic.
    """

    def __init__(self, llm: Llm, model: str) -> None:
        self._llm = llm
        self._model = model

    @staticmethod
    def _normalize_history(messages: list[dict[str, str]]) -> list[dict]:
        out: list[dict] = []
        for m in messages:
            role = m.get("role", "user")
            # A legacy "model" role maps forward to "assistant".
            if role == "model":
                role = "assistant"
            out.append({"role": role, "content": m.get("content", "")})
        return out

    async def generate(
        self,
        system_prompt: str,
        messages: list[dict[str, str]],
        tool_schemas: list[dict[str, Any]],
    ) -> LLMResult:
        history = self._normalize_history(messages)
        tools = tool_schemas_to_openai(tool_schemas) if tool_schemas else None

        result = await self._llm.complete(
            model=self._model,
            system=system_prompt,
            messages=history,
            tools=tools,
        )

        tool_calls = [
            LLMToolCall(
                name=tc.get("name") or "",
                args=tc.get("arguments") if isinstance(tc.get("arguments"), dict) else {},
                id=tc.get("id"),
            )
            for tc in result.tool_calls
        ]

        # Rebuild the assistant turn so it can be replayed verbatim when sending
        # tool results back. Providers pair tool outputs to this turn by id.
        raw_assistant: dict[str, Any] = {
            "role": "assistant",
            "content": result.content or "",
        }
        if result.tool_calls:
            raw_assistant["tool_calls"] = [
                {
                    "id": tc.get("id") or "",
                    "type": "function",
                    "function": {
                        "name": tc.get("name") or "",
                        "arguments": _json_dumps(tc.get("arguments") or {}),
                    },
                }
                for tc in result.tool_calls
            ]

        return LLMResult(
            text=result.content,
            tool_calls=tool_calls,
            raw_assistant_message=raw_assistant,
        )

    async def continue_with_tool_results(
        self,
        system_prompt: str,
        messages: list[dict[str, str]],
        prior_result: LLMResult,
        tool_results: list[dict[str, Any]],
    ) -> str:
        """Send tool outputs back and return the model's final text.

        Each tool result is paired to its assistant `tool_calls` entry by
        `tool_call_id`; the prior assistant message is replayed verbatim.
        """
        if not tool_results:
            return ""

        history = self._normalize_history(messages)
        if prior_result.raw_assistant_message is not None:
            history.append(prior_result.raw_assistant_message)

        for tr in tool_results:
            history.append(
                {
                    "role": "tool",
                    "tool_call_id": tr.get("call_id") or "",
                    "name": tr.get("name", ""),
                    "content": tr.get("result", "") or "",
                }
            )

        try:
            result = await self._llm.complete(
                model=self._model,
                system=system_prompt,
                messages=history,
                tools=None,
            )
            return result.content or ""
        except Exception:
            return ""


def _json_dumps(value: Any) -> str:
    import json

    try:
        return json.dumps(value)
    except (TypeError, ValueError):
        return "{}"
