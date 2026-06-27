# TruthArena — System Overview

## What Is It?

TruthArena is a **multi-agent AI debate platform**. A human submits a debatable claim, and two LLM agents argue *for* and *against* it over multiple rounds. A third LLM (the Judge) then scores both sides, detects logical fallacies, and delivers a verdict.

---

## Project Structure

```
GenAI-Project/
├── .gitignore
├── README.md
├── backend/
│   ├── main.py              # FastAPI server entry point
│   ├── config.py            # Model-to-role assignment config
│   ├── llm_clients.py       # LLM API calls (Gemini, OpenRouter, Groq)
│   ├── orchestrator.py      # Debate orchestration & JSON cleanup
│   ├── prompts.py           # Prompt templates for For/Against/Judge
│   ├── dynamic_rag.py       # Wikipedia retrieval + ChromaDB vector store
│   ├── check_key.py         # Utility: verify OpenRouter API key
│   ├── list_groq_models.py  # Utility: list available Groq models
│   ├── test_ipv4.py         # Utility: test IPv4-only connectivity
│   ├── requirements.txt     # Python dependencies
│   └── .env                 # API keys (gitignored)
├── frontend/
│   ├── index.html           # HTML shell for Vite
│   ├── package.json         # npm dependencies (React 19, Vite 8)
│   ├── vite.config.js       # Vite config (React plugin)
│   ├── public/              # Static assets
│   └── src/
│       ├── main.jsx         # React entry point
│       ├── App.jsx          # Main UI component (all views + state)
│       ├── App.css          # All styles (glassmorphism, animations)
│       └── icons.jsx        # Inline SVG icon components
└── system_overview.md
```

---

## How It Works (End-to-End)

### Frontend (`frontend/`)

- **Vite 8 + React 19** build toolchain. Run with `npm run dev` at `localhost:5173`.
- **Single mode** — always sends `POST /debate` to the FastAPI backend at `http://localhost:8000`. No client-side simulation or hardcoded debate data.
- **UI features**: Confidence meter, real-time log panel, fallacy tooltips with hover descriptions, animated "thinking" states (pulsing glow on active agent columns), and a verdict card with three score rings.
- **Winner derivation** — The center ring derives the winner strictly from the numerical scores (`parseInt`), not from the LLM's text verdict. Handles string scores like `"7/10"` safely. The LLM's text verdict is shown separately below the rings.

### Backend (`backend/`)

#### `main.py` — FastAPI Server
- Endpoints:
  - `GET /` — Health check (`{"status": "ok"}`)
  - `POST /debate` — Accepts `{"claim": "...", "num_rounds": 3}`, returns the full debate transcript + verdict.
- CORS is wide open (`allow_origins=["*"]`).

#### `config.py` — Agent Configuration
- Maps the three roles to provider/model pairs (all Groq by default):
  - **FOR**: `groq` / `llama-3.3-70b-versatile`
  - **AGAINST**: `groq` / `llama-3.3-70b-versatile`
  - **JUDGE**: `groq` / `llama-3.3-70b-versatile`
- `NUM_ROUNDS_DEFAULT = 3`

#### `prompts.py` — Prompt Templates
- `for_prompt(claim, opponent_last, context)` — Sharp-witted human debater persona. Strict 4–5 sentence limit. If a prior round exists, it starts by rebutting the opponent (1–2 sentences) then pivots to a counter-argument (2–3 sentences). First-person only ("I", "we").
- `against_prompt(claim, opponent_last, context)` — Same structure for the Opponent.
- `judge_prompt(claim, rounds)` — Asks the Judge to output **strict JSON** with `for_score`, `against_score`, `fallacies_detected`, `verdict`, and `reasoning`. Includes a **CRITICAL SCORING RULE** forcing scores to mathematically match the verdict (FOR wins → for_score > against_score, DRAW → scores equal).

#### `orchestrator.py` — Core Logic
- `run_debate(claim, num_rounds)` — Async function that:
  1. Calls `build_dynamic_context(claim)` to retrieve relevant Wikipedia paragraphs via ChromaDB.
  2. Runs `num_rounds` of parallel FOR/AGAINST calls via `asyncio.gather`.
  3. Each round feeds the *opponent's last argument* to the other side (rebuttal style).
  4. Injects the RAG context into both debater prompts.
  5. After all rounds, calls the Judge once with the full transcript.
  6. Parses the Judge's JSON response with a defensive stripper for markdown fences.
  7. Falls back gracefully if JSON parsing fails.

#### `llm_clients.py` — LLM Abstraction Layer
- Forces **IPv4-only** DNS resolution (monkey-patches `socket.getaddrinfo`) to avoid broken IPv6 routing.
- Three provider functions, each with **exponential backoff + jitter retry** (up to 3 attempts):
  - `call_gemini(prompt, model)` — Google Gemini API
  - `call_openrouter(prompt, model)` — OpenRouter API (handles 429 rate limits)
  - `call_groq(prompt, model)` — Groq API (handles 429 and 503)
- `call_llm(prompt, provider, model)` — Generic dispatcher that routes to the correct provider by string name.

#### `dynamic_rag.py` — Context Retrieval
- Uses ChromaDB (ephemeral in-memory) as a vector store.
- On each debate, searches Wikipedia for the claim title, fetches the article, chunks it into paragraphs, embeds and stores them, then queries the top `num_paragraphs` (default 4) most relevant chunks.
- Retrieved context is passed into both `for_prompt` and `against_prompt` so debaters can ground their arguments in real facts.

### Utility Scripts

| File | Purpose |
|---|---|
| `check_key.py` | Tests an OpenRouter API key by hitting `/api/v1/auth/key` |
| `list_groq_models.py` | Lists all models available on the Groq API |
| `test_ipv4.py` | Standalone test to verify IPv4-only requests work against `api.groq.com` |

---

## Data Flow

```
User enters claim (frontend)
       │
       └── POST /debate ──→ http://localhost:8000
                               │
                               ├── build_dynamic_context(claim)
                               │       │
                               │       ├── Wikipedia search → fetch articles
                               │       ├── ChromaDB chunk + embed + store
                               │       └── Query top 4 paragraphs
                               │
                               ├── orchestrator.run_debate()
                               │       │
                               │       ├── Round 1: FOR (with RAG ctx) ──┐
                               │       │            AGAINST (with RAG ctx) ──┼── parallel (asyncio.gather)
                               │       ├── Round 2: FOR (with RAG ctx + Round 1 AGAINST) ──┐
                               │       │            AGAINST (with RAG ctx + Round 1 FOR) ──────┼── parallel
                               │       ├── ...
                               │       └── Judge: call_llm with full transcript
                               │
                               └── Returns JSON { rounds[], verdict{} } to frontend
```

---

## Setup & Running

### Backend
```bash
cd backend
pip install -r requirements.txt
# Create .env with GROQ_API_KEY (and optionally GEMINI_API_KEY, OPENROUTER_API_KEY)
uvicorn main:app --reload
```

### Frontend
```bash
cd frontend
npm install
npm run dev
# Opens at http://localhost:5173
```

---

## Key Design Decisions

1. **No hardcoded content** — All debate text comes from the LLM API. No preset scripts or local simulation fallback.
2. **Winner from math, not text** — The center verdict ring uses `parseInt` on both scores and derives the winner numerically. The LLM's text verdict is displayed separately to avoid contradiction.
3. **Judge scoring rule** — The judge prompt includes a hard constraint forcing `for_score` > `against_score` when FOR wins, etc.
4. **Debater persona enforcement** — For/Against prompts use strict 4–5 sentence limits and first-person "I"/"we" language to avoid robotic third-person LLM output.
5. **IPv4 enforcement** — Patches `socket.getaddrinfo` globally in `llm_clients.py` to work around broken IPv6 on some networks.
6. **Rebuttal structure** — Each round feeds the *opponent's last argument* to the other agent so the debate builds on itself rather than repeating opening statements.
7. **Judge JSON parsing** — Uses `_clean_json_response()` to strip markdown code fences that some models add despite instructions, then falls back gracefully on parse failure.
8. **Async parallelism** — FOR and AGAINST calls within the same round run concurrently via `asyncio.to_thread`.
9. **Exponential backoff** — All LLM clients retry with `(2^attempt) + random jitter` on connection errors and rate limits.
10. **RAG context injection** — Wikipedia retrieval via ChromaDB grounds debaters in real-world facts rather than pure LLM opinion.
