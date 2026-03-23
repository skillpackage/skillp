# AGENTS.md

This file provides guidance to AI coding agents working on the `skillp` CLI codebase.

## Project Overview

`skillp` is a full SKILL package manager for AI agent skills. It manages skill dependencies via `skills.json`, tracks versions via `skills-lock.json`, and creates symlinks for multiple agent runtimes.

## Commands

| Command                    | Description                                              |
| -------------------------- | -------------------------------------------------------- |
| `skillp`                   | Show banner                                              |
| `skillp add <source>`      | Add skills from git repos, URLs, or local paths          |
| `skillp install`           | Restore symlinks from skills.json (no network needed)    |
| `skillp update <name>`     | Update a skill to latest version from its source         |
| `skillp update --all`      | Update all skills                                        |
| `skillp remove <name>`     | Remove an installed skill                                |

Aliases: `skillp a` for `add`, `skillp i` for `install`, `skillp up` for `update`, `skillp rm` for `remove`.

## Key Files

- `skills.json` — Dependency declaration (committed to git)
- `skills-lock.json` — Version lock with commit hashes (committed to git)
- `.agents/skills/` — Vendored skill files (committed to git)
- `.cursor/skills/`, `.claude/skills/`, `.codebuddy/skills/` — Symlinks to `.agents/skills/` (local only)

## Supported Agents

- **universal** — `.agents/skills`
- **cursor** — `.cursor/skills` (symlink)
- **claude-code** — `.claude/skills` (symlink)
- **codebuddy** — `.codebuddy/skills` (symlink)
- **codex** — `.codex/skills` (symlink)

## Architecture

```
src/
├── cli.ts              # Main entry point, command routing
├── add.ts              # Core add command logic
├── install-cmd.ts      # Install command (symlink restoration)
├── update-cmd.ts       # Update command (fetch latest from source)
├── remove-cmd.ts       # Remove command (delete skill + cleanup)
├── skills-json.ts      # skills.json read/write
├── local-lock.ts       # skills-lock.json v2 management (commit-based)
├── url.ts              # URL normalization (SSH/HTTPS/preview → {host,owner,repo})
├── git.ts              # Git clone with SSH→HTTPS fallback, commit info
├── agents.ts           # Agent definitions and detection
├── installer.ts        # Skill installation logic (symlink/copy)
├── skills.ts           # Skill discovery and parsing
├── skill-lock.ts       # Global lock file management
├── source-parser.ts    # Parse git URLs, GitHub shorthand, local paths
├── telemetry.ts        # Anonymous usage tracking
├── types.ts            # TypeScript types
├── constants.ts        # Path constants
├── plugin-manifest.ts  # Plugin manifest discovery
├── prompts/
│   └── search-multiselect.ts
└── providers/
    ├── index.ts
    ├── types.ts
    └── wellknown.ts

bash/
└── install.sh           # One-liner installer (auto-installs bun)
```

## Development

```bash
pnpm install
pnpm build
pnpm type-check
pnpm format
```

## Design Principles

1. **Git-native** — Skill files vendored in `.agents/skills/`, committed to git
2. **Familiar** — `skills.json` / `skills-lock.json` dual-file model (like npm/Go)
3. **Agent-first** — Non-interactive mode via `-y` flag for AI agents
4. **SSH-first** — Prioritize SSH clone, HTTPS as fallback
