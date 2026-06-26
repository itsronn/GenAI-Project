# TruthArena — System Overview

## What Is It?

TruthArena is a **multi-agent AI debate platform**. A human submits a debatable claim, and two LLM agents argue *for* and *against* it over multiple rounds. A third LLM (the Judge) then scores both sides, detects logical fallacies, and delivers a verdict.

---

## Project Structure

```
GenAI-Project/
├── .gitignore
├── backend/
│   ├── main.py              # FastAPI server entry point
│   ├── config.py            # Model-to-role assignment config
│   ├── llm_clients.py       # LLM API calls (Gemini, OpenRouter, Groq)
│   ├── orchestrator.py      # Debate orchestration & JSON cleanup
│   ├── prompts.py           # Prompt templates for For/Against/Judge
│   ├── check_key.py         # Utility: verify OpenRouter API key
│   ├── list_groq_models.py  # Utility: list available Groq models
│   ├── test_ipv4.py         # Utility: test IPv4-only connectivity
│   └── requirements.txt     # Python dependencies
└── frontend/
    └── index.html           # Single-page React app (no build step)
```

---

## How It Works (End-to-End)

### Frontend (`frontend/index.html`)

- **No build step** — pure HTML + inline React 18 (via CDN) + Babel standalone for JSX.
- Two **operation modes** controlled by a toggle:
  1. **Simulator** — Client-side only. Uses three hardcoded preset debates and a dynamic generator for custom claims. No backend needed.
  2. **Live Backend** — Sends a `POST /debate` to the FastAPI server at `http://localhost:8000`.
- **UI features**: Confidence meter, real-time log panel, fallacy tooltips, animated "thinking" states, and a verdict card with score rings.

### Backend (`backend/`)

#### `main.py` — FastAPI Server
- Endpoints:
  - `GET /` — Health check (`{"status": "ok"}`)
  - `POST /debate` — Accepts `{"claim": "...", "num_rounds": 3}`, returns the full debate transcript + verdict.
- CORS is wide open (`allow_origins=["*"]`).

#### `config.py` — Agent Configuration
- Maps the three roles to provider/model pairs (Groq for all three by default):
  - **FOR**: `groq` / `llama-3.3-70b-versatile`
  - **AGAINST**: `groq` / `qwen/qwen3-32b`
  - **JUDGE**: `groq` / `openai/gpt-oss-120b`
- `NUM_ROUNDS_DEFAULT = 3`

#### `prompts.py` — Prompt Templates
- `for_prompt(claim, opponent_last)` — Role-prompt for the Proponent. If a prior round exists, it includes the opponent's last argument for rebuttal.
- `against_prompt(claim, opponent_last)` — Same structure for the Opponent.
- `judge_prompt(claim, rounds)` — Asks the Judge to output **strict JSON** (no markdown fences) with `for_score`, `against_score`, `fallacies_detected`, `verdict`, and `reasoning`.

#### `orchestrator.py` — Core Logic
- `run_debate(claim, num_rounds)` — Async function that:
  1. Runs `num_rounds` of parallel FOR/AGAINST calls via `asyncio.gather`.
  2. Each round feeds the *opponent's last argument* to the other side (rebuttal style).
  3. After all rounds, calls the Judge once with the full transcript.
  4. Parses the Judge's JSON response with a defensive stripper for markdown fences.
  5. Falls back gracefully if JSON parsing fails.

#### `llm_clients.py` — LLM Abstraction Layer
- Forces **IPv4-only** DNS resolution (monkey-patches `socket.getaddrinfo`) to avoid broken IPv6 routing.
- Three provider functions, each with **exponential backoff + jitter retry** (up to 3 attempts):
  - `call_gemini(prompt, model)` — Google Gemini API
  - `call_openrouter(prompt, model)` — OpenRouter API (handles 429 rate limits)
  - `call_groq(prompt, model)` — Groq API (handles 429 and 503)
- `call_llm(prompt, provider, model)` — Generic dispatcher that routes to the correct provider by string name.

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
       ├── [Simulator Mode] ──→ Client renders hardcoded/generated debate data
       │
       └── [Live Backend Mode] ──→ POST /debate
                                       │
                                       ├── orchestrator.run_debate()
                                       │       │
                                       │       ├── Round 1: FOR (call_llm) + AGAINST (call_llm)  ← parallel
                                       │       ├── Round 2: FOR (with Round 1 AGAINST as context)
                                       │       │            AGAINST (with Round 1 FOR as context)
                                       │       ├── ...
                                       │       └── Judge: call_llm with full transcript
                                       │
                                       └── Returns JSON to frontend
```

---

## Setup & Running

### Backend
```bash
cd backend
pip install -r requirements.txt
# Create .env with GEMINI_API_KEY, OPENROUTER_API_KEY, and/or GROQ_API_KEY
uvicorn main:app --reload
```

### Frontend
Just open `frontend/index.html` in a browser — no build tools required.

---

## Key Design Decisions

1. **IPv4 enforcement** — Patches `socket.getaddrinfo` globally in `llm_clients.py` to work around broken IPv6 on some networks.
2. **Rebuttal structure** — Each round feeds the *opponent's last argument* to the other agent so the debate builds on itself rather than repeating opening statements.
3. **Judge JSON parsing** — Uses `_clean_json_response()` to strip markdown code fences that some models add despite instructions, then falls back gracefully on parse failure.
4. **Async parallelism** — FOR and AGAINST calls within the same round run concurrently via `asyncio.to_thread`.
5. **Exponential backoff** — All LLM clients retry with `(2^attempt) + random jitter` on connection errors and rate limits.
