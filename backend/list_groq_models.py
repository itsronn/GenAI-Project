import os
import requests
from dotenv import load_dotenv

load_dotenv()

GROQ_KEY = os.environ.get("GROQ_API_KEY")

headers = {"Authorization": f"Bearer {GROQ_KEY}"}
resp = requests.get("https://api.groq.com/openai/v1/models", headers=headers)
data = resp.json()

print("Available Groq models:")
for model in data.get("data", []):
    print(" -", model.get("id"))