import requests
import time
import uuid

# Configuration
BASE_URL = "http://localhost:8080/api/v1/chat"
AUTH_URL = "http://localhost:8080/api/auth"

# Generate mock UUIDs
DOCUMENT_ID = str(uuid.uuid4())

def get_token_for_user(email, password, display_name):
    # Try to login first
    res = requests.post(f"{AUTH_URL}/login", json={"email": email, "password": password})
    if res.status_code == 200:
        return res.json()["accessToken"]
    
    # If login fails, try to register
    res = requests.post(f"{AUTH_URL}/register", json={
        "email": email, 
        "password": password, 
        "confirmPassword": password,
        "displayName": display_name
    })
    if res.status_code == 201:
        return res.json()["accessToken"]
    
    raise Exception(f"Failed to get token for {email}. Status: {res.status_code}, Body: {res.text}")

token1 = get_token_for_user("user1@test.com", "Password123!", "User One")
token2 = get_token_for_user("user2@test.com", "Password123!", "User Two")

headers1 = {"Authorization": f"Bearer {token1}", "Content-Type": "application/json"}
headers2 = {"Authorization": f"Bearer {token2}", "Content-Type": "application/json"}

print("🚀 Starting Chat History API Tests...")

# 1. Create a new session
print("\n--- 1. POST /sessions (Create Session) ---")
res = requests.post(f"{BASE_URL}/sessions", json={}, headers=headers1)
assert res.status_code == 201, f"Expected 201 Created, got {res.status_code}. Body: {res.text}"
session_id = res.json()["id"]
print(f"✅ Session Created: {session_id}")

# 2. Add messages
print(f"\n--- 2. POST /sessions/{session_id}/messages (Add Messages) ---")
res_msg1 = requests.post(f"{BASE_URL}/sessions/{session_id}/messages", 
                         json={"role": "user", "content": "Hello AI!"}, 
                         headers=headers1)
print(f"Msg1 Status Code: {res_msg1.status_code}")
assert res_msg1.status_code == 201, "Expected 201 Created for Msg1"

res_msg2 = requests.post(f"{BASE_URL}/sessions/{session_id}/messages", 
                         json={"role": "assistant", "content": "Hello User! How can I help?"}, 
                         headers=headers1)
print(f"Msg2 Status Code: {res_msg2.status_code}")
assert res_msg2.status_code == 201, "Expected 201 Created for Msg2"
print("✅ Messages added successfully.")

# 3. Get all sessions
print(f"\n--- 3. GET /sessions (Get All Sessions) ---")
res = requests.get(f"{BASE_URL}/sessions", headers=headers1)
print(f"Status Code: {res.status_code}")
assert res.status_code == 200, "Expected 200 OK"
sessions = res.json()
print(f"Found {len(sessions)} sessions.")
assert any(s["id"] == session_id for s in sessions), "Newly created session not found in list."
print("✅ Session list verified.")

# 4. Get messages in session
print(f"\n--- 4. GET /sessions/{session_id}/messages (Get Messages) ---")
res = requests.get(f"{BASE_URL}/sessions/{session_id}/messages", headers=headers1)
print(f"Status Code: {res.status_code}")
assert res.status_code == 200, "Expected 200 OK"
messages = res.json()
print(f"Found {len(messages)} messages.")
assert len(messages) >= 2, "Expected at least 2 messages."
assert messages[0]["content"] == "Hello AI!", "Message 1 content mismatch."
assert messages[1]["content"] == "Hello User! How can I help?", "Message 2 content mismatch."
print("✅ Messages retrieved in correct order.")

# 5. Security check: User 2 tries to access User 1's session
print(f"\n--- 5. GET /sessions/{session_id}/messages (Unauthorized Access Test) ---")
res = requests.get(f"{BASE_URL}/sessions/{session_id}/messages", headers=headers2)
print(f"Status Code: {res.status_code}")
# Expected 404 since BusinessException(CHAT_SESSION_NOT_FOUND) maps to 404
assert res.status_code in [403, 404], f"Expected 403 or 404, got {res.status_code}"
print("✅ Unauthorized access correctly denied.")

print("\n🎉 All tests passed successfully!")
