def for_prompt(claim: str, opponent_last: str = None) -> str:
    base = f'You are arguing FOR this claim: "{claim}"\n'
    if opponent_last:
        base += (
            f'\nYour opponent just argued:\n"""{opponent_last}"""\n\n'
            "Write a rebuttal addressing their specific points. "
            "Don't just repeat your opening case."
        )
    else:
        base += "\nBuild your strongest opening case in 3-4 sentences."
    return base


def against_prompt(claim: str, opponent_last: str = None) -> str:
    base = f'You are arguing AGAINST this claim: "{claim}"\n'
    if opponent_last:
        base += (
            f'\nYour opponent just argued:\n"""{opponent_last}"""\n\n'
            "Write a rebuttal addressing their specific points. "
            "Don't just repeat your opening case."
        )
    else:
        base += "\nBuild your strongest opening case in 3-4 sentences."
    return base


def judge_prompt(claim: str, rounds: list) -> str:
    transcript = "\n\n".join(
        f"Round {i + 1} FOR: {r['for']}\nRound {i + 1} AGAINST: {r['against']}"
        for i, r in enumerate(rounds)
    )
    return f"""You are an impartial debate judge. Claim: "{claim}"

Transcript:
{transcript}

Return ONLY valid JSON, no markdown fences, no preamble, in this exact shape:
{{"for_score": <0-10>, "against_score": <0-10>, "fallacies_detected": ["..."], "verdict": "...", "reasoning": "..."}}"""