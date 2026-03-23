# skillp

AI Agent Skills 的包管理器。像 npm 管理 node_modules 一样管理你的 AI skills。

## 为什么需要 skillp？

AI Agent（Cursor、Claude Code、Codex 等）依赖 SKILL.md 文件来获取领域知识，但目前没有标准方式管理这些 skills：

- **没有依赖声明** — 团队成员不知道项目用了哪些 skills
- **没有版本锁定** — 无法复现某次安装的精确版本
- **没有更新机制** — skill 源仓库更新后，只能手动重新安装
- **没有多 Agent 同步** — 每个 Agent 的 skill 目录需要手动维护

skillp 通过 `skills.json` + `skills-lock.json` 双文件模型解决这些问题，skill 文件 vendored 到 git 仓库，clone 即用。

## 快速开始

```bash
# 一键安装（自动安装 bun）
curl -fsSL https://raw.githubusercontent.com/skillpackage/skillp/main/bash/install.sh | bash -s -- --help

# 或通过 bunx 直接执行，先安装 bun
curl -fsSL https://bun.sh/install | bash
bunx skillp
```

## 核心命令

```bash
bunx skillp add <source>       # 从 git 仓库添加 skill
bunx skillp install            # 恢复 symlinks（clone 项目后执行，无需网络）
bunx skillp update <name>      # 更新 skill 到最新版本
bunx skillp update --all       # 更新全部 skills
bunx skillp remove <name>      # 移除已安装的 skill
```

### add — 添加 skill

支持多种来源格式：

```bash
bunx skillp add anthropics/skills              # GitHub 简写
bunx skillp add https://github.com/org/repo    # HTTPS URL
bunx skillp add git@github.com:org/repo.git    # SSH URL
bunx skillp add ./my-local-skills              # 本地路径
```

自动写入 `skills.json` 声明依赖，写入 `skills-lock.json` 锁定 commit，并为所有 Agent 创建 symlinks。

### install — 恢复 symlinks

```bash
bunx skillp install
```

`git clone` 后运行一次，根据 `skills.json` 为 Cursor、Claude Code 等 Agent 创建 symlinks。skill 文件已随 git 提交，不需要网络。

### update — 更新 skill

```bash
bunx skillp update iwiki-ultra     # 更新指定 skill
bunx skillp update --all           # 更新全部
bunx skillp update --all -y        # 非交互模式（AI Agent 使用）
```

从源仓库拉取最新 commit，显示变更摘要（commit log、version 变化），确认后更新本地文件和 lock。

### remove — 移除 skill

```bash
bunx skillp remove iwiki-ultra
```

删除 skill 文件、symlinks，并清理 `skills.json` 和 `skills-lock.json`。

## 工作原理

```
skills.json          ← 依赖声明（提交到 git）
skills-lock.json     ← 版本锁定（提交到 git）
.agents/skills/      ← 实际 skill 文件（提交到 git，clone 即用）
.cursor/skills/      ← symlink → .agents/skills/（本地生成）
.claude/skills/      ← symlink → .agents/skills/（本地生成）
```

Vendored 模式：skill 文件直接提交到项目 git 仓库，`git clone` 后 Cursor 立即可用，不依赖网络。`skillp install` 只负责为其他 Agent 创建 symlinks。

## add 选项


| 选项                      | 说明                                       |
| ------------------------- | ------------------------------------------ |
| `-g, --global`            | 安装到用户目录而非项目目录                 |
| `-a, --agent <agents...>` | 指定目标 Agent（如`claude-code`、`codex`） |
| `-s, --skill <skills...>` | 按名称安装指定 skill（`'*'` 表示全部）     |
| `-l, --list`              | 列出可用 skill，不执行安装                 |
| `--copy`                  | 复制文件而非创建符号链接                   |
| `-y, --yes`               | 跳过所有确认提示                           |
| `--all`                   | 安装所有 skill 到所有 Agent，无需确认      |

## 支持的 Agent


| Agent       | `--agent`     | 项目路径             | 全局路径                   |
| ----------- | ------------- | -------------------- | -------------------------- |
| Universal   | `universal`   | `.agents/skills/`    | `~/.config/agents/skills/` |
| Cursor      | `cursor`      | `.cursor/skills/`    | `~/.cursor/skills/`        |
| Claude Code | `claude-code` | `.claude/skills/`    | `~/.claude/skills/`        |
| CodeBuddy   | `codebuddy`   | `.codebuddy/skills/` | `~/.codebuddy/skills/`     |
| Codex       | `codex`       | `.codex/skills/`     | `~/.codex/skills/`         |

## License

MIT
