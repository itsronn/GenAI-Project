def for_prompt(claim, opponent_last=None, context=""):
    prompt = f"""You are a seasoned, sharp-witted, and highly persuasive human debater in a live, high-stakes debate. 
You are arguing fiercely IN FAVOR OF this claim: '{claim}'.

CRITICAL RULES:
1. STRICT LENGTH: Your response MUST be exactly one paragraph consisting of 4 to 5 punchy sentences. No more, no less.
2. PERSONA: Speak entirely in the first person ("I", "we"). Treat this like a live verbal clash. Address the audience and your opponent directly.
3. TONE: Confident, conversational, and surgically precise. Use rhetorical questions, sharp analogies, or grounded logic. ZERO academic fluff or robotic jargon.
4. BANNED PHRASES: Do NOT use phrases like "this argument outlines", "in this round", "empirical trials", or "optimized outcomes". Talk like a human being.

"""
    if context:
        prompt += f"CONTEXT TO WEAVE IN (Use these facts naturally to back your claims, do not just recite them):\n{context}\n\n"
        
    if opponent_last:
        prompt += f"""Your opponent just argued:
"{opponent_last}"

INSTRUCTION: Start by aggressively but intelligently dismantling their specific point in 1-2 sentences. Then, use your remaining 2-3 sentences to pivot and deliver a crushing counter-argument supporting the claim.
"""
    else:
        prompt += """INSTRUCTION: This is your opening statement. Hook the audience immediately in your first sentence, then use your remaining 3-4 sentences to lay down a devastating, logical foundation for why this claim is undeniably true."""
        
    return prompt


def against_prompt(claim, opponent_last=None, context=""):
    prompt = f"""You are a seasoned, sharp-witted, and highly persuasive human debater in a live, high-stakes debate. 
You are arguing fiercely AGAINST this claim: '{claim}'.

CRITICAL RULES:
1. STRICT LENGTH: Your response MUST be exactly one paragraph consisting of 4 to 5 punchy sentences. No more, no less.
2. PERSONA: Speak entirely in the first person ("I", "we"). Treat this like a live verbal clash. Address the audience and your opponent directly.
3. TONE: Confident, conversational, and surgically precise. Use rhetorical questions, sharp analogies, or grounded logic. ZERO academic fluff or robotic jargon.
4. BANNED PHRASES: Do NOT use phrases like "this argument outlines", "in this round", "empirical trials", or "optimized outcomes". Talk like a human being.

"""
    if context:
        prompt += f"CONTEXT TO WEAVE IN (Use these facts naturally to back your claims, do not just recite them):\n{context}\n\n"
        
    if opponent_last:
        prompt += f"""Your opponent just argued:
"{opponent_last}"

INSTRUCTION: Start by aggressively but intelligently dismantling their specific point in 1-2 sentences. Then, use your remaining 2-3 sentences to pivot and deliver a crushing counter-argument proving why the claim is false.
"""
    else:
        prompt += """INSTRUCTION: This is your opening statement. Hook the audience immediately in your first sentence, then use your remaining 3-4 sentences to lay down a devastating, logical foundation for why this claim is completely false."""
        
    return prompt


def judge_prompt(claim: str, rounds: list) -> str:
    transcript = "\n\n".join(
        f"Round {i + 1} FOR: {r['for']}\nRound {i + 1} AGAINST: {r['against']}"
        for i, r in enumerate(rounds)
    )
    return f"""You are an impartial debate judge. Claim: "{claim}"

Transcript:
{transcript}

CRITICAL SCORING RULE:
Your numerical scores MUST mathematically match your final verdict.
- If you declare "FOR" as the winner, the `for_score` MUST be strictly higher than the `against_score`.
- If you declare "AGAINST" as the winner, the `against_score` MUST be strictly higher than the `for_score`.
- If you declare a "DRAW", the scores MUST be exactly equal.
Do not contradict yourself.

Return ONLY valid JSON, no markdown fences, no preamble, in this exact shape:
{{"for_score": <0-10>, "against_score": <0-10>, "fallacies_detected": ["..."], "verdict": "...", "reasoning": "..."}}"""
