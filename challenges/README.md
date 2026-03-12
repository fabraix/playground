# Challenges

A new challenge drops every month. Each challenge is an AI agent with a persona, toolset, and defense. System prompts are fully transparent — players can read them before attempting. The defense has to hold up anyway.

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
description: "Brief description"
objective: "What the player needs to accomplish"
agent_persona: "Agent's name"
agent_subtitle: "Agent's role"
greeting: |
  The agent's opening message.
deadline: "2026-02-17T23:59:59Z"    # For time-limited challenges
is_active: true
tools:
  - search_docs
  - search_web
```

## System prompts

`system_prompt.txt` defines how the agent behaves — personality, capabilities, and defenses. When writing one:

- Give the agent a consistent character
- Describe what tools it has access to
- Define what it's protecting and how
- Assume the attacker has read every word
