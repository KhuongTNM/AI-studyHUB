import os
import logging
from fastapi import APIRouter, BackgroundTasks, HTTPException
from pydantic import BaseModel
from services.text_extractor import extract_text
from services.chunking import chunk_text
from services.embedding import process_chunks
from services.vector_store import insert_chunks, delete_chunks, get_connection, release_connection

router = APIRouter()
logger = logging.getLogger(__name__)

UPLOAD_DIR = os.getenv("UPLOAD_DIR", "../uploads")

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

def worker(document_id: str, file_url: str, user_id: str, file_type: str):
    try:
        logger.info(f"Starting background ingest for document {document_id}")
        
        # 1. Delete pre-existing chunks for idempotency
        delete_chunks(document_id)
        
        # 2. Resolve file path
        filename = os.path.basename(file_url)
        file_path = os.path.join(UPLOAD_DIR, filename)
        
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"File not found: {file_path}")
            
        # 3. Extract, chunk, embed, insert
        text = extract_text(file_path, file_type)
        if not text:
            raise ValueError("No text extracted from file.")
            
        chunks = chunk_text(text)
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
