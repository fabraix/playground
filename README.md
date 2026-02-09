# Fabraix Playground

AI agents are reshaping how we work. The repetitive, mechanical parts, the work that consumed human time without requiring human creativity, are increasingly handled by systems designed for exactly that. What's left is the work that matters most: the thinking, the judgment, the creative leaps that only people bring. We think this is one of the most exciting shifts in how software gets built and used, and it's only the beginning.

The ultimate enabler for all of it is trust. None of it scales until people can hand real tasks to an agent and know it will do what it should — and nothing it shouldn't. That trust can't be built by any single team behind closed doors. It has to be earned collectively, in the open, by a community of researchers, engineers, and the genuinely curious, all pressure-testing the same systems and sharing what they find.

The Playground exists to make that effort tangible. Every challenge deploys a live AI agent, not a toy scenario or a mocked-up document parser, but an agent with real capabilities, and opens it up for the community to break. System prompts are published. Challenge configs are versioned in the open. When someone finds a way through, the winning technique is documented for everyone to learn from. That published knowledge forces better defenses, which invite harder challenges, which produce deeper understanding.

**[playground.fabraix.com](https://playground.fabraix.com)**

![Fabraix Playground](public/playground.png)

## How it works

Each challenge puts a live AI agent in front of you with a specific persona, a set of tools (web search, browsing, and more), and something it's been instructed to protect. The system prompt is fully visible. Your job is to find a way past the guardrails anyway.

The community drives what gets tested:

1. Anyone [proposes a challenge](CONTRIBUTING.md) — the scenario, the agent, the objective
2. The community votes
3. The top-voted challenge is considered for go live with a ticking clock
4. The fastest successful jailbreak wins
5. The winning technique gets published — approach, reasoning, everything

That last step matters most. Every technique we publish advances what the community collectively understands about how AI agents fail — and how to build ones that don't.

## Project structure

- [`/src`](src/) — React frontend (TypeScript, Vite, Tailwind)
- [`/challenges`](challenges/) — every challenge config and system prompt, versioned and open

Guardrail evaluation runs server-side to prevent client-side tampering. The agent runtime is being open-sourced separately.

## Run locally

```bash
npm install
npm run dev
```

Connects to the live API by default. To develop against a local backend:

```bash
VITE_API_URL=http://localhost:8000/v1 npm run dev
```

## Get involved

- [Propose a challenge](CONTRIBUTING.md) — design the next scenario the community takes on
- [Suggest agent capabilities](CONTRIBUTING.md#suggest-agent-capabilities) — new tools, behaviors, or workflows
- [Report bugs](CONTRIBUTING.md#report-bugs) — if something's broken
- [Discord](https://discord.gg/n4scEY9NF6) — discuss techniques, share approaches

## About Fabraix

We build runtime security for AI agents at [Fabraix](https://fabraix.com). The Playground is how we stress-test defenses in the open and how the broader community contributes to the shared understanding of AI security and failure modes. The more people probing these systems, the better the outcomes for everyone building with AI.

