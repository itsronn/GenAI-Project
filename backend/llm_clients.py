import os
import time
import random
import socket
import requests
from dotenv import load_dotenv

load_dotenv()

# Force IPv4 — some networks have broken/unreliable IPv6 routing,
# which causes DNS to resolve fine but connections to silently fail.
_orig_getaddrinfo = socket.getaddrinfo
def _ipv4_only_getaddrinfo(host, port, family=0, type=0, proto=0, flags=0):
    return _orig_getaddrinfo(host, port, socket.AF_INET, type, proto, flags)
socket.getaddrinfo = _ipv4_only_getaddrinfo

GEMINI_KEY = os.environ.get("GEMINI_API_KEY")
OPENROUTER_KEY = os.environ.get("OPENROUTER_API_KEY")
GROQ_KEY = os.environ.get("GROQ_API_KEY")


def call_gemini(prompt: str, model: str = "gemini-2.5-flash", max_retries: int = 3) -> str:
    if not GEMINI_KEY:
        raise RuntimeError("GEMINI_API_KEY not set in .env")

    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={GEMINI_KEY}"
    payload = {"contents": [{"parts": [{"text": prompt}]}]}

    for attempt in range(max_retries):
        try:
            resp = requests.post(url, json=payload, timeout=30)
        except requests.exceptions.ConnectionError as e:
            wait_time = (2 ** attempt) + random.uniform(0, 1)
            print(f"[ConnectionError] Gemini connection dropped, retrying in {wait_time:.1f}s (attempt {attempt + 1}/{max_retries})")
            time.sleep(wait_time)
            continue

        if resp.status_code == 503:
            wait_time = (2 ** attempt) + random.uniform(0, 1)
            print(f"[503] Gemini overloaded, retrying in {wait_time:.1f}s (attempt {attempt + 1}/{max_retries})")
            time.sleep(wait_time)
            continue

        resp.raise_for_status()
        data = resp.json()
        try:
            return data["candidates"][0]["content"]["parts"][0]["text"]
        except (KeyError, IndexError) as e:
            raise RuntimeError(f"Unexpected Gemini response shape: {data}") from e

    raise RuntimeError(f"Gemini still unavailable after {max_retries} retries for model {model}")


def call_openrouter(prompt: str, model: str = "meta-llama/llama-3.3-70b-instruct:free", max_retries: int = 3) -> str:
    if not OPENROUTER_KEY:
        raise RuntimeError("OPENROUTER_API_KEY not set in .env")

    headers = {
        "Authorization": f"Bearer {OPENROUTER_KEY}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": model,
        "messages": [{"role": "user", "content": prompt}],
    }

    for attempt in range(max_retries):
        try:
            resp = requests.post(
                "https://openrouter.ai/api/v1/chat/completions",
                headers=headers,
                json=payload,
                timeout=30,
            )
        except requests.exceptions.ConnectionError as e:
            wait_time = (2 ** attempt) + random.uniform(0, 1)
            print(f"[ConnectionError] OpenRouter connection dropped, retrying in {wait_time:.1f}s (attempt {attempt + 1}/{max_retries})")
            time.sleep(wait_time)
            continue

        if resp.status_code == 429:
            retry_after = resp.headers.get("Retry-After")
            wait_time = float(retry_after) if retry_after else (2 ** attempt) + random.uniform(0, 1)
            print(f"[429] Rate limited on {model}, retrying in {wait_time:.1f}s (attempt {attempt + 1}/{max_retries})")
            time.sleep(wait_time)
            continue

        resp.raise_for_status()
        data = resp.json()
        try:
            return data["choices"][0]["message"]["content"]
        except (KeyError, IndexError) as e:
            raise RuntimeError(f"Unexpected OpenRouter response shape: {data}") from e

    raise RuntimeError(f"OpenRouter rate limit not resolved after {max_retries} retries for model {model}")


def call_groq(prompt: str, model: str = "llama-3.3-70b-versatile", max_retries: int = 3) -> str:
    if not GROQ_KEY:
        raise RuntimeError("GROQ_API_KEY not set in .env")

    headers = {
        "Authorization": f"Bearer {GROQ_KEY}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": model,
        "messages": [{"role": "user", "content": prompt}],
    }

    for attempt in range(max_retries):
        try:
            resp = requests.post(
                "https://api.groq.com/openai/v1/chat/completions",
                headers=headers,
                json=payload,
                timeout=30,
            )
        except requests.exceptions.ConnectionError as e:
            wait_time = (2 ** attempt) + random.uniform(0, 1)
            print(f"[ConnectionError] Groq connection dropped, retrying in {wait_time:.1f}s (attempt {attempt + 1}/{max_retries})")
            time.sleep(wait_time)
            continue

        if resp.status_code in (429, 503):
            wait_time = (2 ** attempt) + random.uniform(0, 1)
            print(f"[{resp.status_code}] Groq busy on {model}, retrying in {wait_time:.1f}s (attempt {attempt + 1}/{max_retries})")
            time.sleep(wait_time)
            continue

        resp.raise_for_status()
        data = resp.json()
        try:
            return data["choices"][0]["message"]["content"]
        except (KeyError, IndexError) as e:
            raise RuntimeError(f"Unexpected Groq response shape: {data}") from e

    raise RuntimeError(f"Groq still unavailable after {max_retries} retries for model {model}")


def call_llm(prompt: str, provider: str = "gemini", model: str = None) -> str:
    """Generic dispatcher. Swap providers/models without touching call sites."""
    if provider == "gemini":
        return call_gemini(prompt, model or "gemini-2.5-flash")
    elif provider == "openrouter":
        return call_openrouter(prompt, model or "meta-llama/llama-3.3-70b-instruct:free")
    elif provider == "groq":
        return call_groq(prompt, model or "llama-3.3-70b-versatile")
    else:
        raise ValueError(f"Unknown provider: {provider}")