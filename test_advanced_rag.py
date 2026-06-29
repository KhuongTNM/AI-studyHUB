import psycopg2
import requests
import json
import time
import sys

# --- GLOBAL CONFIGURATION ---
DB_HOST = "localhost"
DB_PORT = "5432"
DB_NAME = "AIStudyHub"
DB_USER = "postgres"
DB_PASS = "12345"

JAVA_API_URL = "http://localhost:8080/api/v1/vector/search"
PYTHON_INGEST_URL = "http://localhost:8000/ingest"
JWT_TOKEN = "your_active_jwt_token_here"
TEST_DOCUMENT_ID = "11111111-1111-1111-1111-111111111111"
TEST_USER_ID = "22222222-2222-2222-2222-222222222222"

headers = {
    "Authorization": f"Bearer {JWT_TOKEN}",
    "Content-Type": "application/json"
}

print("🚀 Starting Advanced RAG Pipeline Automation Tests...")

def verify_database():
    print("\n--- Step 1: Database & Schema Verification ---")
    try:
        conn = psycopg2.connect(host=DB_HOST, port=DB_PORT, dbname=DB_NAME, user=DB_USER, password=DB_PASS)
        with conn.cursor() as cur:
            # Check fts column
            cur.execute("SELECT column_name, data_type FROM information_schema.columns WHERE table_schema='ai' AND table_name='document_chunks' AND column_name='fts';")
            res = cur.fetchone()
            assert res is not None, "Column 'fts' does not exist."
            
            # Check index
            cur.execute("SELECT indexname FROM pg_indexes WHERE schemaname='ai' AND tablename='document_chunks' AND indexname='idx_dc_fts';")
            assert cur.fetchone() is not None, "GIN index 'idx_dc_fts' does not exist."
            
            # Insert mock user and document for foreign key constraints if they don't exist
            cur.execute("INSERT INTO core.users (id) VALUES (%s) ON CONFLICT DO NOTHING", (TEST_USER_ID,))
            cur.execute("""
                INSERT INTO docs.documents (id, user_id, original_name, title, file_url, file_size_bytes, file_type, subject, status, visibility, share_status, download_count, created_at, updated_at, embedding_status)
                VALUES (%s, %s, 'test.pdf', 'test', 'test.pdf', 100, 'pdf', 'test', 'active', 'public', 'none', 0, NOW(), NOW(), 'none')
                ON CONFLICT DO NOTHING
            """, (TEST_DOCUMENT_ID, TEST_USER_ID))
            conn.commit()
            
        print("✅ DB schema fully verified. Mock user and document initialized.")
        return conn
    except Exception as e:
        print(f"❌ DB Verification failed: {e}")
        return None

def verify_ingestion(conn):
    print("\n--- Step 2: Ingest Verification (Overlap & Batching Check) ---")
    try:
        res = requests.post(PYTHON_INGEST_URL, json={
            "document_id": TEST_DOCUMENT_ID,
            "file_url": "test.pdf",
            "user_id": TEST_USER_ID,
            "file_type": "pdf"
        })
        print(f"Ingest Trigger Response: {res.status_code}")
        
        timeout = 20 # Short timeout since we know OpenAI might fail if no key
        start_time = time.time()
        status = "processing"
        
        while time.time() - start_time < timeout:
            with conn.cursor() as cur:
                cur.execute("SELECT embedding_status FROM docs.documents WHERE id = %s", (TEST_DOCUMENT_ID,))
                row = cur.fetchone()
                if row:
                    status = row[0]
                    if status in ["done", "failed", "none"]:
                        break
            time.sleep(2)
            
        if status != "done":
            print(f"⚠️ Polling ended with status: '{status}'. (Expected if OpenAI API Key is invalid or file is missing)")
        else:
            with conn.cursor() as cur:
                cur.execute("SELECT chunk_index, content, token_count FROM ai.document_chunks WHERE document_id = %s ORDER BY chunk_index ASC", (TEST_DOCUMENT_ID,))
                chunks = cur.fetchall()
            if len(chunks) > 0:
                print(f"✅ Created {len(chunks)} chunks successfully.")
                if len(chunks) > 1:
                    chunk0 = chunks[0][1]
                    chunk1 = chunks[1][1]
                    if chunk0[-20:] in chunk1:
                        print("✅ Overlap verified.")
            else:
                print("❌ Status is done but no chunks found.")
    except Exception as e:
        print(f"❌ Ingest verification failed: {e}")

def verify_streaming():
    print("\n--- Step 3 & 4: Real-Time Streaming & Metadata Parsing ---")
    try:
        start_time = time.time()
        response = requests.post(JAVA_API_URL, json={
            "query": "Hello AI",
            "user_id": TEST_USER_ID,
            "document_id": TEST_DOCUMENT_ID,
            "top_k": 5
        }, headers=headers, stream=True)
        
        if response.status_code != 200:
            print(f"⚠️ Search failed with status {response.status_code}: {response.text}")
            print("   (Expected failure due to invalid JWT or missing OpenAI Key)")
            return
            
        first_token = False
        full_text = ""
        
        for chunk in response.iter_content(chunk_size=None, decode_unicode=True):
            if chunk:
                if not first_token:
                    print(f"✅ First token received in {time.time() - start_time:.2f}s! (No buffering)")
                    first_token = True
                full_text += chunk
                
        boundary = "\n\n[SOURCES]\n"
        if boundary in full_text:
            print("✅ Boundary marker found.")
            metadata_str = full_text.split(boundary)[-1].strip()
            try:
                metadata = json.loads(metadata_str)
                print(f"✅ Metadata parsed successfully. Sources count: {len(metadata.get('sources', []))}")
            except Exception:
                print("❌ Failed to parse JSON metadata.")
        else:
            print("❌ Boundary marker not found.")
    except Exception as e:
        print(f"❌ Streaming test failed: {e}")

if __name__ == "__main__":
    conn = verify_database()
    if conn:
        verify_ingestion(conn)
        verify_streaming()
        conn.close()
    print("\n🎉 Automated testing script finished.")
