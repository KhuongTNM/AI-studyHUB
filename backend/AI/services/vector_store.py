import os
import logging
from typing import List, Dict, Optional, Any
from psycopg2 import pool

logger = logging.getLogger(__name__)

DATABASE_URL = os.getenv("DATABASE_URL")

# Initialize connection pool
try:
    db_pool = pool.ThreadedConnectionPool(1, 20, DATABASE_URL)
except Exception as e:
    logger.error(f"Failed to create database connection pool: {e}")
    db_pool = None

def get_connection():
    if not db_pool:
        raise Exception("Database connection pool is not initialized.")
    return db_pool.getconn()

def release_connection(conn):
    if db_pool and conn:
        db_pool.putconn(conn)

def delete_chunks(document_id: str):
    conn = None
    try:
        conn = get_connection()
        with conn.cursor() as cur:
            cur.execute(
                "DELETE FROM ai.document_chunks WHERE document_id = %s",
                (document_id,)
            )
        conn.commit()
    except Exception as e:
        if conn:
            conn.rollback()
        logger.error(f"Error deleting chunks for document {document_id}: {e}")
        raise
    finally:
        release_connection(conn)

def insert_chunks(document_id: str, user_id: str, chunks: List[Dict[str, Any]]):
    conn = None
    try:
        conn = get_connection()
        with conn.cursor() as cur:
            insert_query = """
                INSERT INTO ai.document_chunks 
                (document_id, user_id, chunk_index, content, token_count, embedding) 
                VALUES (%s, %s, %s, %s, %s, %s)
                ON CONFLICT (document_id, chunk_index) DO NOTHING
            """
            for chunk in chunks:
                cur.execute(insert_query, (
                    document_id,
                    user_id,
                    chunk["chunk_index"],
                    chunk["content"],
                    chunk.get("token_count"),
                    chunk.get("embedding")
                ))
        conn.commit()
    except Exception as e:
        if conn:
            conn.rollback()
        logger.error(f"Error inserting chunks for document {document_id}: {e}")
        raise
    finally:
        release_connection(conn)

HYBRID_SEARCH_ENABLED = os.getenv("HYBRID_SEARCH_ENABLED", "true").lower() == "true"

def search_similar_chunks(query_embedding: List[float], user_id: str, document_id: Optional[str] = None, top_k: int = 5, query_text: str = "") -> List[Dict[str, Any]]:
    conn = None
    try:
        conn = get_connection()
        with conn.cursor() as cur:
            if HYBRID_SEARCH_ENABLED and query_text:
                query = """
                    WITH vector_search AS (
                        SELECT id, document_id, chunk_index, content,
                               ROW_NUMBER() OVER (ORDER BY embedding OPERATOR(ai.<=>) %s::ai.vector) as rank
                        FROM ai.document_chunks
                        WHERE user_id = %s::uuid AND (%s::uuid IS NULL OR document_id = %s::uuid)
                        LIMIT 20
                    ),
                    fts_search AS (
                        SELECT id, document_id, chunk_index, content,
                               ROW_NUMBER() OVER (ORDER BY ts_rank_cd(fts, websearch_to_tsquery('simple', %s)) DESC) as rank
                        FROM ai.document_chunks
                        WHERE user_id = %s::uuid AND (%s::uuid IS NULL OR document_id = %s::uuid) AND fts @@ websearch_to_tsquery('simple', %s)
                        LIMIT 20
                    )
                    SELECT COALESCE(v.id, f.id) as id,
                           COALESCE(v.document_id, f.document_id) as document_id,
                           COALESCE(v.chunk_index, f.chunk_index) as chunk_index,
                           COALESCE(v.content, f.content) as content,
                           (COALESCE(1.0 / (60.0 + v.rank), 0.0) + COALESCE(1.0 / (60.0 + f.rank), 0.0)) as score
                    FROM vector_search v
                    FULL OUTER JOIN fts_search f ON v.id = f.id
                    ORDER BY score DESC
                    LIMIT %s;
                """
                cur.execute(query, (
                    query_embedding, user_id, document_id, document_id,
                    query_text, user_id, document_id, document_id, query_text,
                    top_k
                ))
            else:
                query = """
                    SELECT id, document_id, chunk_index, content, (1 - (embedding OPERATOR(ai.<=>) %s::ai.vector)) AS score
                    FROM ai.document_chunks
                    WHERE user_id = %s::uuid AND (%s::uuid IS NULL OR document_id = %s::uuid)
                    ORDER BY embedding OPERATOR(ai.<=>) %s::ai.vector
                    LIMIT %s
                """
                cur.execute(query, (query_embedding, user_id, document_id, document_id, query_embedding, top_k))
            
            results = cur.fetchall()
            
            return [
                {
                    "chunk_index": row[2],
                    "content": row[3],
                    "document_id": str(row[1]),
                    "score": row[4]
                }
                for row in results
            ]
    except Exception as e:
        logger.error(f"Error searching vector store: {e}")
        raise
    finally:
        release_connection(conn)
