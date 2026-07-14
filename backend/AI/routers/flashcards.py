from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List
import openai
from services.vector_store import get_document_chunks
from services.chunking import build_context_within_budget
from services.llm_service import generate_flashcards_from_text

router = APIRouter()

class GenerateFlashcardsRequest(BaseModel):
    document_id: str
    user_id: str
    count: int = 5

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
        items = generate_flashcards_from_text(context, count=request.count)
    except openai.RateLimitError as e:
        raise HTTPException(
            status_code=429,
            detail="AI service rate limit exceeded. Please try again in a moment."
        )
    except openai.APIStatusError as e:
        status_code = e.status_code if e.status_code else 500
        raise HTTPException(
            status_code=status_code,
            detail=f"AI service error: {e.message}"
        )
    except openai.APIConnectionError as e:
        raise HTTPException(
            status_code=503,
            detail="Failed to connect to the AI service."
        )
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Failed to parse structured flashcards: {str(e)}")

    if not items:
        raise HTTPException(status_code=422, detail="Failed to parse structured flashcards: No valid items found.")

    return [{"question": item["question"], "answer": item["answer"]} for item in items]