import os
from openai import OpenAI

api_key = os.getenv("OPENAI_API_KEY")
print(f"OPENAI_API_KEY from environment: {'Present (Length: ' + str(len(api_key)) + ')' if api_key else 'Missing'}")

client = OpenAI(
    api_key=api_key,
    base_url="https://generativelanguage.googleapis.com/v1beta/openai/"
)

try:
    print("Testing embeddings call...")
    emb_resp = client.embeddings.create(
        input=["Hello world"],
        model="gemini-embedding-001"
    )
    print("Embeddings call successful!")
except Exception as e:
    print(f"Embeddings call failed: {e}")

try:
    print("Testing chat completion call with gemini-2.5-flash...")
    chat_resp = client.chat.completions.create(
        model="gemini-2.5-flash",
        messages=[{"role": "user", "content": "Hi, say test"}],
        max_tokens=10
    )
    print(f"Chat completion successful! Response: {chat_resp.choices[0].message.content}")
except Exception as e:
    print(f"Chat completion failed: {e}")
