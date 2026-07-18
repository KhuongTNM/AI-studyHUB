import urllib.request
import urllib.error
import json

url = "https://qpwnqtvxthaybzqxjwnm.supabase.co/storage/v1"
bucket = "documents"
key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFwd25xdHZ4dGhheWJ6cXhqd25tIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MjQ2NzgwMCwiZXhwIjoyMDk4MDQzODAwfQ.GmWsinZlav2v7lGZLOKgyXxrMuuBT93swQuAWbW-Qcg"

# 1. Test listing bucket objects or getting bucket details
bucket_url = f"{url}/bucket/{bucket}"
req = urllib.request.Request(bucket_url, headers={"Authorization": f"Bearer {key}"})

try:
    with urllib.request.urlopen(req) as response:
        print("Bucket details status:", response.status)
        print("Bucket details response:", response.read().decode())
except urllib.error.HTTPError as e:
    print("HTTPError for bucket details:", e.code, e.reason)
    print(e.read().decode())
except Exception as e:
    print("Error:", e)

# 2. Try listing objects in bucket
list_url = f"{url}/object/list/{bucket}"
req2 = urllib.request.Request(
    list_url,
    data=json.dumps({"prefix": "", "limit": 10}).encode(),
    headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
    method="POST"
)

try:
    with urllib.request.urlopen(req2) as response:
        print("List objects status:", response.status)
        print("List objects response:", response.read().decode()[:500])
except urllib.error.HTTPError as e:
    print("HTTPError for listing objects:", e.code, e.reason)
    print(e.read().decode())
except Exception as e:
    print("Error list:", e)
