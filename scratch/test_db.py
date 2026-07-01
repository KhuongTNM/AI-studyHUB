import os
import psycopg2
from dotenv import load_dotenv

dotenv_path = r"e:\test\v2\AI-studyHUB\backend\AI\.env"
load_dotenv(dotenv_path)

DATABASE_URL = os.getenv("DATABASE_URL")

try:
    conn = psycopg2.connect(DATABASE_URL)
    with conn.cursor() as cur:
        # Check vector type location
        cur.execute("SELECT typname, typnamespace::regnamespace FROM pg_type WHERE typname = 'vector';")
        print("\nVector Type Namespace:")
        for row in cur.fetchall():
            print(f" - {row[0]} (schema: {row[1]})")
    conn.close()
except Exception as e:
    print(f"Error: {e}")
