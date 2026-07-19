import psycopg2

db_url = "postgresql://postgres.linlkncislhstvhousud:!AI-studyHUB@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres?sslmode=require"

try:
    conn = psycopg2.connect(db_url)
    with conn.cursor() as cur:
        cur.execute("""
            SELECT id, name, parent_id, subject, user_id
            FROM docs.folders
            WHERE id IN ('23158da0-dd82-4b28-835a-e459986a9cb1', '36709f17-4f8d-4c4a-95f5-0010ad717dcf');
        """)
        rows = cur.fetchall()
        print("Folders:")
        for r in rows:
            print(f"ID: {r[0]} | Name: {r[1]} | Parent: {r[2]} | Subject: {r[3]} | User: {r[4]}")
except Exception as e:
    print("Error:", e)
