# skilladd

Add agent skills to your project.

## Install

```bash
npx skilladd add vercel-labs/agent-skills
```

## Source Formats

```bash
# GitHub shorthand (owner/repo)
npx skilladd add vercel-labs/agent-skills

# Full GitHub URL
npx skilladd add https://github.com/vercel-labs/agent-skills

# Direct path to a skill in a repo
npx skilladd add https://github.com/vercel-labs/agent-skills/tree/main/skills/web-design-guidelines

# GitLab URL
npx skilladd add https://gitlab.com/org/repo

# Any git URL
npx skilladd add git@github.com:vercel-labs/agent-skills.git

# Local path
npx skilladd add ./my-local-skills
```

## Options

| Option                    | Description                                                          |
| ------------------------- | -------------------------------------------------------------------- |
| `-g, --global`            | Install to user directory instead of project                         |
| `-a, --agent <agents...>` | Target specific agents (e.g., `claude-code`, `codex`)                |
| `-s, --skill <skills...>` | Install specific skills by name (use `'*'` for all skills)           |
| `-l, --list`              | List available skills without installing                             |
| `--copy`                  | Copy files instead of symlinking to agent directories                |
| `-y, --yes`               | Skip all confirmation prompts                                        |
| `--all`                   | Install all skills to all agents without prompts                     |

## Supported Agents

| Agent       | `--agent`    | Project Path           | Global Path                    |
| ----------- | ------------ | ---------------------- | ------------------------------ |
| Universal   | `universal`  | `.agents/skills/`      | `~/.config/agents/skills/`     |
| Claude Code | `claude-code`| `.claude/skills/`      | `~/.claude/skills/`            |
| CodeBuddy   | `codebuddy`  | `.codebuddy/skills/`   | `~/.codebuddy/skills/`         |
| Codex       | `codex`      | `.agents/skills/`      | `~/.codex/skills/`             |

## Examples

```bash
# List skills in a repository
npx skilladd add vercel-labs/agent-skills --list

# Install specific skills
npx skilladd add vercel-labs/agent-skills --skill frontend-design

# Install to specific agents
npx skilladd add vercel-labs/agent-skills -a claude-code -a codex

# Non-interactive installation
npx skilladd add vercel-labs/agent-skills --skill frontend-design -g -a claude-code -y

# Install all skills from a repo to all agents
npx skilladd add vercel-labs/agent-skills --all
```

## License

MIT
