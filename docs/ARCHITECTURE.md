# nanobot — 架构

> "怎么做" — 技术方案与设计参考
> 最后更新：2026-03-06

## 概述

nanobot 是一个轻量级个人 AI 助手框架。通过多种 IM 渠道（Telegram、飞书、Discord、Slack、WebUI 等）接收用户消息，经由统一的消息总线分发给 Agent 处理，Agent 调用 LLM 和工具完成任务后将回复路由回对应渠道。面向个人开发者和小团队。

## 目录结构

```
nanobot/
├── agent/                  # 🧠 Agent 核心
│   ├── loop.py             # AgentLoop — 主循环，调用 LLM + 工具
│   ├── context.py          # 会话上下文管理
│   ├── memory.py           # 记忆系统（MEMORY.md + HISTORY.md）
│   ├── skills.py           # SkillsLoader — 加载 skill 到 system prompt
│   ├── subagent.py         # 子 agent 派生（spawn）
│   └── tools/              # 内置工具集
│       ├── base.py         # BaseTool 抽象基类
│       ├── registry.py     # 工具注册表
│       ├── filesystem.py   # 文件读写工具
│       ├── shell.py        # Shell 命令执行
│       ├── web.py          # Web 搜索 / 抓取
│       ├── message.py      # 发送消息工具
│       ├── spawn.py        # 子 agent 工具
│       ├── cron.py         # 定时任务工具
│       └── mcp.py          # MCP 协议工具
├── bus/                    # 📨 消息总线
│   ├── events.py           # InboundMessage / OutboundMessage 事件定义
│   └── queue.py            # MessageBus — 异步消息队列
├── channels/               # 📡 渠道层（IM 接入）
│   ├── base.py             # BaseChannel 抽象基类
│   ├── manager.py          # ChannelManager — 注册 & 管理所有渠道
│   ├── telegram.py         # Telegram Bot
│   ├── feishu.py           # 飞书
│   ├── discord.py          # Discord
│   ├── slack.py            # Slack
│   ├── dingtalk.py         # 钉钉
│   ├── qq.py               # QQ
│   ├── email.py            # Email
│   ├── matrix.py           # Matrix
│   ├── whatsapp.py         # WhatsApp
│   ├── mochat.py           # MoChat（CLI）
│   └── webui.py            # WebUI（浏览器聊天）
├── config/                 # ⚙️ 配置
│   ├── schema.py           # Pydantic 配置模型（所有 Config 类定义）
│   └── loader.py           # 配置文件加载
├── providers/              # 🤖 LLM Provider
│   ├── base.py             # BaseProvider 抽象基类
│   ├── registry.py         # Provider 注册表
│   ├── litellm_provider.py # LiteLLM（主要 provider，支持多家 LLM）
│   ├── openai_codex_provider.py # OpenAI Codex
│   ├── custom_provider.py  # 自定义 provider
│   └── transcription.py    # 语音转文字
├── session/                # 💬 会话管理
│   └── manager.py          # SessionManager — 会话生命周期
├── cron/                   # ⏰ 定时任务
│   ├── service.py          # CronService — 调度器
│   └── types.py            # 任务类型定义
├── heartbeat/              # 💓 心跳服务
│   └── service.py          # 周期性任务执行
├── skills/                 # 🎯 内置 Skills
│   ├── memory/             # 记忆管理
│   ├── cron/               # 定时任务
│   ├── github/             # GitHub CLI
│   ├── tmux/               # tmux 控制
│   ├── weather/            # 天气查询
│   ├── summarize/          # 内容摘要
│   ├── clawhub/            # Skill 市场
│   └── skill-creator/      # Skill 创建指南
├── webui/                  # 🌐 WebUI 前端静态资源
│   └── static/             # 构建产物（index.html, JS, CSS）
├── templates/              # 📄 模板文件
├── utils/                  # 🔧 工具函数
│   └── helpers.py          # 通用辅助函数
├── cli/                    # 🖥️ CLI 入口
│   └── commands.py         # typer CLI 命令
└── __main__.py             # python -m nanobot 入口

webui-frontend/             # 🎨 WebUI 前端源码（独立于 Python 包）
├── src/
│   ├── App.tsx             # 主布局（Sidebar + ChatView）
│   ├── hooks/
│   │   └── useWebSocket.ts # WebSocket 连接管理
│   └── components/
│       ├── Sidebar.tsx     # 会话列表
│       ├── ChatView.tsx    # 消息列表 + 欢迎页
│       ├── MessageBubble.tsx # Markdown 渲染 + 代码高亮
│       └── InputBar.tsx    # 自适应输入框
├── package.json            # React 19 + Vite 6 + Tailwind v4
└── vite.config.ts          # 构建配置，产物输出到 nanobot/webui/static/

docs/                       # 📚 项目文档（三支柱）
├── TASKS.md                # "做什么" — 需求与任务
├── ARCHITECTURE.md         # "怎么做" — 本文件
└── DEVLOG.md               # "做了什么" — 开发日志

tests/                      # 🧪 测试套件
├── test_commands.py
├── test_cron_service.py
├── test_email_channel.py
├── test_heartbeat_service.py
├── test_matrix_channel.py
├── test_tool_validation.py
└── ...（16 个测试文件）
```

## 核心数据流

```
用户（IM / 浏览器 / CLI）
       │
       ▼
┌─────────────┐     InboundMessage     ┌─────────────┐
│   Channel   │ ──────────────────────▶│  MessageBus  │
│ (telegram,  │                        │   (queue)    │
│  feishu,    │◀──────────────────────│              │
│  webui...)  │     OutboundMessage    └──────┬──────┘
└─────────────┘                               │
                                              ▼
                                       ┌─────────────┐
                                       │  AgentLoop   │
                                       │              │
                                       │  ┌────────┐  │
                                       │  │Provider │  │  LLM API
                                       │  │(LiteLLM)│──────────▶
                                       │  └────────┘  │
                                       │  ┌────────┐  │
                                       │  │ Tools  │  │  file/shell/web/...
                                       │  └────────┘  │
                                       │  ┌────────┐  │
                                       │  │ Skills │  │  system prompt 注入
                                       │  └────────┘  │
                                       │  ┌────────┐  │
                                       │  │Context │  │  会话历史
                                       │  └────────┘  │
                                       └─────────────┘
```

## 核心模块

### MessageBus（`bus/`）

- **职责**：异步消息队列，解耦 Channel 和 Agent
- **关键文件**：`events.py`（InboundMessage / OutboundMessage 定义）、`queue.py`（MessageBus 实现）
- **依赖**：asyncio
- **公开接口**：
  - `InboundMessage`：用户发来的消息（sender_id, chat_id, content, channel）
  - `OutboundMessage`：Agent 的回复（chat_id, content, channel）
  - Channel 和 Agent 通过 put/get 操作队列，互不直接依赖

### Channel（`channels/`）

- **职责**：IM 渠道接入层，将各平台消息统一为 InboundMessage / OutboundMessage
- **关键文件**：`base.py`（BaseChannel 抽象基类）、`manager.py`（ChannelManager）、各平台实现
- **依赖**：各平台 SDK + MessageBus
- **公开接口**：
  - `BaseChannel.start()` / `stop()`：启动/停止渠道服务
  - `BaseChannel.send(message)`：发送 OutboundMessage 到用户
  - `BaseChannel._handle_message()`：将收到的用户消息推入 MessageBus
  - `ChannelManager`：统一管理所有 Channel 的生命周期

### AgentLoop（`agent/loop.py`）

- **职责**：核心处理循环，协调 LLM、工具、上下文
- **关键文件**：`loop.py`
- **依赖**：Provider、Tools、Skills、Context、SessionManager、MessageBus
- **处理流程**：
  1. 从 MessageBus 取出 InboundMessage
  2. 加载会话上下文（SessionManager）
  3. 注入 Skills 到 system prompt
  4. 调用 LLM Provider 生成回复
  5. 如果 LLM 请求工具调用 → 执行工具 → 将结果反馈给 LLM → 循环
  6. 将最终回复作为 OutboundMessage 推入 MessageBus

### Skills（`skills/` + `~/.nanobot/workspace/skills/`）

- **职责**：模块化知识包，通过 SKILL.md 注入到 system prompt
- **关键文件**：`agent/skills.py`（SkillsLoader）
- **依赖**：文件系统
- **加载优先级**：用户 skills（`~/.nanobot/workspace/skills/`）> 内置 skills（`nanobot/skills/`）
- **内置 skills**：memory、cron、github、tmux、weather、summarize、clawhub、skill-creator

### Providers（`providers/`）

- **职责**：LLM 调用抽象层
- **关键文件**：`base.py`（BaseProvider）、`registry.py`（注册表）、`litellm_provider.py`（主实现）
- **依赖**：litellm、各 LLM API
- **公开接口**：LiteLLM Provider 为主要实现，支持 OpenAI / Anthropic / Google 等多家 API，通过配置切换模型

### Config（`config/`）

- **职责**：配置管理，Pydantic 模型定义 + 文件加载
- **关键文件**：`schema.py`（所有 Config 类）、`loader.py`（加载逻辑）
- **公开接口**：`Config` 根类，包含 `AgentsConfig`、`ChannelsConfig`、`ProvidersConfig`、`ToolsConfig` 等

## 配置

主配置文件：`~/.nanobot/config.json`

```jsonc
{
  "model": "anthropic/claude-opus-4-6",    // 默认 LLM 模型
  "reasoningEffort": "high",                // 推理强度（low/medium/high）
  "channels": {
    "telegram": { "enabled": true, "token": "..." },
    "feishu": { "enabled": true, ... },
    "webui": { "enabled": true, "port": 3000 }
  },
  "tools": { ... },                          // 工具配置
  "workspace": "~/.nanobot/workspace"        // 工作目录
}
```

## 外部依赖

| 依赖 | 用途 | 版本约束 |
|------|------|----------|
| litellm | LLM 统一调用层 | >=1.81.5,<2.0.0 |
| pydantic | 配置模型 | >=2.12.0,<3.0.0 |
| typer | CLI 框架 | >=0.20.0,<1.0.0 |
| fastapi | WebUI 后端 | >=0.115.0,<1.0.0 |
| uvicorn | ASGI 服务器 | >=0.34.0,<1.0.0 |
| httpx | HTTP 客户端 | >=0.28.0,<1.0.0 |
| loguru | 日志 | >=0.7.3,<1.0.0 |
| croniter | Cron 表达式解析 | >=6.0.0,<7.0.0 |
| python-telegram-bot | Telegram SDK | >=22.0,<23.0 |
| lark-oapi | 飞书 SDK | >=1.5.0,<2.0.0 |
| dingtalk-stream | 钉钉 SDK | >=0.24.0,<1.0.0 |
| slack-sdk | Slack SDK | >=3.39.0,<4.0.0 |
| qq-botpy | QQ SDK | >=1.2.0,<2.0.0 |
| mcp | MCP 协议 | >=1.26.0,<2.0.0 |

## 扩展点

| 扩展方式 | 位置 | 说明 |
|----------|------|------|
| 新增 Channel | `channels/` + `manager.py` | 继承 BaseChannel，在 manager 注册 |
| 新增 Tool | `agent/tools/` + `registry.py` | 继承 BaseTool，在 registry 注册 |
| 新增 Skill | `~/.nanobot/workspace/skills/<name>/SKILL.md` | 放入目录即自动加载 |
| 新增 Provider | `providers/` + `registry.py` | 继承 BaseProvider |
| MCP 工具 | 配置 `mcp_servers` | 通过 MCP 协议接入外部工具 |

## 测试策略

| 层级 | 工具 | 范围 | 命令 |
|------|------|------|------|
| 单元测试 | pytest | 核心逻辑（16 个测试文件） | `pytest tests/` |
| 代码检查 | ruff | 代码规范 | `ruff check .` |
| 前端构建 | vite | 前端产物验证 | `cd webui-frontend && npm run build` |

---

## Feature: WebUI Channel

### 设计原则

- **零侵入**：WebUI 作为新 Channel，与 Telegram/飞书完全平级，复用 MessageBus + AgentLoop
- **前后端分离**：FastAPI 后端内嵌于 Channel，React SPA 构建产物嵌入 Python 包
- **轻量依赖**：仅新增 fastapi + uvicorn

### 架构

```
浏览器（React SPA）
  │  useWebSocket hook
  │  (WebSocket + REST)
  ▼
FastAPI（内嵌于 WebUIChannel）
  ├── WS /ws           — 实时聊天
  ├── REST /api/*      — 会话管理
  └── Static /         — 前端静态资源
  │
  ▼
WebUIChannel（BaseChannel）
  _handle_message() → MessageBus.inbound
  send()           ← MessageBus.outbound
```

### 后端（`channels/webui.py`，347 行）

| 组件 | 职责 |
|------|------|
| `WebUIChannel` | 继承 BaseChannel，内嵌 FastAPI + uvicorn |
| `_connections` | `dict[str, WebSocket]` — ws_id → WebSocket |
| `_session_subs` | `dict[str, set[str]]` — session_id → {ws_id, ...} |
| `_ws_session` | `dict[str, str]` — ws_id → session_id |

API 端点：

| 端点 | 方法 | 功能 |
|------|------|------|
| `/ws` | WebSocket | 实时聊天通信 |
| `/api/sessions` | GET | 列出所有 webui 会话 |
| `/api/sessions/{id}` | GET / DELETE | 会话详情 / 删除 |
| `/api/status` | GET | 服务状态 |
| `/app/` | Static | 前端 SPA（fallback 到 index.html） |
| `/` | GET | 重定向到 `/app/` |

### 前端（`webui-frontend/`）

技术栈：React 19 + TypeScript + Vite 6 + Tailwind CSS v4

| 文件 | 职责 |
|------|------|
| `App.tsx` | 主布局（Sidebar + ChatView） |
| `hooks/useWebSocket.ts` | WebSocket 连接管理（自动重连、流式拼接、tool_hint） |
| `components/Sidebar.tsx` | 会话列表 + 新建/删除 |
| `components/ChatView.tsx` | 消息列表 + 欢迎页 |
| `components/MessageBubble.tsx` | Markdown 渲染（react-markdown + remark-gfm + rehype-highlight） |
| `components/InputBar.tsx` | 自适应输入框 |

UI 设计：暗色主题（#0f0f0f ~ #1a1a2e），蓝紫渐变强调色（#667eea → #764ba2），ChatGPT/Claude 风格界面，🐈 品牌标识。

构建产物输出到 `nanobot/webui/static/`（index.html + JS ~545KB + CSS ~25.6KB），由 FastAPI StaticFiles 在 `/app/` 路径提供服务。

### WebSocket 协议

```jsonc
// 客户端 → 服务端
{ "type": "message", "content": "...", "session_id": "abc123" }

// 服务端 → 客户端
{ "type": "message", "content": "...", "done": false, "session_id": "abc123" }  // 流式
{ "type": "message", "content": "...", "done": true, "session_id": "abc123" }   // 完成
{ "type": "progress", "content": "正在思考...", "session_id": "abc123" }
{ "type": "tool_hint", "content": "web_search(...)", "session_id": "abc123" }
```

### 配置（`config/schema.py`）

```python
class WebUIAuthConfig(Base):
    enabled: bool = False
    token: str = ""                    # Bearer token

class WebUIConfig(Base):
    enabled: bool = False
    host: str = "0.0.0.0"
    port: int = 3000
    allow_from: list[str] = ["*"]     # 允许的来源
    auth: WebUIAuthConfig = ...
    workspace: str = "~/.nanobot/workspace"
```
