import os
import json
from decimal import Decimal
from openai import OpenAI
from typing import List, Dict, Any
from tenacity import retry, stop_after_attempt, wait_exponential


def _json_default(obj):
    """Xử lý các kiểu dữ liệu Postgres trả về (Decimal, ...) mà json.dumps mặc định không serialize được."""
    if isinstance(obj, Decimal):
        return float(obj)
    raise TypeError(f"Object of type {obj.__class__.__name__} is not JSON serializable")

# --- Đã đổi sang dùng Gemini qua lớp tương thích OpenAI ---
# OPENAI_API_KEY trong .env giờ sẽ là API key của Gemini (lấy tại https://aistudio.google.com/apikey)
client = OpenAI(
    api_key=os.getenv("OPENAI_API_KEY"),
    base_url="https://generativelanguage.googleapis.com/v1beta/openai/"
)
LLM_MODEL = os.getenv("LLM_MODEL", "gemini-2.5-flash")

async def generate_answer_stream(query: str, retrieved_chunks: List[Dict[str, Any]]):
    context_text = "\n\n".join([f"[{i+1}] {chunk['content']}" for i, chunk in enumerate(retrieved_chunks)])

    system_prompt = (
        "Bạn là trợ lý AI. Chỉ trả lời dựa trên thông tin trong các đoạn văn bản dưới đây. "
        "Nếu không có thông tin, nói \"Tôi không tìm thấy thông tin phù hợp trong tài liệu của bạn.\"\n"
        "--- Ngữ cảnh ---\n"
        f"{context_text}"
    )

    user_prompt = f"--- Câu hỏi ---\n{query}"

    response = client.chat.completions.create(
        model=LLM_MODEL,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ],
        temperature=0.3,
        stream=True
    )

    for chunk in response:
        if chunk.choices[0].delta.content:
            yield chunk.choices[0].delta.content

    sources_metadata = json.dumps({"sources": retrieved_chunks}, default=_json_default)
    yield f"\n\n[SOURCES]\n{sources_metadata}\n\n"

import openai
from tenacity import retry_if_exception

def is_retryable_exception(exception):
    # Retry on rate limit errors (429) or temporary server errors (5xx/503) or connection errors
    if isinstance(exception, openai.RateLimitError):
        return True
    if isinstance(exception, openai.APIConnectionError):
        return True
    if isinstance(exception, openai.APIStatusError):
        return exception.status_code is not None and exception.status_code >= 500
    return False

@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=2, max=10),
    retry=retry_if_exception(is_retryable_exception),
    reraise=True
)
def generate_flashcards_from_text(text: str, count: int = 5) -> List[dict]:
    system_prompt = (
        f"Generate exactly {count} high-quality educational flashcards based strictly on the text below. "
        "Return a clean JSON object containing an array of flashcards with 'question' and 'answer' keys."
    )

    calculated_max_output = min(65536, count * 200 + 1000)

    response = client.chat.completions.create(
        model=LLM_MODEL,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": text}
        ],
        temperature=0.3,
        max_tokens=calculated_max_output,
        response_format={"type": "json_object"},
        timeout=50.0
    )

    content = response.choices[0].message.content
    try:
        parsed_data = json.loads(content)
        flashcards_array = []

        # Extract the array from the JSON object
        for key, value in parsed_data.items():
            if isinstance(value, list):
                flashcards_array = value
                break

        if not flashcards_array and isinstance(parsed_data, list):
            flashcards_array = parsed_data

        valid_flashcards = []
        for item in flashcards_array:
            if isinstance(item, dict) and "question" in item and "answer" in item:
                if item["question"] and item["answer"]:
                    valid_flashcards.append(item)

        return valid_flashcards
    except Exception as e:
        raise Exception(f"Failed to parse JSON response: {e}")