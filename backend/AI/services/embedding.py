"""
Gọi OpenAI Embeddings API để lấy vector cho text.
Model: text-embedding-3-small (1536 chiều).
"""

import os
from openai import OpenAI

_client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
_EMBED_MODEL = os.getenv("EMBED_MODEL", "text-embedding-3-small")


def embed(text: str) -> list[float]:
    """Trả về vector 1536 chiều cho 1 đoạn text."""
    response = _client.embeddings.create(
        model=_EMBED_MODEL,
        input=text,
    )
    return response.data[0].embedding


def embed_many(texts: list[str]) -> list[list[float]]:
    """
    Embed nhiều text trong 1 API call (OpenAI hỗ trợ batch input).
    Hiệu quả hơn gọi từng cái khi số lượng chunks lớn.
    """
    response = _client.embeddings.create(
        model=_EMBED_MODEL,
        input=texts,
    )
    # Đảm bảo trả về đúng thứ tự
    sorted_data = sorted(response.data, key=lambda d: d.index)
    return [d.embedding for d in sorted_data]
