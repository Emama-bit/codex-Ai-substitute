# Personal Memory MCP Server

> Give your AI a persistent memory — an MCP-based personal memory engine that remembers you across conversations.

## What is this

Personal Memory is an [MCP](https://modelcontextprotocol.io/) (Model Context Protocol) Server that gives Claude, Cursor, and other AI hosts **persistent personal memory**.

Once installed, your AI remembers your habits, preferences, experiences, and relationships — no more starting from scratch every conversation.

## Features

| Tool | Description |
|------|-------------|
| `add_memory` | Record events, decisions, insights (auto-deduplicated) |
| `search_memories` | Full-text search across all memories (FTS5) |
| `get_memory_summary` | Get a complete personal profile overview |
| `get_daily_briefing` | Daily briefing: yesterday's memories + follow-ups + habit alerts |
| `get_follow_ups` | Pending plans, unactioned decisions, lost contacts |
| `check_habit_patterns` | Detect habit anomalies (e.g., no exercise for 3 days) |
| `upsert_person` | Record / update a person and their relationship |
| `feed_habit` | Record a user habit |
| `feed_preference` | Record a user preference |
| `import_wechat` | Import WeChat chat logs, auto-extract events |
| `import_browser_history` | Read Chrome/Edge history, extract interests |
| `archive_old_memories` | Archive old low-importance memories |

## Quick Start

### Option 1: One-line install (recommended)

**Windows (PowerShell):**
```powershell
irm https://raw.githubusercontent.com/Emama-bit/personal-memory-mcp/master/install.ps1 | iex
```

**macOS / Linux:**
```bash
curl -fsSL https://raw.githubusercontent.com/Emama-bit/personal-memory-mcp/master/install.sh | bash
```

### Option 2: Manual install

**Windows (PowerShell):**
```powershell
irm https://raw.githubusercontent.com/Emama-bit/personal-memory-mcp/master/install.ps1 | iex
```

**macOS / Linux:**
```bash
curl -fsSL https://raw.githubusercontent.com/Emama-bit/personal-memory-mcp/master/install.sh | bash
```

Restart Claude Desktop / Cursor after installation.

### Option 2: Manual install

```bash
git clone https://github.com/Emama-bit/personal-memory-mcp.git
cd personal-memory-mcp/agent
npm install
```

Then configure your AI host:

**Claude Desktop** — Settings → Developer → Edit Config:

```json
{
  "mcpServers": {
    "personal-memory": {
      "command": "npx",
      "args": ["tsx", "/path/to/personal-memory-mcp/agent/src/server.ts"]
    }
  }
}
```

**Cursor** — Create `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "personal-memory": {
      "command": "npx",
      "args": ["tsx", "/path/to/personal-memory-mcp/agent/src/server.ts"]
    }
  }
}
```

Restart your AI host after configuring.

## Usage Example

```
You: My name is Alex, I wake up at 7am every day and prefer VS Code
AI:  [Silently calls feed_habit + feed_preference]

You: Do you remember me?
AI:  Of course! You're Alex, up at 7am, coding in VS Code...

You: Search my memories about Rust
AI:  You decided to use Rust for your new project because...
```

## Architecture

```
Claude / Cursor / Any MCP Host
        │ MCP Protocol (stdio)
        ▼
  Personal Memory Server
  ├── Memory Engine (SQLite + FTS5)
  ├── People / Relationship Tracking
  ├── Personal Profile (habits, preferences)
  ├── Proactive Intelligence (daily briefing, follow-ups)
  └── Data Imports (WeChat, browser history)
```

- **Storage**: SQLite with WAL mode, atomic writes
- **Search**: FTS5 full-text index, supports Chinese & English
- **Dedup**: Auto-detect similar memories before writing
- **Tiered**: 7-day / 30-day / archived layers, system prompt stays compact
- **Privacy**: All data stored locally, never uploaded

## Project Structure

```
agent/
├── src/
│   ├── server.ts            ← MCP Server entry (18 tools)
│   ├── memory/
│   │   ├── db.ts            ← SQLite init + FTS5
│   │   ├── memories.ts      ← Memory CRUD + search + dedup
│   │   ├── people.ts        ← People / relationship management
│   │   └── conversations.ts ← Conversation persistence
│   ├── profile.ts           ← User profile (habits, preferences)
│   ├── system.ts            ← Tiered system prompt generation
│   ├── wechat.ts            ← WeChat chat log parser
│   └── browser.ts           ← Chrome/Edge history reader
├── memory/agent.db          ← Local SQLite database (gitignored)
└── package.json
```

## License

MIT
