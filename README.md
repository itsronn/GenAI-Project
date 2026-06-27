# TruthArena — Multi-Agent AI Debate Platform

Two LLM agents argue for and against a user-submitted claim over multiple rounds. A third LLM (the Judge) scores both sides, detects logical fallacies, and delivers a verdict with reasoning.

---

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                     Frontend (Vite + React 19)                │
│  localhost:5173                                               │
│                                                              │
│  ┌──────────┐  ┌──────────────┐  ┌──────────┐  ┌─────────┐  │
│  │ Config   │  │ Debate       │  │ Verdict  │  │ Log     │  │
│  │ Panel    │  │ Columns      │  │ Card     │  │ Panel   │  │
│  │ (rounds, │  │ (FOR/AGAINST)│  │ (scores, │  │ (real-  │  │
│  │  persona)│  │              │  │  winner, │  │  time)  │  │
│  └──────────┘  └──────────────┘  │  fallacies)│  └─────────┘  │
│                                   └──────────┘               │
│                         │ POST /debate                        │
└─────────────────────────┼────────────────────────────────────┘
                          │
┌─────────────────────────┼────────────────────────────────────┐
│              FastAPI Backend (localhost:8000)                  │
│                                                              │
│  ┌──────────────┐    ┌────────────────┐                      │
│  │ main.py      │───▶│ orchestrator   │                      │
│  │ (routes)     │    │ .run_debate()  │                      │
│  └──────────────┘    └───────┬────────┘                      │
│                              │                               │
│                ┌─────────────┼─────────────┐                 │
│                ▼             ▼             ▼                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐        │
│  │ FOR Agent    │  │ AGAINST Agent│  │ JUDGE Agent  │        │
│  │ (Groq)       │  │ (Groq)       │  │ (Groq)       │        │
│  └──────────────┘  └──────────────┘  └──────────────┘        │
│         │                │                │                   │
│         └────────────────┴────────────────┘                   │
│                          │                                    │
│                  ┌───────▼───────┐                            │
│                  │  llm_clients  │                            │
│                  │  .call_llm()  │                            │
│                  └───────┬───────┘                            │
│                          │                                    │
│                  ┌───────▼───────┐                            │
│                  │  dynamic_rag  │                            │
│                  │  (Wikipedia + │                            │
│                  │   ChromaDB)   │                            │
│                  └───────────────┘                            │
└──────────────────────────────────────────────────────────────┘
```

---

## Project Structure

```
GenAI-Project/
├── backend/
│   ├── main.py              # FastAPI server — routes: GET /, POST /debate
│   ├── orchestrator.py       # Core debate loop: rounds → judge → verdict
│   ├── prompts.py            # Prompt templates for FOR, AGAINST, JUDGE
│   ├── llm_clients.py        # LLM API abstraction (Groq, Gemini, OpenRouter)
│   ├── config.py             # Model-to-role mapping (single source of truth)
│   ├── dynamic_rag.py        # Wikipedia retrieval + ChromaDB vector store
│   ├── check_key.py          # Utility: verify API keys
│   ├── list_groq_models.py   # Utility: list Groq's available models
│   ├── test_ipv4.py          # Utility: test IPv4 connectivity
│   ├── requirements.txt      # pip dependencies
│   └── .env                  # API keys (gitignored)
│
├── frontend/
│   ├── index.html            # HTML shell
│   ├── package.json          # npm dependencies (React 19, Vite 8)
│   ├── vite.config.js        # Vite config (React plugin)
│   ├── public/               # Static assets
│   └── src/
│       ├── main.jsx          # React entry point
│       ├── App.jsx           # Main UI component (all views + state)
│       ├── App.css           # All styles (glassmorphism, animations)
│       └── icons.jsx         # Inline SVG icon components
│
├── system_overview.md        # Legacy overview (outdated)
├── .gitignore
└── README.md
```

---

## How It Works

### 1. User submits a claim

The user types a debatable claim (or picks a preset) and presses **Start Debate**. The frontend sends `POST /debate` to the backend with `{ claim, num_rounds }`.

### 2. Backend orchestrates the debate

`orchestrator.py` runs `num_rounds` iterations:

- **Each round**: The FOR and AGAINST agents are called **in parallel** via `asyncio.gather`. Starting from round 2, each agent receives the opponent's last argument as context so the debate builds on itself (rebuttal style).
- **RAG context**: Before the first round, `dynamic_rag.py` searches Wikipedia for the claim, chunks the articles, stores them in ChromaDB, and retrieves the most relevant paragraphs. This context is injected into both debaters' prompts.

### 3. Judge scores the debate

After all rounds, the full transcript is sent to the JUDGE agent. The judge returns **strict JSON**:

```json
{
  "for_score": 8,
  "against_score": 7,
  "fallacies_detected": ["Hasty Generalization"],
  "verdict": "FOR Wins by Narrow Margin",
  "reasoning": "..."
}
```

- The backend defensively strips markdown fences from the LLM's response before parsing.
- If JSON parsing fails, it falls back gracefully with `for_score: null`.

### 4. Frontend renders the result

The response is streamed round-by-round with animated speech bubbles. The verdict card shows:

- **Score rings** — FOR and AGAINST numerical scores
- **Winner ring** — Derived strictly from the math (`parseInt`), not from the text verdict. Handles string scores like `"7/10"` safely.
- **Verdict text** — The LLM's decision statement
- **Fallacies** — Tagged list of logical fallacies detected
- **Confidence meter** — FOR/(FOR+AGAINST) ratio, animated per round

---

## Setup

### Backend

```bash
cd backend
pip install -r requirements.txt
```

Create `.env` in the `backend/` directory:

```
GROQ_API_KEY=gsk_your_key_here
```

(Optional: `GEMINI_API_KEY` and `OPENROUTER_API_KEY` if you switch providers.)

Start the server:

```bash
uvicorn main:app --reload
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Opens at `http://localhost:5173`.

---

## Configuration

### Model Assignment

Edit **`backend/config.py`** — the single source of truth for which model plays each role:

```python
AGENT_CONFIG = {
    "for":     {"provider": "groq", "model": "llama-3.3-70b-versatile"},
    "against": {"provider": "groq", "model": "llama-3.1-8b-instant"},
    "judge":   {"provider": "groq", "model": "llama-3.3-70b-versatile"},
}
```

Supported providers: `"groq"`, `"gemini"`, `"openrouter"`.

### Prompt Tuning

Edit **`backend/prompts.py`**:

- `for_prompt` / `against_prompt` — Enforce 4–5 sentence responses, first-person persona, banned robotic phrases
- `judge_prompt` — Includes a `CRITICAL SCORING RULE` that forces scores to match the text verdict

### RAG

**`backend/dynamic_rag.py`** fetches Wikipedia articles for the claim, chunks them, and stores them in an ephemeral ChromaDB collection. The top `num_paragraphs` (default 4) are injected as context into both debater prompts.

---

## Key Design Decisions

**Winner from math, not text** — The center verdict ring uses `parseInt` on both scores and derives the winner numerically. If the LLM outputs contradictory scores and text, the math wins.

**IPv4 enforcement** — `llm_clients.py` monkey-patches `socket.getaddrinfo` to force IPv4, working around broken IPv6 on some networks.

**Exponential backoff** — All LLM clients retry with `2^attempt + random jitter` on connection errors and rate limits (429/503).

**Parallel rounds** — FOR and AGAINST calls within the same round run concurrently via `asyncio.to_thread` + `asyncio.gather`.


**Defensive JSON parsing** — Judge responses are cleaned of markdown fences before `json.loads`, with a graceful fallback on parse failure.
