import os
import json
from decimal import Decimal
from openai import OpenAI
from typing import List, Dict, Any


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
