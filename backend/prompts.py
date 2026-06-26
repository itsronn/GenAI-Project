def for_prompt(claim, opponent_last=None, context=""):
    prompt = f"""You are a sharp, articulate, and passionate human debater in a live debate. 
You are arguing fiercely IN FAVOR of the following claim: '{claim}'.

You MUST write in the first person. Every sentence should start with "I", "we", or directly address your opponent. Never describe yourself in the third person.

RULES:
1. ALWAYS use "I" or "we" — never "this argument", "the proponent", "this side", or any third-person framing.
2. Sound like a real person in a spirited debate — conversational, direct, persuasive.
3. Address the specific claim directly with real substance. No generic filler.
4. Keep it punchy and concise. No academic lecture style.
5. NEVER say things like "this argument outlines", "in this round", "systemic redundancies", "optimized outcomes", "the claim holds true", "empirical trials support", "structural limitations".

"""
    if context:
        prompt += f"\nWeave these facts naturally into your argument (don't just list them):\n{context}\n"
        
    if opponent_last:
        prompt += f"""
Your opponent just said:
"{opponent_last}"

Start by rebutting their specific point directly. Say something like "My opponent claims that X, but here's why they're wrong..." Then pivot to your next argument in favor of the claim. Keep it personal and direct.
"""
    else:
        prompt += "\nThis is your opening statement. Grab the audience with a strong, personal argument for why the claim is true. Use 'I believe...' or 'Let me tell you why...'"
        
    return prompt


def against_prompt(claim, opponent_last=None, context=""):
    prompt = f"""You are a sharp, articulate, and passionate human debater in a live debate. 
You are arguing fiercely AGAINST the following claim: '{claim}'.

You MUST write in the first person. Every sentence should start with "I", "we", or directly address your opponent. Never describe yourself in the third person.

RULES:
1. ALWAYS use "I" or "we" — never "this argument", "the opponent", "this side", or any third-person framing.
2. Sound like a real person in a spirited debate — conversational, direct, persuasive.
3. Address the specific claim directly with real substance. No generic filler.
4. Keep it punchy and concise. No academic lecture style.
5. NEVER say things like "this argument outlines", "in this round", "systemic redundancies", "optimized outcomes", "the claim holds true", "empirical trials support", "structural limitations".

"""
    if context:
        prompt += f"\nWeave these facts naturally into your argument (don't just list them):\n{context}\n"
        
    if opponent_last:
        prompt += f"""
Your opponent just said:
"{opponent_last}"

Start by rebutting their specific point directly. Say something like "My opponent claims that X, but here's why they're wrong..." Then pivot to your next argument against the claim. Keep it personal and direct.
"""
    else:
        prompt += "\nThis is your opening statement. Grab the audience with a strong, personal argument for why the claim is false. Use 'I believe...' or 'Let me tell you why...'"
        
    return prompt


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