from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List
from services.vector_store import get_document_chunks
from services.chunking import build_context_within_budget
from services.llm_service import (
    generate_flashcards_from_text,
    LLMQuotaExhaustedError,
    LLMContentSafetyBlockedError,
)

router = APIRouter()

class GenerateFlashcardsRequest(BaseModel):
    document_id: str
    user_id: str
    count: int = 5
    # BR-100/BR-102 (Flashcard AI Batching): câu hỏi đã sinh ở các batch trước trong cùng
    # lượt tạo (tầng Java gửi sang, đã chuẩn hoá lowercase/bỏ dấu câu) — dùng để nhắc model
    # tránh sinh trùng lặp giữa các batch. Không bắt buộc, mặc định rỗng.
    existing_questions: List[str] = []

class FlashcardItem(BaseModel):
    question: str
    answer: str

@router.post("/generate", response_model=List[FlashcardItem])
def generate_flashcards(request: GenerateFlashcardsRequest):
    chunks = get_document_chunks(request.document_id, request.user_id)
    if not chunks:
        raise HTTPException(status_code=400, detail="Document chunks not found.")

    context = build_context_within_budget(chunks)
    if not context:
        raise HTTPException(status_code=400, detail="Document has no valid text chunks to process.")

    try:
        items = generate_flashcards_from_text(
            context,
            count=request.count,
            existing_questions=request.existing_questions,
        )
    except LLMQuotaExhaustedError as e:
        # BR-104.2: toàn bộ provider Gemini/Cerebras trong chuỗi fallback đều bị rate-limit/hết quota.
        raise HTTPException(status_code=429, detail=str(e))
    except LLMContentSafetyBlockedError as e:
        # BR-104.3: nội dung bị chặn bởi chính sách an toàn — không phải lỗi hạ tầng tạm thời,
        # không nên gợi ý người dùng "thử lại" với cùng tài liệu.
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        # Lỗi parse JSON hoặc lỗi hạ tầng khác chưa phân loại được — nhóm "lỗi hạ tầng tạm thời"
        # theo BR-104 (khác với 2 nhóm lỗi có nguyên nhân rõ ràng ở trên).
        raise HTTPException(status_code=500, detail=f"Failed to generate flashcards: {str(e)}")

    if not items:
        raise HTTPException(status_code=500, detail="Failed to generate flashcards: No valid items found.")

    return [{"question": item["question"], "answer": item["answer"]} for item in items]
