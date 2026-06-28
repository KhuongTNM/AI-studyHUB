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

def search_similar_chunks(query_embedding: List[float], user_id: str, document_id: Optional[str] = None, top_k: int = 5) -> List[Dict[str, Any]]:
    conn = None
    try:
        conn = get_connection()
        with conn.cursor() as cur:
            if document_id:
                query = """
                    SELECT chunk_index, content, document_id, (1 - (embedding <=> %s::vector)) AS score
                    FROM ai.document_chunks
                    WHERE user_id = %s AND document_id = %s
                    ORDER BY embedding <=> %s::vector
                    LIMIT %s
                """
                cur.execute(query, (query_embedding, user_id, document_id, query_embedding, top_k))
            else:
                query = """
                    SELECT chunk_index, content, document_id, (1 - (embedding <=> %s::vector)) AS score
                    FROM ai.document_chunks
                    WHERE user_id = %s
                    ORDER BY embedding <=> %s::vector
                    LIMIT %s
                """
                cur.execute(query, (query_embedding, user_id, query_embedding, top_k))
            
            results = cur.fetchall()
            
            return [
                {
                    "chunk_index": row[0],
                    "content": row[1],
                    "document_id": str(row[2]),
                    "score": row[3]
                }
                for row in results
            ]
    except Exception as e:
        logger.error(f"Error searching vector store: {e}")
        raise
    finally:
        release_connection(conn)
