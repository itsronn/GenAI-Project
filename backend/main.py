from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from orchestrator import run_debate

app = FastAPI(title="TruthArena")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class DebateRequest(BaseModel):
    claim: str
    num_rounds: int = 3
    for_persona: int = 50
    against_persona: int = 50


@app.get("/")
def health():
    return {"status": "ok"}


@app.post("/debate")
async def debate(req: DebateRequest):
    return await run_debate(req.claim, req.num_rounds, req.for_persona, req.against_persona)