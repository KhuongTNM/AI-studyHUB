import psycopg2
import sys

if sys.platform.startswith('win'):
    sys.stdout.reconfigure(encoding='utf-8')

db_url = "postgresql://postgres.linlkncislhstvhousud:!AI-studyHUB@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres?sslmode=require"

try:
    conn = psycopg2.connect(db_url)
    with conn.cursor() as cur:
        # Find all docs stuck in uploading/scanning for more than 10 minutes
        cur.execute("""
            SELECT id, original_name, status, updated_at
            FROM docs.documents
            WHERE status IN ('uploading', 'scanning')
            AND updated_at < NOW() - INTERVAL '10 minutes';
        """)
        rows = cur.fetchall()
        print(f"Found {len(rows)} stuck documents:")
        for r in rows:
            print(f"  ID: {r[0]} | Name: {r[1]} | Status: {r[2]} | Updated: {r[3]}")
        
        if rows:
            # Update them to 'ready'
            cur.execute("""
                UPDATE docs.documents
                SET status = 'ready', updated_at = NOW()
                WHERE status IN ('uploading', 'scanning')
                AND updated_at < NOW() - INTERVAL '10 minutes';
            """)
            conn.commit()
            print(f"\nUpdated {cur.rowcount} documents to 'ready'.")
        else:
            print("No stuck documents found.")
            
except Exception as e:
    print("Error:", e)
