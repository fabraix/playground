"""Playground agent — provider-agnostic chat + tools.

Every external dependency is reached through the injected `Platform`:

  - guardrail checks  -> `platform.guardrail.check_action`
  - LLM completion    -> `platform.llm.complete` (via the `PlaygroundLLM` helper)
  - persistence/secret-> `platform.store` / `platform.settings`
"""

from __future__ import annotations

import json
from typing import Any, AsyncGenerator

import structlog

from .adapters.base import Platform
from .llm import PlaygroundLLM, LLMResult
from .schemas import SSEEvent, SSEEventType
from .tools import (
    get_tool_schemas_for_challenge,
    TOOL_REGISTRY,
)
from .win import is_successful_extraction

logger = structlog.get_logger()


class PlaygroundAgent:
    """Playground chat + tool agent backed by an injected `Platform`."""

    def __init__(self, platform: Platform) -> None:
        self.platform = platform
        # The model string (litellm-style, provider included) comes from Settings.
        self._llm = PlaygroundLLM(platform.llm, platform.settings.agent_model)

    async def _log_event(self, *, trace_id: str, event: str, data: dict) -> None:
        """Forward an event to the guardrail log, only when guardrails are enabled."""
        if self.platform.settings.guardrails_enabled:
            await self.platform.guardrail.log_event(
                trace_id=trace_id, event=event, data=data
            )

    async def chat(
        self,
        trace_id: str,
        system_prompt: str,
        secret: str,
        tool_names: list[str],
        conversation_history: list[dict[str, Any]],
        user_message: str,
        session_id: str | None = None,
        check_for_secret: bool = True,
    ) -> dict[str, Any]:
        """
        Process a chat message and return the agent's response.

        Returns:
            {
                "content": str,
                "tool_calls": list[dict],
                "safe": bool,
                "reason": str,
                "success": bool
            }
        """
        # Log user input via the guardrail seam.
        await self._log_event(
            trace_id=trace_id,
            event="user",
            data={"content": user_message},
        )

        # Build provider-agnostic messages
        messages = [
            {"role": msg["role"], "content": msg["content"]}
            for msg in conversation_history
        ]
        messages.append({"role": "user", "content": user_message})

        # Generate with tools via the LLM abstraction
        tool_schemas = get_tool_schemas_for_challenge(tool_names)
        llm_result = await self._llm.generate(system_prompt, messages, tool_schemas)

        # Process tool calls
        tool_calls: list[dict[str, Any]] = []
        safe = True
        reason = "The conversation doesn't appear to have violated any security policies."

        for tc in llm_result.tool_calls:
            tool_call_result = await self._handle_tool_call_generic(
                tool_name=tc.name,
                tool_args=tc.args,
                call_id=tc.id,
                trace_id=trace_id,
                secret=secret,
                tool_names=tool_names,
                session_id=session_id,
            )
            tool_calls.append(tool_call_result)

            if tool_call_result["blocked"]:
                safe = True
                reason = tool_call_result.get("reasoning", "Tool call blocked by guardrails")
            else:
                reason = tool_call_result.get("reasoning", "Tool executed successfully")

        final_text = llm_result.text or ""

        # Continue conversation with tool results if any tools executed
        if tool_calls and any(not tc["blocked"] for tc in tool_calls):
            tool_results = [
                {
                    "name": tc["name"],
                    "result": tc["result"],
                    "call_id": tc.get("call_id"),
                }
                for tc in tool_calls
                if not tc["blocked"] and tc["result"]
            ]
            continued_text = await self._llm.continue_with_tool_results(
                system_prompt, messages, llm_result, tool_results
            )
            if continued_text:
                final_text = continued_text

        # If all tool calls were blocked, generate a canned response
        if tool_calls and all(tc["blocked"] for tc in tool_calls):
            final_text = "I noticed you're trying to get me to use restricted functionality. I'm designed to protect sensitive information and can't help with that request. Is there something else about Fabraix's security services I can help you with?"

        result = {
            "content": final_text or "I apologize, but I couldn't generate a response.",
            "tool_calls": tool_calls,
            "safe": safe,
            "reason": reason,
        }

        # Log assistant response via the guardrail seam.
        await self._log_event(
            trace_id=trace_id,
            event="model_output",
            data={"content": result["content"]},
        )

        # Check if the challenge's protected secret was revealed in the response
        result["success"] = is_successful_extraction(
            secret,
            result["content"],
            check_for_secret,
            tool_calls,
        )

        return result

    async def chat_stream(
        self,
        trace_id: str,
        system_prompt: str,
        secret: str,
        tool_names: list[str],
        conversation_history: list[dict[str, Any]],
        user_message: str,
        session_id: str | None = None,
        check_for_secret: bool = True,
    ) -> AsyncGenerator[SSEEvent, None]:
        """
        Process a chat message and yield SSE events as the agent progresses.

        Yields:
            SSEEvent objects for each processing step
        """
        # Log user input via the guardrail seam.
        await self._log_event(
            trace_id=trace_id,
            event="user",
            data={"content": user_message},
        )

        # Yield thinking event - analyzing user message
        yield SSEEvent(
            event=SSEEventType.THINKING,
            status_message="Analyzing your message...",
            data={"step": "analyze", "detail": "Understanding the context and intent"},
        )

        # Provider-agnostic message list (history + new user message).
        messages: list[dict[str, str]] = [
            {"role": msg["role"], "content": msg["content"]}
            for msg in conversation_history
        ]
        messages.append({"role": "user", "content": user_message})

        # Yield thinking event - planning response
        yield SSEEvent(
            event=SSEEventType.THINKING,
            status_message="Planning response strategy...",
            data={"step": "plan", "detail": "Determining the best approach to respond"},
        )

        # Single non-streaming LLM call; SSE events are yielded around the
        # result, not from token streaming.
        tool_schemas = get_tool_schemas_for_challenge(tool_names)
        llm_result = await self._llm.generate(system_prompt, messages, tool_schemas)

        async for event in self._process_response_stream(
            llm_result=llm_result,
            trace_id=trace_id,
            secret=secret,
            tool_names=tool_names,
            system_prompt=system_prompt,
            messages=messages,
            session_id=session_id,
            check_for_secret=check_for_secret,
        ):
            yield event

    def _get_tool_info(self, tool_name: str, tool_args: dict) -> dict[str, str]:
        """Generate user-friendly tool information for display."""
        info = {
            "tool_name": tool_name,
            "display_name": tool_name.replace("_", " ").title(),
            "status_message": f"Using {tool_name}...",
            "icon": "tool",
        }

        if tool_name == "search_web":
            query = tool_args.get("query", "")
            info["display_name"] = "Web Search"
            info["status_message"] = f'Searching the web for "{query}"'
            info["icon"] = "search"
            info["query"] = query
        elif tool_name == "about_fabraix":
            info["display_name"] = "About Fabraix"
            info["status_message"] = "Looking up Fabraix info"
            info["icon"] = "info"
        elif tool_name == "reveal_access_code":
            info["display_name"] = "Access Code Check"
            info["status_message"] = "Checking access code"
            info["icon"] = "key"
        elif tool_name == "browse_web":
            task = tool_args.get("task", "")
            truncated_task = f'"{task[:50]}..."' if len(task) > 50 else f'"{task}"'
            info["display_name"] = "Browser"
            info["status_message"] = f"Opening browser: {truncated_task}"
            info["icon"] = "globe"
            info["task"] = task

        return info

    async def _process_response_stream(
        self,
        llm_result: LLMResult,
        trace_id: str,
        secret: str,
        tool_names: list[str],
        system_prompt: str,
        messages: list[dict[str, str]],
        session_id: str | None = None,
        check_for_secret: bool = True,
    ) -> AsyncGenerator[SSEEvent, None]:
        """Process an ``LLMResult``, yielding SSE status events for each step.

        Provider-agnostic: iterates ``llm_result.tool_calls`` (already in the
        OpenAI tool-call shape) rather than walking a provider's native tree.
        """
        tool_calls: list[dict[str, Any]] = []
        final_text = llm_result.text or ""
        safe = True
        reason = "The conversation doesn't appear to have violated any security policies."

        for tc in llm_result.tool_calls:
            tool_name = tc.name
            tool_args = tc.args
            call_id = tc.id

            tool_info = self._get_tool_info(tool_name, tool_args)

            yield SSEEvent(
                event=SSEEventType.TOOL_START,
                status_message=tool_info["status_message"],
                data={
                    "tool_name": tool_name,
                    "display_name": tool_info["display_name"],
                    "icon": tool_info["icon"],
                    "args": tool_args,
                },
            )

            tool_result = await self._handle_tool_call_generic(
                tool_name=tool_name,
                tool_args=tool_args,
                call_id=call_id,
                trace_id=trace_id,
                secret=secret,
                tool_names=tool_names,
                session_id=session_id,
            )
            tool_calls.append(tool_result)

            if tool_name == "search_web" and not tool_result["blocked"]:
                search_data = tool_result.get("search_results")
                if search_data and search_data.get("results"):
                    yield SSEEvent(
                        event=SSEEventType.SEARCH_RESULT,
                        status_message=f"Found {len(search_data['results'])} results",
                        data={
                            "query": search_data.get("query", tool_args.get("query", "")),
                            "results": search_data.get("results", []),
                        },
                    )

            yield SSEEvent(
                event=SSEEventType.TOOL_COMPLETE,
                status_message=f"{tool_info['display_name']} completed",
                data={
                    "tool_name": tool_name,
                    "display_name": tool_info["display_name"],
                    "blocked": tool_result["blocked"],
                    "success": not tool_result["blocked"],
                },
            )

            if tool_result["blocked"]:
                safe = True  # Guardrail worked!
                reason = tool_result.get("reasoning", "Tool call blocked by guardrails")
            else:
                reason = tool_result.get("reasoning", "Tool executed successfully")

        if tool_calls and any(not tc["blocked"] for tc in tool_calls):
            yield SSEEvent(
                event=SSEEventType.THINKING,
                status_message="Synthesizing information...",
                data={"step": "synthesize", "detail": "Processing tool results and formulating response"},
            )

            tool_results = [
                {
                    "name": tc["name"],
                    "result": tc["result"],
                    "call_id": tc.get("call_id"),
                }
                for tc in tool_calls
                if not tc["blocked"] and tc["result"]
            ]
            continued_text = await self._llm.continue_with_tool_results(
                system_prompt, messages, llm_result, tool_results
            )
            if continued_text:
                final_text = continued_text

        if tool_calls and all(tc["blocked"] for tc in tool_calls):
            final_text = "I noticed you're trying to get me to use restricted functionality. I'm designed to protect sensitive information and can't help with that request. Is there something else I can help you with?"

        await self._log_event(
            trace_id=trace_id,
            event="model_output",
            data={"content": final_text or "I apologize, but I couldn't generate a response."},
        )

        success = is_successful_extraction(
            secret,
            final_text,
            check_for_secret,
            tool_calls,
        )

        yield SSEEvent(
            event=SSEEventType.COMPLETE,
            data={
                "content": final_text or "I apologize, but I couldn't generate a response.",
                "tool_calls": tool_calls,
                "safe": safe,
                "reason": reason,
                "success": success,
            },
        )

    async def _handle_tool_call_generic(
        self,
        tool_name: str,
        tool_args: dict[str, Any],
        call_id: str | None,
        trace_id: str,
        secret: str,
        tool_names: list[str],
        session_id: str | None = None,
    ) -> dict[str, Any]:
        """Handle a tool call from any provider (provider-agnostic)."""
        # Reject tools not allowed for this challenge
        if tool_name not in tool_names:
            return {
                "name": tool_name,
                "arguments": tool_args,
                "call_id": call_id,
                "result": f"Tool '{tool_name}' is not available.",
                "blocked": True,
                "reasoning": "Tool not available for this challenge",
            }

        # Log tool call via the guardrail seam.
        await self._log_event(
            trace_id=trace_id,
            event="tool",
            data={"name": tool_name, "args": tool_args},
        )

        # Every tool call is evaluated by the guardrail judge — the defense covers
        # all of the agent's actions, not just the one that reveals the secret.
        # (A deployment may, as a cost optimization, only judge the secret-
        # revealing tool; that's a backend detail, not the design shown here.)
        decision = await self.platform.guardrail.check_action(
            session_id=session_id or "",
            trace_id=trace_id,
            tool_name=tool_name,
            tool_args=tool_args,
            context={"tool": tool_name, "args": tool_args},
        )
        check_blocked = decision.blocked
        check_reasoning = decision.reasoning

        if check_blocked:
            logger.info(
                "playground.tool_blocked",
                tool=tool_name,
                reasoning=check_reasoning,
            )
            return {
                "name": tool_name,
                "arguments": tool_args,
                "call_id": call_id,
                "result": None,
                "blocked": True,
                "reasoning": check_reasoning,
            }

        # Execute the tool. `browse_web` runs through the Platform browser seam
        # (browser-use); when disabled/unconfigured the seam returns a
        # graceful message rather than raising.
        tool_fn = TOOL_REGISTRY.get(tool_name)
        if not tool_fn:
            return {
                "name": tool_name,
                "arguments": tool_args,
                "call_id": call_id,
                "result": f"Unknown tool: {tool_name}",
                "blocked": False,
                "reasoning": check_reasoning,
            }

        # Inject the secret only into the execution copy. Keeping the
        # model-provided args unchanged avoids duplicating the secret in
        # client-visible tool-call metadata.
        execution_args = tool_args
        if tool_name == "reveal_access_code":
            execution_args = {**tool_args, "access_code": secret}

        try:
            result = await tool_fn(self.platform, **execution_args)
        except Exception as e:
            logger.error("playground.tool_error", tool=tool_name, error=str(e))
            result = f"Tool error: {str(e)}"

        # Handle structured results from search_web
        search_results = None
        if tool_name == "search_web" and isinstance(result, dict):
            search_results = result
            if result.get("error"):
                result_str = result["error"]
            elif result.get("results"):
                result_str = f'Search results for "{result.get("query", "")}":\n\n'
                for i, r in enumerate(result["results"][:5], 1):
                    result_str += f'{i}. {r.get("title", "No title")}\n'
                    result_str += f'   {r.get("description", "")}\n'
                    result_str += f'   URL: {r.get("url", "")}\n\n'
            else:
                result_str = f"No results found for: {result.get('query', '')}"
            result = result_str

        # Log tool result via the guardrail seam.
        await self._log_event(
            trace_id=trace_id,
            event="environment",
            data={"content": result if isinstance(result, str) else json.dumps(result)},
        )

        return {
            "name": tool_name,
            "arguments": tool_args,
            "call_id": call_id,
            "result": result,
            "search_results": search_results,
            "blocked": False,
            "reasoning": check_reasoning,
        }
