# Model-to-role assignment.
# This is the ONLY file you edit if a free model gets pulled or rate-limited.

AGENT_CONFIG = {
    "for":     {"provider": "groq", "model": "llama-3.3-70b-versatile"},
    "against": {"provider": "groq", "model": "qwen/qwen3-32b"},
    "judge":   {"provider": "groq", "model": "openai/gpt-oss-120b"},
}

# Backup model slugs in case a free model gets pulled from OpenRouter:
# against: "qwen/qwen3-coder:free" or "google/gemma-3-12b:free"
# judge:   "meta-llama/llama-3.3-70b-instruct:free" (different from "against" if you swap)

NUM_ROUNDS_DEFAULT = 3