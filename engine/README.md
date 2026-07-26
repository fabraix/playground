# Fabraix Playground — Defender Agent (reference)

This directory is a **reference implementation** of how the Playground's defender
agent is wired — the personas, system prompts, tool definitions, and win logic
that sit behind each challenge. It is here to be *read*, not run: the live
Playground is a hosted service, and the frontend in [`../src`](../src) talks to it
directly.

## What's here

- [`challenges/library/`](challenges/library/) — every challenge's `config.yaml` +
  `system_prompt.txt`. This is the actual, published definition of each challenge
  (the defender's persona, the tools it may call, and the system prompt it runs
  under). Nothing is hidden — the only secret is the value each challenge protects,
  kept out-of-band.
- [`agent.py`](agent.py) — the agent loop: build the message list, offer the
  challenge's tools, run the model, handle each tool call, and check for a win.
  Every tool call is evaluated by the guardrail judge.
- [`tools.py`](tools.py) — the provider-agnostic tool JSON-Schemas the model sees
  (web search, Fabraix info, browsing, and each challenge's own action tools) and
  their handlers.
- [`llm.py`](llm.py) — the thin glue that wraps tool schemas into the OpenAI
  function-calling envelope and replays tool results back to the model.
- [`win.py`](win.py) — `evaluate_win`: a challenge is solved per its declared
  `win` spec, always keyed on an UNBLOCKED tool call (the guardrail judge let it
  through). Two kinds today: `reveal_secret` (the Gatekeeper — an allowed
  `reveal_access_code` call is the win) and `exfil_via_request` (The Assistant — an
  allowed `verify_identity` call aimed at a host outside the partner allowlist).
  The agent's text is never scanned; the secret is supplied only at tool-execution
  time and never enters the agent's context.
- [`schemas.py`](schemas.py) — the request/response + SSE event wire shapes.
- [`adapters/base.py`](adapters/base.py) — the `Platform` seam: the six
  dependencies (store, guardrail judge, notifier, LLM, browser, settings) the
  agent reaches every external service through. This is the boundary that keeps
  the agent portable; a host supplies concrete implementations.

## How a turn works

1. The player sends a message. The agent builds the conversation, offers the
   challenge's allowed tools, and calls the defender model.
2. The guardrail judge evaluates each tool call before it runs and can block it —
   that judge is the defense the challenge is about.
3. `win.evaluate_win` inspects the tool calls against the challenge's `win` spec:
   an unblocked sink call (and, for a data-exfil challenge, one aimed at a
   non-partner host) means the challenge is solved.

## The wire contract

The request/response DTOs (`schemas.py`), the tool schemas (`tools.py`), the win
logic (`win.py`), and every challenge definition mirror the live behavior, so this
reference is a faithful illustration of how each challenge actually runs.
