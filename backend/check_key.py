import os
import requests
from dotenv import load_dotenv

load_dotenv()

headers = {"Authorization": f"Bearer {os.environ['OPENROUTER_API_KEY']}"}
resp = requests.get("https://openrouter.ai/api/v1/auth/key", headers=headers)
print(resp.status_code)
print(resp.json())