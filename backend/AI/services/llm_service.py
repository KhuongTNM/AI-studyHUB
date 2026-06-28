"""
Phần Generation của RAG:
    Lấy danh sách chunks liên quan → ghép làm context → gửi vào LLM → trả lời.
"""

import os
from openai import OpenAI

_client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
_LLM_MODEL = os.getenv("LLM_MODEL", "gpt-4o-mini")

_SYSTEM_PROMPT = """Bạn là trợ lý học tập thông minh của AI Study Hub.
Dựa vào các đoạn tài liệu được cung cấp trong [CONTEXT], hãy trả lời câu hỏi của người dùng một cách chính xác và ngắn gọn.
Nếu thông tin không có trong context, hãy nói rõ là bạn không tìm thấy thông tin đó trong tài liệu."""


def answer(query: str, context_chunks: list[dict]) -> str:
    """
    Sinh câu trả lời từ query + danh sách chunks liên quan.

    Args:
        query:          câu hỏi của user
        context_chunks: list dict từ vector_store.search()
                        mỗi dict có key "content"

    Returns:
        Chuỗi câu trả lời từ LLM.
    """
    # Ghép các chunks thành 1 context block
    context_text = "\n\n---\n\n".join(
        f"[Đoạn {i + 1}]:\n{c['content']}"
        for i, c in enumerate(context_chunks)
    )

    messages = [
        {"role": "system", "content": _SYSTEM_PROMPT},
        {
            "role": "user",
            "content": f"[CONTEXT]\n{context_text}\n\n[CÂU HỎI]\n{query}",
        },
    ]

    response = _client.chat.completions.create(
        model=_LLM_MODEL,
        messages=messages,
        temperature=0.2,      # thấp để câu trả lời bám sát context
        max_tokens=1024,
    )

    return response.choices[0].message.content
