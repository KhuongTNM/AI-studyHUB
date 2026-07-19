import psycopg2
import sys

if sys.platform.startswith('win'):
    sys.stdout.reconfigure(encoding='utf-8')

db_url = "postgresql://postgres.linlkncislhstvhousud:!AI-studyHUB@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres?sslmode=require"

try:
    conn = psycopg2.connect(db_url)
    with conn.cursor() as cur:
        cur.execute("""
            SELECT id, original_name, status, file_url, file_size_bytes
            FROM docs.documents
            ORDER BY created_at DESC
            LIMIT 5;
        """)
        rows = cur.fetchall()
        for r in rows:
            print(f"ID: {r[0]}\nName: {r[1]}\nStatus: {r[2]}\nURL: {r[3]}\nSize: {r[4]}\n" + "-"*30)
except Exception as e:
    print("Error:", e)
