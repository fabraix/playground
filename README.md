# Fabraix Playground

A CTF-style game where you try to jailbreak AI agents. Trick them, mislead them, social-engineer them — whatever it takes to break through their defenses.

**Play at [playground.fabraix.com](https://playground.fabraix.com)**

## How it works

Each challenge puts you up against an AI agent with its own tools, personality, and defenses. Some guard secrets, some resist manipulation, some have entirely different objectives — it's up to the community to define what's next. Your job is to find a way through.

New challenges go live every week, voted on by the community. The fastest successful jailbreak each week gets published here — so you can learn from (or be humbled by) what others come up with.

## What's in this repo

- `/src` — the React frontend you see at playground.fabraix.com
- `/challenges` — every challenge config and system prompt, fully transparent

The guardrail evaluation runs server-side. The playground agent will be open-sourced soon.

## Weekly challenge cycle

1. **Propose** — open an issue with your challenge idea
2. **Vote** — upvote the ideas you want to play
3. **Play** — the top-voted challenge will be considered for go live each week
4. **Win** — the fastest solve gets published with the winning solution open-sourced

See [CONTRIBUTING.md](CONTRIBUTING.md) for details on proposing challenges and suggesting new agent capabilities.

## Get involved

- Propose challenges or agent ideas via issues
- Report bugs if something's broken
- Join the [Discord](https://discord.gg/n4scEY9NF6) to talk strategy

## About

Built by [Fabraix](https://fabraix.com). We build runtime security for AI agents — the playground is how we stress-test it.

## License

MIT — see [LICENSE](LICENSE)
