import psycopg2

db_url_no_ssl = "postgresql://postgres.qpwnqtvxthaybzqxjwnm:!AI-studyHUB@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres"

try:
    print("Connecting without sslmode=require...")
    conn = psycopg2.connect(db_url_no_ssl)
    print("Connection without sslmode=require successful!")
    conn.close()
except Exception as e:
    print(f"Connection without sslmode=require failed: {e}")
