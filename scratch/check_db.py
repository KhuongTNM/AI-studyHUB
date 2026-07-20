import os
import sys
import psycopg2

db_url = "postgresql://postgres.linlkncislhstvhousud:!AI-studyHUB@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres?sslmode=require"

try:
    conn = psycopg2.connect(db_url)
    with conn.cursor() as cur:
        # Check documents
        cur.execute("SELECT COUNT(*) FROM docs.documents")
        doc_count = cur.fetchone()[0]
        print(f"Total documents in docs.documents: {doc_count}")

        cur.execute("SELECT id, original_name, status, embedding_status, file_size_bytes FROM docs.documents LIMIT 10")
        docs = cur.fetchall()
        print("\nLatest 10 documents:")
        for doc in docs:
            print(f"ID: {doc[0]} | Name: {doc[1]} | Status: {doc[2]} | Embedding Status: {doc[3]} | Size: {doc[4]} bytes")

        # Check document_chunks
        cur.execute("SELECT COUNT(*), COUNT(embedding) FROM ai.document_chunks")
        chunk_count, embed_count = cur.fetchone()
        print(f"\nTotal chunks in ai.document_chunks: {chunk_count}")
        print(f"Chunks with non-null embedding: {embed_count}")

        if chunk_count > 0:
            cur.execute("SELECT id, document_id, chunk_index, token_count, length(content) FROM ai.document_chunks LIMIT 5")
            chunks = cur.fetchall()
            print("\nFirst 5 chunks details:")
            for ch in chunks:
                print(f"ID: {ch[0]} | DocID: {ch[1]} | Index: {ch[2]} | Token count: {ch[3]} | Content length: {ch[4]}")
                
            cur.execute("SELECT embedding FROM ai.document_chunks WHERE embedding IS NOT NULL LIMIT 1")
            row = cur.fetchone()
            if row:
                embedding_sample = row[0]
                print(f"\nSample embedding type: {type(embedding_sample)}")
                # Convert to string or check dimensions
                # pgvector returns list of floats or string in psycopg2 depending on how it's registered
                print(f"Sample embedding length/repr: {len(embedding_sample) if hasattr(embedding_sample, '__len__') else repr(embedding_sample)[:100]}")

except Exception as e:
    print(f"Error querying database: {e}", file=sys.stderr)
