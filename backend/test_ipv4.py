import socket
import requests

# Force requests/urllib3 to only use IPv4 by patching getaddrinfo
orig_getaddrinfo = socket.getaddrinfo

def ipv4_only_getaddrinfo(host, port, family=0, type=0, proto=0, flags=0):
    return orig_getaddrinfo(host, port, socket.AF_INET, type, proto, flags)

socket.getaddrinfo = ipv4_only_getaddrinfo

try:
    resp = requests.get("https://api.groq.com", timeout=10)
    print("SUCCESS - status:", resp.status_code)
except Exception as e:
    print("STILL FAILED:", e)