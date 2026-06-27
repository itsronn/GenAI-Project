import asyncio
import json

from llm_clients import call_llm
from prompts import for_prompt, against_prompt, judge_prompt
from config import AGENT_CONFIG, NUM_ROUNDS_DEFAULT
from dynamic_rag import build_dynamic_context


def _clean_json_response(raw: str) -> dict:
    """Defensively strip markdown fences some models add despite instructions."""
    cleaned = raw.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.removeprefix("```json").removeprefix("```").strip()
    if cleaned.endswith("```"):
        cleaned = cleaned.removesuffix("```").strip()
    return json.loads(cleaned)


async def run_debate(claim: str, num_rounds: int = NUM_ROUNDS_DEFAULT, for_persona: int = 50, against_persona: int = 50) -> dict:
    debate_state = {"claim": claim, "rounds": []}

    debate_context = build_dynamic_context(claim)

    for i in range(num_rounds):
        opponent_last_for = debate_state["rounds"][-1]["against"] if i > 0 else None
        opponent_last_against = debate_state["rounds"][-1]["for"] if i > 0 else None

        for_task = asyncio.to_thread(
            call_llm,
            for_prompt(claim, opponent_last_for, context=debate_context, persona=for_persona),
            **AGENT_CONFIG["for"],
        )
        against_task = asyncio.to_thread(
            call_llm,
            against_prompt(claim, opponent_last_against, context=debate_context, persona=against_persona),
            **AGENT_CONFIG["against"],
        )

        for_resp, against_resp = await asyncio.gather(for_task, against_task)
        debate_state["rounds"].append({"for": for_resp, "against": against_resp})

    judge_raw = await asyncio.to_thread(
        call_llm,
        judge_prompt(claim, debate_state["rounds"]),
        **AGENT_CONFIG["judge"],
    )

    try:
        debate_state["verdict"] = _clean_json_response(judge_raw)
    except json.JSONDecodeError:
        debate_state["verdict"] = {
            "for_score": None,
            "against_score": None,
            "fallacies_detected": [],
            "verdict": "Judge response could not be parsed",
            "reasoning": judge_raw,
        }

    return debate_state