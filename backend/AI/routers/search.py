"""
POST /search
    Java backend forward request tìm kiếm vào đây.
    Python lo: embed query → tìm pgvector → gọi LLM → trả kết quả.
"""

from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional

from services import embedding, vector_store, llm_service

router = APIRouter()


class SearchRequest(BaseModel):
    query:       str
    user_id:     str
    document_id: Optional[str] = None
    top_k:       int = 5


class SearchResponse(BaseModel):
    answer:  str              # câu trả lời từ LLM
    sources: list[dict]       # các chunks liên quan (để frontend hiển thị nguồn)


@router.post("/search", response_model=SearchResponse)
def search(req: SearchRequest) -> SearchResponse:
    """
    RAG pipeline:
        1. Embed câu hỏi
        2. Tìm top_k chunks liên quan trong pgvector
        3. Gửi chunks + câu hỏi vào LLM
        4. Trả về câu trả lời + nguồn tham khảo
    """
    # 1. Embed query
    query_vec = embedding.embed(req.query)

    # 2. Retrieve chunks từ pgvector
    chunks = vector_store.search(
        query_vector=query_vec,
        user_id=req.user_id,
        top_k=req.top_k,
        document_id=req.document_id or None,
    )

    if not chunks:
        return SearchResponse(
            answer="Không tìm thấy thông tin liên quan trong tài liệu của bạn.",
            sources=[],
        )

    # 3. Gọi LLM sinh câu trả lời
    answer_text = llm_service.answer(req.query, chunks)

    # 4. Trả về
    return SearchResponse(
        answer=answer_text,
        sources=chunks,
    )
