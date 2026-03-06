# nanobot — 任务

> "做什么" — 需求与任务的唯一来源
> 最后更新：2026-03-06

## 约束与非功能需求

> 贯穿所有 Phase 的设计约束，在此统一记录。

- [x] 零侵入：WebUI 作为 Channel，与 Telegram/飞书完全平级，复用 MessageBus + AgentLoop
- [x] 前端构建产物内嵌到 Python 包，无需额外部署
- [x] 仅新增 fastapi + uvicorn 两个后端依赖
- [ ] 首屏加载 < 2s，消息延迟 < 100ms
- [ ] 兼容 Chrome/Firefox/Safari/Edge 最新版
- [ ] 可选 token 认证，可配置访问来源限制
- [ ] Python ≥ 3.11

> **编号规则**：编号一旦分配即不可变（类似 issue number）。即使 Phase 重新排序或插入新 Phase，已有编号保持不变，新任务使用递增编号。

---

## Phase 0: 基础修复

> 目标：修复已知 Bug，推送到 GitHub
> 状态：✅ 已完成

### 完成标准

- [x] 飞书 WebSocket 事件循环修复
- [x] LiteLLM 编码问题修复
- [x] 推送到 GitHub

### 功能需求

| # | 需求 | 优先级 | 状态 | 备注 |
|---|------|--------|------|------|
| 0-F01 | 飞书 WebSocket 事件循环独立化 | P0 | ✅ | 独立事件循环 per thread |
| 0-F02 | LiteLLM Accept-Encoding 修复 | P0 | ✅ | Accept-Encoding: identity |

### Bug / Issue

（无）

---

## Phase 1: WebUI 核心聊天（MVP）

> 目标：为 nanobot 添加开箱即用的浏览器端聊天界面
> 状态：🔵 进行中

### 完成标准

- [x] 后端 Channel 实现（FastAPI + WebSocket）
- [x] 前端 SPA 开发（React + Tailwind 暗色主题）
- [x] 配置集成（WebUIConfig + ChannelManager 注册）
- [x] 前端构建产物嵌入 Python 包
- [ ] 前后端联调测试通过
- [ ] 错误处理与边界情况覆盖
- [ ] 代码提交 & PR

### 功能需求

| # | 需求 | 优先级 | 状态 | 备注 |
|---|------|--------|------|------|
| 1-F01 | 浏览器端实时聊天 | P0 | ✅ | WebSocket 双向通信 |
| 1-F02 | Markdown 渲染（代码高亮、表格、链接） | P0 | ✅ | react-markdown + highlight.js |
| 1-F03 | 流式输出（thinking 状态 + 工具调用提示） | P0 | ✅ | progress / tool_hint 消息类型 |
| 1-F04 | 会话列表侧边栏（新建/切换/删除） | P0 | ✅ | REST API + Sidebar 组件 |
| 1-F05 | 响应式布局（桌面 + 移动端） | P1 | ✅ | Tailwind 响应式 |
| 1-F06 | WebSocket 自动重连 | P1 | ✅ | useWebSocket hook |
| 1-F07 | WebUIChannel 后端实现 | P0 | ✅ | `channels/webui.py`, 347 行 |
| 1-F08 | WebSocket /ws 端点 | P0 | ✅ | 流式输出 + 多客户端 |
| 1-F09 | REST API（sessions, status） | P0 | ✅ | /api/sessions, /api/status |
| 1-F10 | 静态文件服务 + SPA fallback | P0 | ✅ | FastAPI StaticFiles |
| 1-F11 | WebUIConfig + WebUIAuthConfig | P0 | ✅ | config/schema.py |
| 1-F12 | ChannelManager 注册 WebUI | P0 | ✅ | channels/manager.py |
| 1-F13 | pyproject.toml 依赖更新 | P0 | ✅ | +fastapi, +uvicorn |
| 1-F14 | 前端项目搭建 | P0 | ✅ | Vite 6 + React 19 + TS + Tailwind v4 |
| 1-F15 | 前端构建产物输出 | P0 | ✅ | → nanobot/webui/static/ |
| 1-F16 | 启动服务验证 | P0 | ✅ | WebUI 端口可访问，静态文件 + REST API 正常 |
| 1-F17 | WebSocket 联调 | P0 | ✅ | 发送消息 → Agent 回复 → 浏览器显示 |
| 1-F18 | 流式输出验证 | P0 | ⬜ | thinking / tool_hint / 逐步输出 |
| 1-F19 | 多会话切换测试 | P1 | ⬜ | 新建/切换/删除会话正常 |
| 1-F20 | 移动端响应式测试 | P1 | ⬜ | 侧边栏折叠、输入框自适应 |
| 1-F21 | 错误处理 & 边界情况 | P0 | ⬜ | 断连重连、空消息、超长消息 |

### Bug / Issue

| # | 问题 | 状态 | 备注 |
|---|------|------|------|
| 1-B01 | WebSocket 403 被 StaticFiles mount("/") 拦截 | ✅ | StaticFiles 改为 mount("/app")，根路径重定向 |
| 1-B02 | 前端收到 done=true 的消息不渲染 content | ✅ | useWebSocket.ts 消息处理逻辑重写 |

---

## Phase 2: WebUI 增强体验

> 目标：提升 WebUI 使用体验和功能完整度
> 状态：🟢 计划中

### 完成标准

- [ ] 主题切换可用
- [ ] 代码块交互增强
- [ ] 文件上传功能
- [ ] 消息搜索功能

### 功能需求

| # | 需求 | 优先级 | 状态 | 备注 |
|---|------|--------|------|------|
| 2-F01 | 暗色/亮色主题切换 | P1 | ⬜ | |
| 2-F02 | 代码块一键复制 | P1 | ⬜ | |
| 2-F03 | 文件上传（图片/文档） | P2 | ⬜ | |
| 2-F04 | 搜索历史消息 | P2 | ⬜ | |
| 2-F05 | 快捷命令面板 | P2 | ⬜ | |

### Bug / Issue

（暂无）

---

## Phase 3: WebUI 管理面板

> 目标：通过 WebUI 管理 nanobot 配置和运行状态
> 状态：🟢 计划中

### 完成标准

- [ ] Channel 状态可视化
- [ ] 配置在线编辑
- [ ] Skills / Cron 管理界面

### 功能需求

| # | 需求 | 优先级 | 状态 | 备注 |
|---|------|--------|------|------|
| 3-F01 | Channel 状态监控 | P2 | ⬜ | |
| 3-F02 | 配置在线编辑 | P2 | ⬜ | |
| 3-F03 | Skills 管理 | P3 | ⬜ | |
| 3-F04 | Cron 任务管理 | P3 | ⬜ | |

### Bug / Issue

（暂无）

---

## 待办池（Backlog）

> 未分配到具体 Phase 的需求和想法。

| # | 条目 | 类型 | 优先级 | 备注 |
|---|------|------|--------|------|
| BL-01 | JS bundle 代码分割优化（当前 ~545KB） | perf | P2 | react-markdown + highlight.js 体积大 |
| BL-02 | dev-workflow skill 持续完善 | chore | P3 | 根据实际使用反馈迭代 |
