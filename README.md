# skillp

Add agent skills to your project.

## Install

```bash
curl -fsSL https://raw.githubusercontent.com/skillpackage/skillp/main/bash/install.sh | bash -s -- add https://github.com/anthropics/skills
```

or via bunx / npx:

```bash
bunx skillp add https://github.com/anthropics/skills
```

## Source Formats

```bash
# GitHub shorthand (owner/repo)
bunx skillp add anthropics/skills

# Full GitHub URL
bunx skillp add https://github.com/anthropics/skills

# Direct path to a skill in a repo
bunx skillp add https://github.com/anthropics/skills/tree/main/skills/web-design-guidelines

# GitLab URL
bunx skillp add https://gitlab.com/org/repo

# Any git URL
bunx skillp add git@github.com:anthropics/skills.git

# Local path
bunx skillp add ./my-local-skills
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
bunx skillp add anthropics/skills --list

# Install specific skills
bunx skillp add anthropics/skills --skill frontend-design

# Install to specific agents
bunx skillp add anthropics/skills -a claude-code -a codex

# Non-interactive installation
bunx skillp add anthropics/skills --skill frontend-design -g -a claude-code -y

# Install all skills from a repo to all agents
bunx skillp add anthropics/skills --all
```

## License

MIT
