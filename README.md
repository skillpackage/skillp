# skillp

为你的项目添加 AI Agent Skills。

## 一键安装

```bash
curl -fsSL https://raw.githubusercontent.com/skillpackage/skillp/main/bash/install.sh | bash -s -- add https://github.com/anthropics/skills --all
```

该脚本会自动安装 bun（如未安装），然后执行 skillp。

## 手动安装

skillp 依赖 [Bun](https://bun.sh) 运行时。如果你还没有安装 bun：

```bash
curl -fsSL https://bun.sh/install | bash
```

安装完成后，通过 `bunx` 直接执行：

```bash
bunx skillp add https://github.com/anthropics/skills
```

## 支持的来源格式

```bash
# GitHub 简写（owner/repo）
bunx skillp add anthropics/skills

# 完整 GitHub URL
bunx skillp add https://github.com/anthropics/skills

# 仓库中某个 skill 的直接路径
bunx skillp add https://github.com/anthropics/skills/tree/main/skills/web-design-guidelines

# GitLab URL
bunx skillp add https://gitlab.com/org/repo

# 任意 git URL
bunx skillp add git@github.com:anthropics/skills.git

# 本地路径
bunx skillp add ./my-local-skills
```

## 选项

| 选项                      | 说明                                                     |
| ------------------------- | -------------------------------------------------------- |
| `-g, --global`            | 安装到用户目录而非项目目录                                 |
| `-a, --agent <agents...>` | 指定目标 Agent（如 `claude-code`、`codex`）                |
| `-s, --skill <skills...>` | 按名称安装指定 skill（`'*'` 表示全部）                     |
| `-l, --list`              | 列出可用 skill，不执行安装                                 |
| `--copy`                  | 复制文件而非创建符号链接                                   |
| `-y, --yes`               | 跳过所有确认提示                                          |
| `--all`                   | 安装所有 skill 到所有 Agent，无需确认                      |

## 支持的 Agent

| Agent       | `--agent`    | 项目路径               | 全局路径                       |
| ----------- | ------------ | ---------------------- | ------------------------------ |
| Universal   | `universal`  | `.agents/skills/`      | `~/.config/agents/skills/`     |
| Claude Code | `claude-code`| `.claude/skills/`      | `~/.claude/skills/`            |
| CodeBuddy   | `codebuddy`  | `.codebuddy/skills/`   | `~/.codebuddy/skills/`         |
| Codex       | `codex`      | `.agents/skills/`      | `~/.codex/skills/`             |

## 示例

```bash
# 列出仓库中的 skill
bunx skillp add anthropics/skills --list

# 安装指定 skill
bunx skillp add anthropics/skills --skill frontend-design

# 安装到指定 Agent
bunx skillp add anthropics/skills -a claude-code -a codex

# 非交互式安装
bunx skillp add anthropics/skills --skill frontend-design -g -a claude-code -y

# 安装仓库中的所有 skill 到所有 Agent
bunx skillp add anthropics/skills --all
```

## License

MIT
