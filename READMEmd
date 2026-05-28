# StructuraNet App

**AI-powered Natural Language to GNS3 Topology Generator.** Describe your network in plain English and get a fully-configured, import-ready `.gns3project` file.

---

## Architecture

StructuraNet uses a **three-service architecture** with clear separation of concerns: a React frontend for the UI, an Express.js backend for auth/sessions/SSE orchestration, and a Python AI engine for heavy computation (topology generation, config generation, GNS3 export).

```
┌──────────────────────┐     HTTP/SSE      ┌──────────────────────┐   child_process    ┌──────────────────────┐
│   React + Vite       │ ←───────────────→  │   Express.js         │ ──────────────────→ │   Python AI Engine   │
│   :5173              │     /api/*         │   :3000              │  python wrapper.py  │   (no HTTP server)   │
│                      │                    │                      │                     │                      │
│  - Chat UI           │                    │  - JWT Auth          │                     │  - Phase 1: Topology │
│  - SSE streaming     │                    │  - Chat persistence  │                     │  - Phase 2: Configs  │
│  - Topology viewer   │                    │  - SSE Manager       │                     │  - GNS3 export       │
│  - Auth pages        │                    │  - LLM orchestrator  │                     │  - Validation        │
│                      │                    │  - File downloads    │                     │  - Cisco QA          │
└──────────────────────┘                    └──────┬───────────────┘                     └──────────────────────┘
                                                   │
                                            ┌──────▼───────┐
                                            │   MongoDB     │
                                            │  (or in-mem)  │
                                            └──────────────┘
```

### Key Architectural Decisions

| Decision | Rationale |
|----------|-----------|
| **No FastAPI server** | Express handles all REST/SSE endpoints natively. The old dead FastAPI proxy has been removed. Python is invoked only as a CLI child process. |
| **LLM is the orchestrator** | No Finite State Machine. The LLM receives tool definitions and autonomously decides which tools to call, handling compound intents naturally. |
| **Node.js ↔ Python via child_process** | Express spawns `python wrapper.py <command>` for heavy computation. JSON over stdout/stderr. Non-blocking — Node.js stays responsive. |
| **Deterministic hardware, not LLM hardware** | The LLM outputs only node IDs and connections. Port numbers, slot modules, and hardware details are computed by Python. |
| **Three-Gate Safe Merge** | Phase 2 LLM configs are merged through whitelist/no-overwrite/type gates, making it structurally impossible for the LLM to corrupt hardware properties. |
| **MongoDB with in-memory fallback** | App remains functional for development without MongoDB. Session data falls back to an in-memory Map. |
| **SSE over WebSocket** | Simpler, HTTP-compatible, works through proxies. EventSource auto-reconnects. JWT token passed as query param. |
| **Input validation middleware** | All Express routes validate request bodies (required fields, types, minLength) before handlers run. |

---

## Directory Structure

```
structuranet_app/
├── ai-engine/                  # Python AI pipeline (no HTTP server)
│   ├── wrapper.py              # CLI bridge — Node.js spawns this via child_process
│   ├── chat_cli.py             # Standalone conversational REPL (offline use)
│   ├── requirements.txt
│   ├── structranet/            # Main Python package (v4.0.0)
│   │   ├── ai/
│   │   │   ├── agent.py                # Phase 1: LLM topology generation + auto-repair
│   │   │   ├── chat_orchestrator.py    # Python LLM tool-calling orchestrator (standalone use)
│   │   │   ├── config_agent.py         # Phase 2: Software config generation + safe-merge
│   │   │   ├── context_builder.py      # Builds Configuration Brief from topology
│   │   │   ├── llm_utils.py            # OpenAI client singleton, retry, JSON extraction
│   │   │   ├── qa_handler.py           # Cisco IOS QA with knowledge base
│   │   │   └── security_prompts.py     # Per-profile security prompt injection
│   │   ├── catalog/
│   │   │   ├── appliance_catalog.py    # Loads 40+ device catalog with user overlay
│   │   │   ├── hw_config.py            # Injects hardware (slots, adapters, ports)
│   │   │   └── port_assigner.py        # Deterministic port number assignment
│   │   ├── constants/
│   │   │   ├── hardware.py             # SSOT: all hardware constants
│   │   │   ├── gns3.py                 # Node types, symbols, port names
│   │   │   ├── schema.py               # Pydantic v2 models (GNS3Project, TopologyRequest)
│   │   │   ├── appliances.py           # Static catalog data (40+ devices)
│   │   │   ├── agent_schemas.py        # AgentSessionData, AgentResponse, TOOL_DEFINITIONS
│   │   │   ├── ai.py                   # LLM link limits, retry config
│   │   │   ├── phase2.py               # Phase 2 whitelist keys + type constraints
│   │   │   └── validation.py           # Backward-compat re-exports
│   │   ├── export/
│   │   │   ├── gns3_exporter.py        # Converts topology → .gns3project ZIP
│   │   │   └── validator.py            # 11-check structural validator
│   │   ├── generation/
│   │   │   ├── preflight.py            # Environment profile + inventory filtering
│   │   │   └── topology_finalizer.py   # VLAN trunk/access port patcher
│   │   └── knowledge/
│   │       └── cisco_knowledge_base.txt
│   └── tests/
│       └── test_golden_export.py
│
├── backend/                    # Express.js backend
│   ├── index.js                # Express server — all routes, SSE, auth, sessions
│   ├── package.json
│   ├── models/
│   │   ├── User.js             # Mongoose: user + gns3Profile (images Map)
│   │   ├── chat.js             # Mongoose: messages with images, sessionId
│   │   └── userChat.js         # Mongoose: chat list per user
│   ├── services/
│   │   ├── ai-engine.js        # Python bridge: spawn wrapper.py commands
│   │   └── chat-orchestrator.js # LLM tool-calling orchestrator (Node.js)
│   ├── tests/
│   │   └── bridge.test.js      # Integration tests for Python-Node.js bridge
│   └── tools/
│       ├── agent-schemas.js    # AgentSessionData, AgentResponse classes
│       └── definitions.js      # 4 OpenAI tool definitions
│
└── client/                     # React + Vite frontend
    ├── index.html
    ├── package.json
    ├── vite.config.js          # Proxy /api → localhost:3000
    └── src/
        ├── main.jsx            # React root with ErrorBoundary
        ├── App.jsx             # Auth-gated router (Landing → Login → Chat)
        ├── context/
        │   └── AuthContext.jsx  # JWT auth state (localStorage)
        ├── hooks/
        │   └── useSSE.js       # SSE streaming hook (11 events + auto-reconnect)
        ├── lib/
        │   └── api.js          # All API calls + SSE subscription
        ├── pages/
        │   ├── ChatPage.jsx    # Main chat UI (Claude-like experience)
        │   ├── LandingPage.jsx
        │   ├── LoginPage.jsx
        │   └── RegisterPage.jsx
        └── components/
            ├── ErrorBoundary.jsx
            ├── GenerationProgress.jsx
            ├── Icons.jsx
            ├── MiniTopologyPreview.jsx
            ├── NetworkLoader.jsx
            ├── ProfileDrawer.jsx
            ├── ProfileModal.jsx
            ├── RequirementsPanel.jsx
            ├── SummaryPanel.jsx
            ├── ThoughtStream.jsx
            └── TopologyViewer.jsx
```

---

## Data Flow

### End-to-End: From Prompt to Download

```
User: "Design a 3-branch enterprise network"
  │
  ▼  ChatPage.jsx → POST /api/chat { session_id, message }
  │
  ▼  Express index.js:
      1. JWT auth check (requireAuth middleware)
      2. Input validation (validateBody middleware)
      3. Load/create AgentSessionData from MongoDB (SessionStore)
      4. Call chat-orchestrator.dispatch(message, session, SSEManager)
  │
  ▼  chat-orchestrator.js:
      1. Append user message to conversation history
      2. Build context-aware system prompt (topology state, edit count)
      3. Call LLM with messages + 4 tool definitions (tool_choice: "auto")
      4. LLM decides → calls generate_new_topology(requirements="...")
  │
  ▼  _toolGenerateNewTopology():
      1. SSE broadcast: phase_change → generating
      2. Spawn: python wrapper.py generate --request "3-branch enterprise..."
         (ai-engine.js → child_process.spawn → non-blocking)
      3. Python runs Phase 1:
         LLM call → auto-repair → port assignment → hardware injection
         → VLAN patching → validation
      4. Python prints JSON to stdout → Node.js parses it
      5. SSE broadcast: topology_ready, requirements_ready, summary_ready
      6. SSE broadcast: phase_change → review
  │
  ▼  Back in orchestrator loop:
      LLM sees tool result → responds with text describing topology
  │
  ▼  User clicks "Approve & Export" with enterprise security
      ChatPage → POST /api/chat { message: "approve with enterprise security" }
  │
  ▼  LLM decides → calls apply_security_and_export(security_profile="enterprise")
  │
  ▼  _toolApplySecurityAndExport():
      1. Spawn: python wrapper.py export --topology ... --security-profile enterprise
      2. Python runs Phase 2:
         config brief → LLM configs → safe-merge (3-gate)
         → GNS3 export → 11-check validation
      3. SSE broadcast: config_text (streamed in 80-char chunks per device)
      4. SSE broadcast: complete { download_url, validator_passed, ... }
  │
  ▼  User clicks download → GET /api/ai/sessions/:id/download → .gns3project file
```

---

## Quick Start

### Prerequisites

- **Node.js** 18+ and npm
- **Python** 3.11+ (uses `match` syntax, `type X = Y` annotations)
- **MongoDB** (optional — the app falls back to in-memory storage for development)
- An **OpenAI-compatible API key** (OpenRouter, OpenAI, etc.)

### 1. Python AI Engine

```bash
cd ai-engine
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

Create a `.env` file in `ai-engine/`:
```env
ROUTER_API_KEY=your-openrouter-or-openai-key
ROUTER_BASE_URL=https://openrouter.ai/api/v1   # optional, default: OpenAI
AI_MODEL=openrouter/owl-alpha                   # any OpenAI-compatible model
AI_MAX_TOKENS=16384                             # optional
```

> **Note:** The Python AI engine does **not** run a server. It is invoked by the Node.js backend via `child_process.spawn("python", ["wrapper.py", ...])`. You do not need to start `uvicorn` or any Python HTTP server.

### 2. Express.js Backend

```bash
cd backend
npm install
```

Create a `.env` file in `backend/`:
```env
JWT_SECRET=<generate with: openssl rand -hex 32>
MONGO=mongodb://localhost:27017/structuranet    # optional
PORT=3000                                        # optional
CORS_ORIGIN=https://your-frontend-domain.com     # optional (dev: allow all)
ROUTER_API_KEY=your-openrouter-or-openai-key     # for Node.js LLM calls
ROUTER_BASE_URL=https://openrouter.ai/api/v1     # optional
AI_MODEL=openrouter/owl-alpha                    # optional
OUTPUT_DIR=/tmp/structuranet                     # optional
STRUCTRANET_WRAPPER_PATH=../ai-engine/wrapper.py # optional
STRUCTRANET_PYTHON=python                        # optional
```

> **Important:** `JWT_SECRET` is **required**. The server will start without it but all auth endpoints will return 500 errors.

Start the server:
```bash
npm start
```

### 3. React + Vite Client

```bash
cd client
npm install
npm run dev
```

The client runs on `http://localhost:5173` and proxies all `/api/*` requests to Express on port 3000 (configured in `vite.config.js`).

---

## API Reference

### Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/signup` | Create account (username, email, password) |
| POST | `/api/auth/signin` | Login (email, password) → returns JWT |
| POST | `/api/auth/demo` | Demo login (no credentials needed) |

### Chat (LLM Tool-Calling)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/chat` | Main chat endpoint — dispatches to LLM orchestrator |
| GET | `/api/ai/sessions/:id/events` | SSE stream for real-time events |

The `POST /api/chat` endpoint is the core interaction point. It accepts `{ session_id?, message }` and returns `{ session_id, message, tool_calls_made }`. Real-time progress is streamed via SSE events on the sessions events endpoint.

### Session Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/ai/sessions` | Create new session |
| GET | `/api/ai/sessions/:id` | Get session info |
| GET | `/api/ai/sessions/:id/download` | Download .gns3project file |
| GET | `/api/ai/sessions/:id/download/requirements` | Download requirements manifest |
| GET | `/api/ai/health` | Health check |

### Chat History

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/chats` | Create chat |
| GET | `/api/userchats` | List user's chats |
| GET | `/api/chats/:id` | Get chat messages |
| POST | `/api/chats/:id/messages` | Add messages |
| DELETE | `/api/chats/:id` | Delete chat |
| PUT | `/api/chats/:id/session` | Link chat to AI session |

### Profile

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/profile` | Get GNS3 environment profile |
| PUT | `/api/profile` | Update profile (version, features, images, security_profile) |

---

## Environment Variables

### Python AI Engine (`ai-engine/.env`)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `ROUTER_API_KEY` | **Yes** | — | OpenAI/OpenRouter API key for LLM calls |
| `ROUTER_BASE_URL` | No | OpenAI | API base URL |
| `AI_MODEL` | No | `openrouter/owl-alpha` | LLM model identifier |
| `AI_MAX_TOKENS` | No | `16384` | Max tokens per LLM call |
| `LLM_CALL_TIMEOUT` | No | `120` | Per-call timeout in seconds |
| `STRUCTRANET_OUTPUT_DIR` | No | `output` | CLI pipeline output path |
| `QA_KNOWLEDGE_BASE_PATH` | No | built-in | Path to Cisco knowledge base file |

### Express Backend (`backend/.env`)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `JWT_SECRET` | **Yes** | — | Secret for JWT token signing (no fallback) |
| `MONGO` | No | — | MongoDB connection string (falls back to in-memory) |
| `PORT` | No | `3000` | Express server port |
| `CORS_ORIGIN` | No | allow all | Comma-separated allowed origins (production) |
| `ROUTER_API_KEY` | No | — | API key for Node.js LLM orchestrator |
| `ROUTER_BASE_URL` | No | — | API base URL for Node.js LLM calls |
| `AI_MODEL` | No | `openai/gpt-oss-120b:free` | LLM model for orchestrator |
| `AI_MAX_TOKENS` | No | `4096` | Max tokens per Node.js LLM call |
| `OUTPUT_DIR` | No | `/tmp/structuranet` | Output directory for generated files |
| `STRUCTRANET_WRAPPER_PATH` | No | `../../ai-engine/wrapper.py` | Path to Python wrapper |
| `STRUCTRANET_PYTHON` | No | `python` | Python binary name |

### React Client

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `VITE_API_URL` | No | — | Legacy — actual proxy goes through Vite to Express |

---

## Python-Node.js Bridge

The Node.js backend communicates with the Python AI engine through a **child_process bridge**, not HTTP:

```
Express (chat-orchestrator.js)
  │
  │  Tool handler needs heavy computation
  │
  ▼
ai-engine.js: spawn("python", ["wrapper.py", "generate", "--request", "..."])
  │
  ▼
wrapper.py: Runs Phase 1/2 pipeline, prints JSON to stdout
  │
  ▼
ai-engine.js: Parses JSON from stdout, returns to orchestrator
```

### Commands

| Command | Description | Used By |
|---------|-------------|---------|
| `generate` | Phase 1 topology generation | `generate_new_topology` tool |
| `edit` | Phase 1 edit with feedback | `modify_current_topology` tool |
| `export` | Phase 2 + GNS3 export | `apply_security_and_export` tool |
| `qa` | Cisco knowledge base search | `search_cisco_knowledge` tool |
| `brief` | Configuration brief (debug) | Manual use |
| `validate` | Schema validation | Manual use |
| `manifest` | Image requirements checklist | Manual use |

### Communication Contract

- **Success**: Python prints exactly one JSON object to **stdout**, exits with code 0.
- **Failure**: Python prints a JSON error to **stderr**, exits with code 1.
- **Timeouts**: Node.js kills the process after 5 minutes (10 minutes for export).
- **No HTTP**: Python never opens a port. All communication is stdin/stdout/stderr.

---

## SSE Event Types

The frontend subscribes to SSE events via `GET /api/ai/sessions/:id/events?token=JWT` and handles 11 event types:

| Event | Data | Description |
|-------|------|-------------|
| `phase_change` | `{ phase, sub_phase }` | Pipeline phase transition |
| `thought` | `{ type, text }` | AI reasoning (understanding/decision/assumption/warning) |
| `topology_ready` | `{ nodes, links, ... }` | Topology draft available for review |
| `requirements_ready` | `[ { name, image_required, ... } ]` | Image requirements manifest |
| `summary_ready` | `{ thinking_text, design_review, assumptions }` | Design review summary |
| `phase2_progress` | `{ status }` | Phase 2 progress update |
| `export_progress` | `{ status }` | Export progress update |
| `config_text` | `{ device_name, chunk, start, done }` | Streamed device config text |
| `agent_message` | `{ message, tool_calls_made }` | Final LLM text response |
| `complete` | `{ download_url, validator_passed, ... }` | Generation complete |
| `error` | `{ message }` | Error occurred |
| `keepalive` | `{}` | Connection keepalive tick |

### Frontend SSE State Machine

```
idle → generating(thinking) → generating(building) → review
     → exporting(finalizing) → exporting(streaming_configs) → success | error
```

---

## LLM Tool-Calling Architecture

The chat orchestrator uses OpenAI function calling (no FSM). The LLM receives 4 tool definitions and decides autonomously what to call:

| Tool | When Called | What It Does |
|------|------------|--------------|
| `generate_new_topology(requirements)` | User wants a new design | Spawns Python for Phase 1 |
| `modify_current_topology(feedback)` | User wants edits to existing topology | Spawns Python for Phase 1 edit |
| `apply_security_and_export(security_profile)` | User approves and wants export | Spawns Python for Phase 2 + export |
| `search_cisco_knowledge(topic)` | User asks Cisco IOS question | Spawns Python for QA search |

The tool-calling loop runs up to **6 rounds** per user message with conversation history capped at **30 turns**. This naturally handles compound intents (e.g., "design X and apply enterprise security" in one message) without a state machine.

---

## Security Profiles

Three profiles are available, selected per session:

| Profile | What It Adds |
|---------|--------------|
| `none` | No hardening. Pure lab topology. Maximum compatibility. |
| `basic` | SSH v2, AAA local, service timestamps, login block, NTP, Syslog, no SNMP community strings, MOTD banner. Applied to every router. |
| `enterprise` | Everything in `basic` plus: Zone-Based Firewall (ZBF), anti-spoofing ACLs, TCP intercept, NAT PAT overload, OSPF MD5 authentication, HSRP, SNMPv3 (auth+priv), DHCP snooping, DAI, STP BPDU guard, port security, uRPF. Applied per security role. |

Security prompts are injected at both Phase 1 (topology design) and Phase 2 (config generation) via `security_prompts.py`. The project name in the exported file never contains security keywords.

---

## Safety Features

### Backend

- **Input validation middleware**: All Express routes validate request bodies (required fields, types, minLength) before handlers run.
- **JWT with no fallback**: `JWT_SECRET` must come from environment — there is no hardcoded default.
- **CORS restriction**: Production deployments must set `CORS_ORIGIN`; development allows all origins.
- **Session persistence**: `AgentSessionData` is persisted to MongoDB with in-memory fallback.
- **SSE keepalive**: Prevents proxy/load-balancer timeout on idle connections.
- **Tool round limit**: Maximum 6 LLM tool-calling rounds per user message (prevents infinite loops).

### Frontend

- **Error boundaries**: Both app-level and chat-level error boundaries catch render crashes.
- **3-minute safety timeout**: Auto-error if no SSE events received within 3 minutes.
- **Auto-reconnect**: SSE connections auto-reconnect with exponential backoff (up to 5 attempts, 1s to 15s).
- **Last-Event-ID**: On reconnection, EventSource sends the last event ID for replay.

### Python AI Engine

- **Auto-repair pipeline**: Removes duplicate connections, fixes single-port violations, bridges disconnected graph groups.
- **Three-Gate Safe Merge**: Phase 2 LLM configs pass through whitelist/no-overwrite/type gates.
- **Deterministic hardware**: Port numbers and hardware details are computed by Python, never by the LLM.
- **11-check structural validator**: Deep validation of exported `.gns3project` files.

---

## Features

- **Natural Language Input**: Describe your network in plain English
- **AI-Powered Generation**: LLM generates complete topology with device configs
- **Real-Time Progress**: SSE streaming shows AI thinking, decisions, and assumptions
- **Interactive Topology View**: SVG graph visualization of nodes and links
- **Design Review**: AI summarizes design decisions and assumptions
- **Requirements Manifest**: Table showing all required appliances and images
- **Edit & Iterate**: Request changes to the topology before exporting
- **GNS3 Export**: Download ready-to-import .gns3project files
- **Session Persistence**: Sessions survive server restarts (MongoDB-backed)
- **Demo Mode**: Try the app without creating an account
- **Security Profiles**: None / Basic / Enterprise hardening for Cisco devices
- **Cisco QA**: Ask questions about Cisco IOS commands and protocols

---

## Running Tests

### Backend (Node.js)

```bash
cd backend
npx jest tests/ --verbose
```

### Python AI Engine

```bash
cd ai-engine
python -m pytest tests/ -v
```

---

## License

See repository for license information.
