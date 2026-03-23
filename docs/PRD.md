# skillp Package Manager PRD

> 将 skillp 从 "add-only" 工具演进为完整的 SKILL 包管理器，类似 Go modules / npm。

## 1. Problem Statement

当前 `skillp` 只支持 `add` 命令 — 从 git 仓库克隆、发现 SKILL.md、安装到 agent 目录。缺少：

- **依赖声明**：项目没有统一文件记录「依赖了哪些 skills」
- **版本锁定**：无法精确复现某次安装的 skill 版本
- **更新能力**：没有 `update` 命令，只能重新 `add`
- **移除能力**：没有 `remove` 命令
- **symlink 恢复**：clone 项目后需要手动为各 agent 创建 symlinks，没有自动化命令

## 2. Design Principles

1. **Git-native** — skill 文件直接提交到项目 git 仓库（vendored 模式），clone 后 Cursor 立即可用
2. **Familiar** — skills.json / skills-lock.json 双文件模型，npm/Go 用户无学习成本
3. **Agent-first** — 默认行为为 AI Agent 优化（非交互模式、一句话安装）
4. **SSH-first** — 优先使用 SSH clone，HTTPS 作为 fallback

## 3. Architecture

### 项目目录结构

```
my-project/
├── .agents/skills/              ← 实际 SKILL 文件（提交到 git）
│   ├── iwiki-ultra/
│   │   └── SKILL.md
│   └── frontend-design/
│       └── SKILL.md
├── .cursor/skills/              ← symlinks → .agents/skills/*（本地生成，增强可见性）
├── .claude/skills/              ← symlinks → .agents/skills/*（本地生成）
├── .codebuddy/skills/           ← symlinks → .agents/skills/*（本地生成）
├── skills.json                  ← 依赖声明（提交到 git）
└── skills-lock.json             ← 版本锁定（提交到 git）
```

### 数据流

```
                    ┌─────────────┐
                    │ skills.json │  声明依赖源 + 版本约束
                    └──────┬──────┘
                           │
                    ┌──────▼──────┐
  skillp add ───► │   skillp  │ ◄─── skillp update
  skillp install  │   核心逻辑   │      skillp remove
                    └──────┬──────┘
                           │
              ┌────────────┼────────────┐
              ▼            ▼            ▼
     .agents/skills/  skills-lock.json  symlinks
     (实际文件)        (锁定版本)       (.cursor/ .claude/ .codebuddy/)
```

### Vendored 模式

`.agents/skills/` 目录 **不加入 .gitignore**，实际文件提交到 git。

好处：
- `git clone` 后 Cursor 直接可用（Cursor 从 `.agents/skills/` 读取）
- 不依赖网络即可使用 skills
- Code review 时可以看到 skill 内容变化

需要 `skillp install` 的场景：
- 为 Cursor、Claude Code、CodeBuddy 等创建 symlinks（本地生成，不提交到 git）
- Cursor 虽然直接从 `.agents/skills/` 读取，但创建 `.cursor/skills/` 软链可增强可见性，避免用户误以为未生效

## 4. File Format Spec

### 4.1 skills.json（项目依赖声明）

人类可编辑，提交到 git。

```jsonc
{
  // 依赖的 skills
  "skills": {
    "iwiki-ultra": {
      "source": "git@git.woa.com:chong/chong-skills.git",
      "path": "skills/iwiki-ultra",
      "version": "latest"
    },
    "frontend-design": {
      "source": "git@github.com:anthropics/agent-skills.git",
      "path": "skills/frontend-design",
      "version": "^1.0.0"
    }
  },

  // 需要创建 symlink 的 agent 列表
  "agents": ["cursor", "codebuddy", "claude-code"]
}
```

#### 字段说明

**skills.\<name\>**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `source` | string | 是 | Git 仓库地址（优先 SSH，其次 HTTPS） |
| `path` | string | 否 | skill 在源仓库中的路径（monorepo 场景） |
| `version` | string | 否 | 版本约束，默认 `"latest"` |

**version 字段取值**

| 写法 | 含义 |
|------|------|
| 不写 / `"latest"` | 跟踪最新 commit |
| `"1.0.0"` | 锁定到 git tag `v1.0.0` 的精确 commit |
| `"^1.0.0"` | 允许更新到 1.x.x 范围内的最新 tag |
| `"~1.0.0"` | 允许更新到 1.0.x 范围内的最新 tag |
| `"commit:<hash>"` | 锁定到精确 commit |

**agents**

| 值 | 对应路径 | 说明 |
|---|---------|------|
| `"cursor"` | `.cursor/skills/` | 创建 symlink（Cursor 直接读 `.agents/skills/`，软链增强可见性） |
| `"codebuddy"` | `.codebuddy/skills/` | 创建 symlink |
| `"claude-code"` | `.claude/skills/` | 创建 symlink |
| `"codex"` | `.codex/skills/` | 创建 symlink |

### 4.2 skills-lock.json（版本锁定）

自动生成，提交到 git。

```json
{
  "version": 2,
  "skills": {
    "iwiki-ultra": {
      "source": "git@git.woa.com:chong/chong-skills.git",
      "sourceType": "git.woa",
      "path": "skills/iwiki-ultra",
      "resolvedVersion": "1.0.0",
      "commit": "a1b2c3d4e5f67890abcdef1234567890abcdef12",
      "commitAt": "2026-03-19T10:00:00.000Z"
    }
  }
}
```

#### 字段说明

| 字段 | 说明 |
|------|------|
| `source` | 源仓库地址（与 skills.json 一致，统一存储为 SSH 格式） |
| `sourceType` | 源平台类型：`"git.woa"` / `"github"` / `"gitlab"` / `"other"` |
| `path` | skill 在源仓库中的路径 |
| `resolvedVersion` | 实际安装的版本号（优先取 SKILL.md frontmatter `version`，否则为 `"latest"`） |
| `commit` | 精确 commit hash（40 位） |
| `commitAt` | 该 commit 的提交时间（ISO 8601），同一 commit 不论谁安装值都相同 |

> **为什么没有 `computedHash`？** 在 vendored 模式下，skill 文件直接提交到项目 git 仓库，git 自身即为完整性保障。`commit` hash 已精确标识源仓库状态，本地文件的任何变动可通过项目自身的 `git diff` 检测，无需额外 hash 校验。

### 4.3 SKILL.md

SKILL.md 保持现有 frontmatter 规范不变，不新增字段。包管理元数据（source、版本锁定等）由 `skills.json` 和 `skills-lock.json` 承载，SKILL.md 专注于 AI Agent 的指令内容。

`resolvedVersion` 会读取 SKILL.md frontmatter 中的 `version` 字段（如有），否则为 `"latest"`。

## 5. Command Reference

### 5.1 `skillp add <source>` (增强现有)

从远程源添加 skill 到项目。

```bash
# SSH 格式
bunx skillp add git@git.woa.com:chong/chong-skills.git --skill iwiki-ultra

# HTTPS 格式
bunx skillp add https://git.woa.com/chong/chong-skills.git --skill iwiki-ultra

# 预览链接（无 .git 后缀，从浏览器地址栏复制）
bunx skillp add https://git.woa.com/chong/chong-skills --skill iwiki-ultra

# GitHub 仓库
bunx skillp add git@github.com:owner/repo.git --skill my-skill

# 非交互模式（AI Agent 使用）
bunx skillp add git@git.woa.com:chong/chong-skills.git --skill iwiki-ultra -y
```

**行为**：
1. 归一化 source URL（提取 host/owner/repo）
2. SSH 优先 clone 到临时目录，失败后 fallback HTTPS
3. 发现并选择 skills
4. 复制 skill 文件到 `.agents/skills/<name>/`
5. 写入 `skills.json`（新增或更新条目）
6. 写入 `skills-lock.json`（记录 commit hash + commitAt）
7. 根据 `skills.json` 中的 agents 创建 symlinks
8. 清理临时目录

### 5.2 `skillp install` (新增)

根据 `skills.json` 恢复 symlinks。不需要网络。

```bash
bunx skillp install
```

**行为**：
1. 读取 `skills.json` 的 `agents` 列表
2. 遍历 `.agents/skills/` 中已安装的 skills
3. 为每个 agent 创建 symlinks
4. 如果 `.agents/skills/` 中缺失某个 skill（文件被误删），提示用户运行 `skillp update`

**使用场景**：
- `git clone` 后初始化 symlinks
- 切换分支后同步 symlinks
- 新团队成员 onboarding

### 5.3 `skillp update <name>` (新增)

更新已安装的 skill 到最新版本。

```bash
# 更新单个 skill
bunx skillp update iwiki-ultra

# 更新全部
bunx skillp update --all

# 非交互模式
bunx skillp update --all -y
```

**行为**：
1. 读取 `skills.json` 和 `skills-lock.json`
2. 对目标 skill(s)，从 source clone 最新代码
3. 比较新旧 commit hash
4. 如果有更新：
   - 显示 commit log diff（旧commit..新commit）
   - 显示 version 变化（如有）
   - 确认后覆盖 `.agents/skills/<name>/` 中的文件
   - 更新 `skills-lock.json`（新 commit hash + commitAt）
5. 如果无更新：显示 "Already up to date"

**Version 约束处理**：
- `"latest"` / 未设 version → 始终拉最新 commit
- `"^1.0.0"` → 查找 1.x.x 范围内最新 git tag 对应的 commit
- `"1.0.0"` → 精确匹配 tag，如果当前已是该 tag 则不更新
- `"commit:<hash>"` → 不更新（已锁定）

### 5.4 `skillp remove <name>` (新增)

移除已安装的 skill。

```bash
bunx skillp remove iwiki-ultra
```

**行为**：
1. 删除 `.agents/skills/<name>/` 目录
2. 删除各 agent 目录下的 symlinks
3. 从 `skills.json` 中移除条目
4. 从 `skills-lock.json` 中移除条目

## 6. AI Agent One-liner

### 需求

AI Agent 能通过一句 bash 命令完成 skill 安装，无需交互。

### 方案

```bash
# 方式 1: 直接用 bunx（推荐）
bunx skillp add git@git.woa.com:chong/chong-skills.git --skill iwiki-ultra -y

# 方式 2: 通过 wget 下载安装脚本（自动安装 bun）
wget -qO- https://skills.example.com/install.sh | bash -s -- add git@git.woa.com:chong/chong-skills.git --skill iwiki-ultra
```

### install.sh 脚本逻辑

```bash
#!/bin/bash
# 1. 确保 bun 可用
if ! command -v bun &> /dev/null; then
    echo "Installing bun..."
    curl -fsSL https://bun.sh/install | bash
    export BUN_INSTALL="$HOME/.bun"
    export PATH="$BUN_INSTALL/bin:$PATH"
fi

# 2. 使用 bunx 执行 skillp，透传所有参数
bunx skillp "$@"
```

### Agent 集成示例

在 SKILL.md 中可以声明安装命令，供 Agent 自动执行：

```markdown
## 安装

\`\`\`bash
bunx skillp add git@git.woa.com:chong/chong-skills.git --skill iwiki-ultra -y
\`\`\`
```

## 7. Git Clone Flow (SSH -> HTTPS Fallback)

### URL 归一化

三种输入格式统一解析为 `{host, owner, repo}` 结构：

```
输入格式                                          → host          owner    repo
https://git.woa.com/chong/chong-skills            → git.woa.com   chong    chong-skills
git@git.woa.com:chong/chong-skills.git            → git.woa.com   chong    chong-skills
https://git.woa.com/chong/chong-skills.git        → git.woa.com   chong    chong-skills
```

归一化后根据需要构造 SSH 或 HTTPS URL。`skills.json` 和 `skills-lock.json` 中的 `source` 统一存储为 SSH 格式。

### Clone 流程

```
用户输入 source
      │
      ▼
归一化 URL → {host, owner, repo}
      │
      ▼
构造 SSH URL: git@{host}:{owner}/{repo}.git
      │
      ▼
尝试 SSH clone
      │
 成功? ──► 完成
      │
 失败 ──► 构造 HTTPS URL: https://{host}/{owner}/{repo}.git
              │
              ▼
         尝试 HTTPS clone
              │
         成功? ──► 完成（warn: using HTTPS fallback）
              │
              ▼
         失败，报错
```

## 8. Update Flow

```
skillp update <name>
      │
      ▼
读取 skills.json + skills-lock.json
      │
      ▼
从 lock 获取当前 commit hash
      │
      ▼
git ls-remote <source> 获取远程最新 commit
      │
      ▼
比较 commit hash ──────── 相同 ──► "Already up to date"
      │
      不同
      │
      ▼
检查 version 约束
      │
      ├── "latest" ──► 直接用最新 commit
      │
      ├── "^1.0.0" ──► 列出远程 tags
      │                  过滤匹配 1.x.x 的最新 tag
      │                  用该 tag 对应的 commit
      │
      └── "1.0.0" ──► 查找 v1.0.0 tag
                       如果当前已是该 tag ──► 不更新
                       否则用该 tag 的 commit
      │
      ▼
Clone 仓库到临时目录（指定 commit）
      │
      ▼
显示变更摘要：
  - commit log: old..new
  - version 变化（从 SKILL.md frontmatter 读取）
  - 文件变化数量
      │
      ▼
确认更新（-y 跳过确认）
      │
      ▼
覆盖 .agents/skills/<name>/
更新 skills-lock.json（commit + commitAt）
清理临时目录
```

## 9. Migration Plan

### 从现有 skillp add 迁移

现有用户已经用 `skillp add` 安装了 skills，但没有 `skills.json`。

**`skillp init`** 命令（可选）：
1. 扫描 `.agents/skills/` 中已安装的 skills
2. 读取现有 `skills-lock.json`（获取 source、commit 信息）
3. 生成 `skills.json`

如果 lock 文件没有 source 记录，则提示用户手动填写。

### 向后兼容

- 现有 `skillp add` 命令行为不变，只是额外写入 `skills.json`
- 没有 `skills.json` 的项目，`add` 命令会自动创建
- `install` / `update` / `remove` 命令需要 `skills.json` 存在

## 10. Phase Plan

### Phase 1 (MVP)

- [ ] `skills.json` 格式定义 + 读写逻辑
- [ ] `skills-lock.json` 格式升级（commit + commitAt，去掉 computedHash/installedAt/updatedAt）
- [ ] URL 归一化：支持 SSH / HTTPS / 预览链接三种输入格式
- [ ] SSH -> HTTPS fallback clone 逻辑
- [ ] 增强 `add` 命令：写入 skills.json + skills-lock.json
- [ ] `install` 命令：根据 skills.json 创建 symlinks（含 Cursor 软链）
- [ ] `update` 命令：单个 + 全部更新

### Phase 2

- [ ] `remove` 命令
- [ ] `list` 命令（带版本和状态信息）
- [ ] `init` 命令（从已安装 skills 生成 skills.json）
- [ ] Version 约束解析（semver range matching）
- [ ] install.sh 一键安装脚本（自动安装 bun）

### Phase 3

- [ ] `skillp outdated`：检查哪些 skills 有可用更新
- [ ] `skillp doctor`：诊断安装状态（symlinks 是否完整等）
- [ ] Telemetry 安装统计
- [ ] SKILL 搜索（从 registry / index 搜索可用 skills）
