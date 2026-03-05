# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

nanobot is an ultra-lightweight personal AI assistant framework (~4,000 lines of core agent code). It connects LLM providers to chat channels (Telegram, Discord, WhatsApp, etc.) and executes tasks via a tool-based agent loop.

## Development Commands

### Installation & Setup
```bash
# Install from source (development)
pip install -e .

# Install with optional dependencies
pip install -e ".[dev]"          # Development tools
pip install -e ".[matrix]"       # Matrix/Element support

# Initialize config
nanobot onboard
```

### Testing
```bash
# Run all tests
pytest

# Run specific test file
pytest tests/test_loop_save_turn.py

# Run with verbose output
pytest -v

# Run with asyncio debugging
pytest --log-cli-level=DEBUG
```

### Code Quality
```bash
# Lint with ruff
ruff check .

# Format with ruff
ruff format .

# Check specific files
ruff check nanobot/agent/loop.py
```

### Running the Agent
```bash
# CLI mode (interactive)
nanobot agent

# CLI mode (single message)
nanobot agent -m "your message"

# Gateway mode (connects to chat channels)
nanobot gateway

# Check status
nanobot status
```

## Architecture

### Core Components

**Agent Loop** (`nanobot/agent/loop.py`)
- Main processing engine: receives messages → builds context → calls LLM → executes tools → sends responses
- Manages tool registry, session history, memory, and subagents
- Iterates up to `max_iterations` times per message (default: 40)

**Tool System** (`nanobot/agent/tools/`)
- Registry-based: tools register themselves via `ToolRegistry`
- Each tool extends `Tool` base class with `name`, `description`, `parameters`, and `execute()` method
- Built-in tools: shell execution, file operations, web search/fetch, cron scheduling, message sending, subagent spawning
- MCP (Model Context Protocol) support for external tool servers

**Providers** (`nanobot/providers/`)
- Registry-based system (`registry.py`) — single source of truth for LLM provider metadata
- Two provider types:
  - `LiteLLMProvider`: wraps LiteLLM for most providers (OpenRouter, Anthropic, OpenAI, DeepSeek, etc.)
  - `CustomProvider`: direct OpenAI-compatible API calls (bypasses LiteLLM)
  - `OpenAICodexProvider`: OAuth-based provider for OpenAI Codex
- Auto-detection via API key prefix or base URL keywords

**Channels** (`nanobot/channels/`)
- Each channel extends `BaseChannel` with `start()`, `stop()`, and message handling
- Channels convert platform-specific messages to/from `InboundMessage`/`OutboundMessage` events
- Manager (`manager.py`) coordinates multiple channels via `MessageBus`

**Message Bus** (`nanobot/bus/`)
- Event-driven architecture using asyncio queues
- `InboundMessage`: user → agent
- `OutboundMessage`: agent → user
- Decouples channels from agent logic

**Sessions** (`nanobot/session/`)
- Manages conversation history per session (channel + user ID)
- Stores messages with roles: user, assistant, tool_call, tool_result
- Persists to JSON files in workspace

**Memory** (`nanobot/agent/memory.py`)
- Long-term memory store for facts, preferences, and context
- Consolidates session history into persistent memories
- Stored in `workspace/memory/` directory

**Skills** (`nanobot/agent/skills.py`, `nanobot/skills/`)
- Reusable agent capabilities loaded from markdown files
- Skills can include instructions, examples, and tool usage patterns
- Bundled skills: GitHub, weather, tmux, ClawHub, etc.

### Key Patterns

**Adding a New Provider**
1. Add `ProviderSpec` entry to `PROVIDERS` in `nanobot/providers/registry.py`
2. Add field to `ProvidersConfig` in `nanobot/config/schema.py`
3. Done — env vars, model prefixing, config matching work automatically

**Adding a New Tool**
1. Create class extending `Tool` in `nanobot/agent/tools/`
2. Implement `name`, `description`, `parameters`, and `execute()` method
3. Register in `AgentLoop.__init__()` via `self.tools.register(YourTool(...))`

**Adding a New Channel**
1. Create class extending `BaseChannel` in `nanobot/channels/`
2. Implement `start()`, `stop()`, and message handling
3. Add config class to `nanobot/config/schema.py`
4. Register in `ChannelManager` (`nanobot/channels/manager.py`)

## Configuration

Config file: `~/.nanobot/config.json`

Key sections:
- `providers`: API keys and settings for LLM providers
- `agents.defaults`: default model, temperature, max_tokens, etc.
- `channels`: enable/configure chat platforms
- `tools`: MCP servers, workspace restrictions, shell PATH
- `workspace`: location for sessions, memory, skills

## Testing Guidelines

- Tests use pytest with asyncio support (`pytest-asyncio`)
- Mock external dependencies (LLM calls, channel APIs)
- Test files follow `test_*.py` naming convention
- Focus on unit tests for core logic (loop, tools, memory, sessions)
- Integration tests for channels use mocked websockets/HTTP clients

## Important Notes

- **Line count target**: Core agent code (~4,000 lines) is a key feature — avoid bloat
- **Workspace isolation**: When `tools.restrictToWorkspace: true`, all file/shell operations are sandboxed
- **Session persistence**: Sessions auto-save to JSON after each turn
- **Memory consolidation**: Triggered periodically to extract facts from session history
- **MCP compatibility**: Config format matches Claude Desktop / Cursor for easy copy-paste
- **Provider auto-detection**: Detects provider from model name, API key prefix, or base URL
- **Subagents**: Background task execution via `spawn` tool — creates isolated agent instances
