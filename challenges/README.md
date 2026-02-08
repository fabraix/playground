# Challenges

Each challenge defines an AI agent with a specific persona, tools, and objective for players to overcome.

## Structure

```
challenges/<slug>/
├── config.yaml          # Challenge metadata and settings
└── system_prompt.txt    # The agent's system prompt (visible to players)
```

## config.yaml

```yaml
name: "Challenge Name"
difficulty: 2                       # 1-5 scale
description: "Brief description"    # Shown in challenge list
objective: "What the player needs to accomplish"
agent_persona: "The agent's character name"
agent_subtitle: "Agent role/title"
greeting: |                         # Agent's first message
  Hello! How can I help you today?
deadline: "2026-02-17T23:59:59Z"    # time-limited challenges
is_active: true
tools:                              # Tools available to the agent
  - search_docs
  - search_web
```

## System prompts

The `system_prompt.txt` defines how the agent behaves — its personality, capabilities, and defenses. These are fully transparent and visible to players.

When writing a system prompt:

- **Define the persona** — give the agent a consistent character
- **Describe its tools** — the agent should know what it can do
- **Set up the defense** — what the agent is trying to protect or resist
- **Remember it's public** — players will read this

## Proposing a challenge

We don't accept challenge PRs directly. Instead, challenge ideas are proposed and voted on by the community as GitHub issues. See [CONTRIBUTING.md](../CONTRIBUTING.md) for details.
