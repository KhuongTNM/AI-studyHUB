import psycopg2

db_url = "postgresql://postgres.linlkncislhstvhousud:!AI-studyHUB@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres?sslmode=require"

try:
    conn = psycopg2.connect(db_url)
    with conn.cursor() as cur:
        cur.execute("""
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns
            WHERE table_schema = 'docs' AND table_name = 'documents';
        """)
        cols = cur.fetchall()
        print("docs.documents columns:")
        for c in cols:
            print(f"  {c[0]} ({c[1]}, nullable: {c[2]})")
            
        cur.execute("""
            SELECT conname, pg_get_constraintdef(oid)
            FROM pg_constraint
            WHERE conrelid = 'docs.documents'::regclass;
        """)
        cons = cur.fetchall()
        print("\nConstraints:")
        for cn, definition in cons:
            print(f"  {cn}: {definition}")
            
except Exception as e:
    print("Error:", e)
