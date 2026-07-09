# Personal AI Agent

A standalone personal AI agent that continuously learns your habits, preferences, and experiences through daily conversations and data imports.

## Overview

This project contains two core modules:

### 1. Marketplace Platform (Next.js Web App)

An AI-enhanced freelance service marketplace MVP. Clients can "audition" freelancers at low cost through Skill AI to evaluate their methods, style, and judgment before submitting real service requests. On the provider side, freelancers can publish their own Skill AI to handle light consultations and convert high-value requests into leads.

**Implemented Features:**
- Skill Marketplace (search, filter, sort)
- Demand Radar (fuzzy demand matching)
- AI Audition Chat (RAG knowledge base)
- Lead CRM (New → Contacted → Proposal → Won/Closed)
- Quotation & Escrow Order Simulation
- Review System
- Client/Provider Personal Centers

### 2. Personal Agent (Standalone Node.js Service)

A personal AI assistant that "remembers you" — continuously learning your habits, preferences, and experiences through daily conversations and data imports.

**Implemented Features:**
- 🧠 **Personal Profile** — Record habits, preferences, and work style
- 📝 **Event Memory** — Auto-extract events, people, and decisions from conversations
- 👥 **Relationship Management** — Auto-identify relationships and interaction history
- 📱 **WeChat Import** — Parse exported chat logs and extract information automatically
- 💬 **CLI / HTTP API** — Two access modes
- 🔄 **Cross-Session Memory** — Auto-load historical profile in new conversations

## Quick Start

### Marketplace Platform

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

Open http://localhost:3000 to view the marketplace.

### Personal Agent

```bash
# Enter agent directory
cd agent

# Install dependencies
npm install

# Copy config template
cp .env.example .env

# Edit .env with your API configuration
# API_KEY=your-api-key
# BASE_URL=https://your-proxy-url/v1
# MODEL=your-model-name

# Start CLI mode (interactive chat)
npx tsx src/index.ts

# Or start HTTP API mode
npx tsx src/index.ts --http --port 3001
```

## Usage Examples

### Personal Agent CLI Mode

```
You: My name is Alex, I wake up at 7am every day and prefer using VS Code

Agent: Hi Alex! I've recorded your habits:
- Wake up at 7:00 AM
- Coding tool: VS Code

You: Had a meeting with Bob today to discuss tech stack for the new project, decided to use Rust

Agent: (Auto-records event + decision + person)
Got it, I've noted that down. Who is Bob? A colleague or friend?

You: Import my WeChat chat log: D:\wechat-export.txt, my nickname is Alex

Agent: Import successful! Extracted 5 events, 3 habits, 2 people...
```

### HTTP API Mode

```bash
# Start the service
npx tsx src/index.ts --http --port 3001

# Send a request
curl -X POST http://localhost:3001/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "What skills are available?"}'
```

## Project Structure

```
codex-Ai-substitute/
├── src/                    # Marketplace source (Next.js)
│   ├── app/               # Page routes
│   ├── components/        # React components
│   └── lib/               # Utilities (store, rag, ai)
├── data/                   # Marketplace data (JSON)
├── agent/                  # Personal AI Agent
│   ├── src/
│   │   ├── agent.ts       # Agent core loop
│   │   ├── tools.ts       # Tool definitions (24 tools)
│   │   ├── profile.ts     # Personal profile system
│   │   ├── events.ts      # Event memory system
│   │   ├── wechat.ts      # WeChat chat log parser
│   │   ├── system.ts      # System prompt
│   │   ├── memory.ts      # Conversation persistence
│   │   ├── cli.ts         # CLI entry point
│   │   ├── http.ts        # HTTP API entry point
│   │   └── lib/           # Shared utilities (store, rag)
│   ├── data/              # Marketplace data (Agent reads)
│   └── memory/            # Personal memory storage (gitignored)
├── package.json
└── README.md
```

## Agent Tools

### Marketplace Tools (18)
| Tool | Description |
|------|-------------|
| `list_skills` | List all available Skills |
| `get_skill` | Get Skill details |
| `create_skill` | Create a new Skill |
| `delete_skill` | Delete a Skill |
| `chat_with_skill` | Chat with a Skill AI |
| `rate_skill` | Rate a Skill |
| `list_leads` | List all leads |
| `get_lead` | Get lead details |
| `create_lead` | Create a new lead |
| `update_lead` | Update lead status |
| `list_quotes` | List all quotes |
| `create_quote` | Create a quote |
| `accept_quote` | Accept a quote |
| `list_orders` | List all orders |
| `create_order` | Create an order |
| `update_order` | Update order status |
| `list_reviews` | List reviews |
| `create_review` | Create a review |

### Personal Agent Tools (8)
| Tool | Description |
|------|-------------|
| `feed_habit` | Feed a personal habit |
| `feed_preference` | Feed a preference setting |
| `feed_document` | Feed a document (resume/diary) |
| `get_profile` | View personal profile |
| `add_event` | Record an event |
| `add_decision` | Record a decision |
| `search_events` | Search event memory |
| `import_wechat` | Import WeChat chat logs |

## Tech Stack

### Marketplace Platform
- **Frontend/Backend**: Next.js 16 (App Router)
- **UI**: React + Tailwind CSS
- **Storage**: Local JSON files
- **AI**: Adapter layer with mock/real model switching

### Personal Agent
- **Runtime**: Node.js + TypeScript
- **AI SDK**: OpenAI-compatible format
- **Execution**: tsx (run TS directly)
- **Storage**: Local JSON files

## Environment Variables

Create `agent/.env` file:

```env
# API Configuration (OpenAI-compatible format)
API_KEY=your-api-key-here
BASE_URL=https://your-proxy-url/v1
MODEL=your-model-name

# Data directories
DATA_DIR=../data
MEMORY_DIR=./memory
```

## WeChat Chat Import

1. Open chat window in WeChat PC
2. Select chat messages → Copy
3. Paste to Agent, or save as `.txt` file and tell Agent the file path

Supported formats:
- WeChat PC export format
- Timestamp format `[2024-01-15 14:30:20] Username: Message`
- Simple format `2024-01-15 14:30 Username: Message`

## Contact

For questions, contact: 2012943494@qq.com or lk2012943494@outlook.com
