"""
POST /ingest
    Java backend gọi endpoint này sau khi Document status = READY.
    Python tự lo toàn bộ: extract → chunk → embed → lưu pgvector.
"""

import os
import logging
from fastapi import APIRouter, BackgroundTasks, HTTPException
from pydantic import BaseModel

from services import text_extractor, chunking, embedding, vector_store

router = APIRouter()
logger = logging.getLogger(__name__)

UPLOAD_DIR = os.getenv("UPLOAD_DIR", "./uploads")


class IngestRequest(BaseModel):
    document_id: str
    # file_url và user_id sẽ được Python tự query từ DB
    # (hoặc Java truyền thêm vào nếu muốn tránh thêm DB query)
    file_url:  str
    user_id:   str
    file_type: str   # "pdf" | "docx" | "pptx"


@router.post("/ingest", status_code=202)
async def ingest(req: IngestRequest, background_tasks: BackgroundTasks):
    """
    Nhận request từ Java → xử lý async ở background.
    Trả về 202 Accepted ngay để không block Java.
    """
    background_tasks.add_task(_run_ingestion, req)
    return {"message": "Ingestion started", "document_id": req.document_id}


# ──────────────────────────────────────────────────────────────────────
# Pipeline
# ──────────────────────────────────────────────────────────────────────

def _run_ingestion(req: IngestRequest) -> None:
    doc_id = req.document_id
    logger.info("[Ingest] Start document_id=%s", doc_id)

    try:
        vector_store.update_embedding_status(doc_id, "processing")

        # 1. Resolve đường dẫn file
        file_name = req.file_url.replace("uploads/", "", 1)
        file_path = os.path.join(UPLOAD_DIR, file_name)

        # 2. Extract text
        full_text = text_extractor.extract(file_path, req.file_type)
        if not full_text.strip():
            logger.warning("[Ingest] No text extracted: %s", doc_id)
            vector_store.update_embedding_status(doc_id, "done")
            return
        logger.info("[Ingest] Extracted %d chars", len(full_text))

        # 3. Chunk theo đoạn → câu
        chunks = chunking.chunk(full_text)
        logger.info("[Ingest] %d chunks created", len(chunks))

        # 4. Embed tất cả chunks trong 1 batch call
        vectors = embedding.embed_many(chunks)

        # 5. Lưu vào ai.document_chunks
        vector_store.save_chunks(doc_id, req.user_id, chunks, vectors)

        vector_store.update_embedding_status(doc_id, "done")
        logger.info("[Ingest] Done document_id=%s", doc_id)

    except Exception as e:
        logger.error("[Ingest] Failed document_id=%s: %s", doc_id, str(e), exc_info=True)
        vector_store.update_embedding_status(doc_id, "failed")
