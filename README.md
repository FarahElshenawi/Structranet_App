# StructuraNet App

AI-powered Natural Language to GNS3 Topology Generator.

## Architecture

```
structuranet_app/
├── ai-engine/          # Python AI pipeline (FastAPI + SSE)
│   ├── structranet/    # Main Python package
│   │   ├── api/        # FastAPI REST API + SSE streaming
│   │   ├── core/       # Pipeline runner, session store, thought parser
│   │   ├── ai/         # AI agent, config agent, LLM utils
│   │   ├── generation/ # Preflight checks, topology finalizer
│   │   ├── export/     # GNS3 project exporter + validator
│   │   ├── catalog/    # Appliance catalog, hardware config, port assigner
│   │   ├── constants/  # Shared constants (hardware, GNS3, AI, etc.)
│   │   ├── orchestrator.py  # CLI orchestrator
│   │   ├── utils.py         # Shared helpers
│   ├── run.py          # Entry point
│   ├── tests/          # Test suite
├── client/             # React + Vite frontend
│   ├── src/
│   │   ├── lib/api.js         # FastAPI client (sessions, SSE, downloads)
│   │   ├── components/
│   │   │   ├── topologyView/  # SVG network graph visualization
│   │   │   ├── phaseProgress/ # Pipeline progress with SSE thoughts
│   │   │   ├── newPrompt/     # Chat input bar
│   │   │   └── ...
│   │   └── routes/
│   │       ├── chatPage/      # Main topology generation UI
│   │       └── ...
├── backend/            # Express.js backend (auth + chat persistence)
│   ├── index.js
│   └── models/
```

## Data Flow

```
User types prompt → Client creates session → FastAPI generates topology
                   ↓                         ↓
            Express saves chat         SSE streams progress
                                             ↓
                                   Client renders topology SVG
                                             ↓
                                   User reviews → Approve → Download .gns3project
```

## Quick Start

### 1. Python AI Engine

```bash
cd ai-engine
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

Copy `.env.example` to `.env` and set your API key:
```
ROUTER_API_KEY=your-openrouter-api-key-here
```

Start the API server:
```bash
uvicorn run:app --reload --port 8000
```

### 2. Express.js Backend

```bash
cd backend
npm install
```

Make sure MongoDB is running, then start:
```bash
npm start
```

### 3. React + Vite Client

```bash
cd client
npm install
npm run dev
```

The client runs on `http://localhost:5173` and connects to:
- **FastAPI** on port 8000 (topology generation + SSE)
- **Express** on port 3000 (auth + chat persistence)

## Environment Variables

Copy `.env.example` to `.env` and fill in the required values.

| Variable | Where | Description |
|----------|-------|-------------|
| `ROUTER_API_KEY` | ai-engine | OpenRouter API key for LLM calls |
| `ROUTER_BASE_URL` | ai-engine | OpenRouter base URL |
| `AI_MODEL` | ai-engine | LLM model identifier |
| `PORT` | backend | Express server port (default: 3000) |
| `MONGO` | backend | MongoDB connection string |
| `JWT_SECRET` | backend | Secret for JWT token signing |
| `VITE_API_URL` | client | FastAPI base URL (default: http://localhost:8000) |

## Features

- **Natural Language Input**: Describe your network in plain English
- **AI-Powered Generation**: LLM generates complete topology with device configs
- **Real-Time Progress**: SSE streaming shows AI thinking, decisions, and assumptions
- **Interactive Topology View**: SVG graph visualization of nodes and links
- **Design Review**: AI summarizes design decisions and assumptions
- **Requirements Manifest**: Table showing all required appliances and images
- **Edit & Iterate**: Request changes to the topology before exporting
- **GNS3 Export**: Download ready-to-import .gns3project files
- **Session Management**: Each generation is a session you can review and modify
