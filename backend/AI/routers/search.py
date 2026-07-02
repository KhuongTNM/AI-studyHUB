import logging
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional
from services.embedding import generate_embedding
from services.vector_store import search_similar_chunks
from services.llm_service import generate_answer_stream

router = APIRouter()
logger = logging.getLogger(__name__)

class SearchRequest(BaseModel):
    query: str
    user_id: str
    document_id: Optional[str] = None
    top_k: int = 5

@router.post("/search")
async def search_documents(request: SearchRequest):
    try:
        # 1. Generate embedding for query
        query_embedding = generate_embedding(request.query)
        if not query_embedding:
            raise ValueError("Could not generate embedding for query.")
            
        # 2. Search similar chunks (Hybrid search uses query_text)
        chunks = search_similar_chunks(
            query_embedding=query_embedding,
            user_id=request.user_id,
            document_id=request.document_id,
            top_k=request.top_k,
            query_text=request.query
        )
        
        # 3. Stream answer using LLM
        return StreamingResponse(
            generate_answer_stream(request.query, chunks),
            media_type="text/event-stream"
        )
    except Exception as e:
        logger.error(f"Error in /search endpoint: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error")
