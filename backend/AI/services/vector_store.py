"""
Lưu chunks + embeddings vào ai.document_chunks (pgvector)
và tìm kiếm theo cosine similarity.
"""

import os
from typing import Optional
import psycopg2
from psycopg2.extras import execute_values

_DB_URL = os.getenv("DATABASE_URL")


def _conn():
    return psycopg2.connect(_DB_URL)


# ──────────────────────────────────────────────────────────────────────
# Lưu chunks
# ──────────────────────────────────────────────────────────────────────

def save_chunks(
    document_id: str,
    user_id: str,
    chunks: list[str],
    embeddings: list[list[float]],
) -> None:
    """
    Xóa chunks cũ rồi insert toàn bộ chunks mới cho document.

    Args:
        document_id: UUID string
        user_id:     UUID string
        chunks:      danh sách text chunks
        embeddings:  danh sách vector tương ứng (cùng thứ tự)
    """
    rows = [
        (
            document_id,
            user_id,
            idx,
            content,
            max(1, len(content) // 4),          # ước tính token
            _to_pgvector(embeddings[idx]),        # "[x1,x2,...]"
        )
        for idx, content in enumerate(chunks)
    ]

    with _conn() as conn, conn.cursor() as cur:
        # Xóa chunks cũ (re-process)
        cur.execute(
            "DELETE FROM ai.document_chunks WHERE document_id = %s",
            (document_id,),
        )
        # Insert tất cả trong 1 lần
        execute_values(
            cur,
            """
            INSERT INTO ai.document_chunks
                (document_id, user_id, chunk_index, content, token_count, embedding)
            VALUES %s
            """,
            rows,
        )
        conn.commit()


# ──────────────────────────────────────────────────────────────────────
# Tìm kiếm
# ──────────────────────────────────────────────────────────────────────

def search(
    query_vector: list[float],
    user_id: str,
    top_k: int = 5,
    document_id: Optional[str] = None,
) -> list[dict]:
    """
    Tìm top_k chunks gần nhất theo cosine distance.

    Args:
        query_vector: vector đã embed của câu hỏi
        user_id:      giới hạn theo user
        top_k:        số kết quả trả về
        document_id:  (tùy chọn) giới hạn trong 1 document cụ thể

    Returns:
        Danh sách dict: {chunk_index, content, document_id, score}
    """
    vec_str = _to_pgvector(query_vector)

    if document_id:
        sql = """
            SELECT chunk_index,
                   content,
                   document_id::text,
                   1 - (embedding <=> %s::vector) AS score
            FROM   ai.document_chunks
            WHERE  document_id = %s
              AND  embedding IS NOT NULL
            ORDER BY embedding <=> %s::vector
            LIMIT  %s
        """
        params = (vec_str, document_id, vec_str, top_k)
    else:
        sql = """
            SELECT chunk_index,
                   content,
                   document_id::text,
                   1 - (embedding <=> %s::vector) AS score
            FROM   ai.document_chunks
            WHERE  user_id = %s
              AND  embedding IS NOT NULL
            ORDER BY embedding <=> %s::vector
            LIMIT  %s
        """
        params = (vec_str, user_id, vec_str, top_k)

    with _conn() as conn, conn.cursor() as cur:
        cur.execute(sql, params)
        rows = cur.fetchall()

    return [
        {
            "chunk_index": row[0],
            "content":     row[1],
            "document_id": row[2],
            "score":       round(float(row[3]), 4),
        }
        for row in rows
    ]


# ──────────────────────────────────────────────────────────────────────
# Update embedding_status trên bảng docs.documents
# ──────────────────────────────────────────────────────────────────────

def update_embedding_status(document_id: str, status: str) -> None:
    with _conn() as conn, conn.cursor() as cur:
        cur.execute(
            """
            UPDATE docs.documents
            SET    embedding_status = %s,
                   updated_at       = NOW()
            WHERE  id = %s
            """,
            (status, document_id),
        )
        conn.commit()


# ──────────────────────────────────────────────────────────────────────
# Helper
# ──────────────────────────────────────────────────────────────────────

def _to_pgvector(vec: list[float]) -> str:
    """Chuyển list[float] → chuỗi pgvector "[x1,x2,...]"."""
    return "[" + ",".join(str(v) for v in vec) + "]"
