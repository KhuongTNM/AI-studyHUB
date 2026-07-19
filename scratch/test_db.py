import psycopg2
import sys

# Reconfigure stdout to use UTF-8
if sys.platform.startswith('win'):
    sys.stdout.reconfigure(encoding='utf-8')

db_url = "postgresql://postgres.linlkncislhstvhousud:!AI-studyHUB@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres?sslmode=require"

try:
    conn = psycopg2.connect(db_url)
    with conn.cursor() as cur:
        # Get details of last 10 documents
        cur.execute("""
            SELECT id, user_id, folder_id, original_name, status, file_url, file_size_bytes, created_at
            FROM docs.documents
            ORDER BY created_at DESC
            LIMIT 10;
        """)
        rows = cur.fetchall()
        print("Last 10 documents:")
        for r in rows:
            print(f"ID: {r[0]} | User: {r[1]} | Folder: {r[2]} | Name: {r[3]} | Status: {r[4]} | Size: {r[6]} | Created: {r[7]}")
            
        print("\n" + "="*50 + "\n")
        
        # Get details of users
        cur.execute("""
            SELECT id, email, role, storage_used_bytes, storage_limit_bytes
            FROM core.users;
        """)
        users = cur.fetchall()
        print("Users:")
        for u in users:
            print(f"ID: {u[0]} | Email: {u[1]} | Role: {u[2]} | Storage Used: {u[3]} / Limit: {u[4]}")
            
except Exception as e:
    print("Database connection failed:", e)
