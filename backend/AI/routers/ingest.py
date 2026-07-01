import os
import logging
import tempfile
import requests
from fastapi import APIRouter, BackgroundTasks, HTTPException
from pydantic import BaseModel
from services.text_extractor import extract_text
from services.chunking import recursive_chunk_text, semantic_chunk_text
from services.embedding import process_chunks
from services.vector_store import insert_chunks, delete_chunks, get_connection, release_connection

router = APIRouter()
logger = logging.getLogger(__name__)


class IngestRequest(BaseModel):
    document_id: str
    file_url: str
    user_id: str
    file_type: str


def update_document_status(document_id: str, status: str):
    conn = None
    try:
        conn = get_connection()
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE docs.documents SET embedding_status = %s WHERE id = %s",
                (status, document_id)
            )
        conn.commit()
    except Exception as e:
        if conn:
            conn.rollback()
        logger.error(f"Error updating status for document {document_id}: {e}")
    finally:
        release_connection(conn)


def download_file(file_url: str, suffix: str) -> str:
    """
    Tải file từ Supabase Storage (hoặc bất kỳ URL http/https công khai nào)
    về một file tạm trên đĩa local của service Python để xử lý (extract text).
    Dùng URL thay vì đường dẫn đĩa local vì Java và Python là 2 service
    riêng biệt trên Render, không chia sẻ filesystem với nhau.
    """
    response = requests.get(file_url, timeout=60)
    response.raise_for_status()

    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=suffix)
    tmp.write(response.content)
    tmp.close()
    return tmp.name


def worker(document_id: str, file_url: str, user_id: str, file_type: str):
    tmp_path = None
    try:
        logger.info(f"Starting background ingest for document {document_id}")

        # 1. Delete pre-existing chunks for idempotency
        delete_chunks(document_id)

        # 2. Tải file từ Supabase Storage về file tạm local
        suffix = f".{file_type.lower().strip('.')}" if file_type else ""
        tmp_path = download_file(file_url, suffix)

        # 3. Extract, chunk, embed, insert
        text = extract_text(tmp_path, file_type)
        if not text:
            raise ValueError("No text extracted from file.")

        # Route chunking based on feature flag
        semantic_enabled = os.getenv("SEMANTIC_CHUNKING_ENABLED", "false").lower() == "true"
        if semantic_enabled:
            # Note: Embedding sentences for breakpoints and re-embedding full chunks later
            # is acceptable for this iteration.
            chunks = semantic_chunk_text(text)
        else:
            chunks = recursive_chunk_text(text)

        if not chunks:
            raise ValueError("No chunks generated from text.")

        processed_chunks = process_chunks(chunks)
        insert_chunks(document_id, user_id, processed_chunks)

        # 4. Update status to done
        update_document_status(document_id, 'done')
        logger.info(f"Successfully processed document {document_id}")

    except Exception as e:
        logger.error(f"Ingest worker failed for document {document_id}: {e}", exc_info=True)
        update_document_status(document_id, 'failed')
    finally:
        if tmp_path and os.path.exists(tmp_path):
            try:
                os.remove(tmp_path)
            except OSError:
                pass


@router.post("/ingest", status_code=202)
def ingest_document(request: IngestRequest, background_tasks: BackgroundTasks):
    try:
        # Synchronously update status to processing
        update_document_status(request.document_id, 'processing')

        # Trigger standard synchronous worker
        background_tasks.add_task(
            worker,
            request.document_id,
            request.file_url,
            request.user_id,
            request.file_type
        )
        return {"message": "Accepted"}
    except Exception as e:
        logger.error(f"Error in /ingest endpoint: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")
