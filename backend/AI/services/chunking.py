"""
Chia text thành các chunk theo chiến lược 2 cấp:
    1. Cắt theo đoạn văn  (\\n\\n)
    2. Trong đoạn dài → cắt theo câu, luôn cắt SAU dấu [. , ? ! ; :]
       → không bao giờ để 2 chunk nối chuỗi thông tin với nhau.
"""

import re

MAX_CHUNK_CHARS = 800   # ~200 token
MIN_CHUNK_CHARS = 80    # chunk nhỏ hơn sẽ gộp vào chunk trước

# Tách câu: split SAU dấu câu, giữ dấu lại ở câu trước
_SENTENCE_SPLIT = re.compile(r"(?<=[.?!;:,])(?=\s+|$)")


def chunk(full_text: str) -> list[str]:
    """
    Trả về danh sách các chunk từ full_text.
    """
    if not full_text or not full_text.strip():
        return []

    paragraphs = re.split(r"\n\n+", full_text)
    result: list[str] = []

    for para in paragraphs:
        para = para.strip()
        if not para:
            continue

        if len(para) <= MAX_CHUNK_CHARS:
            _merge_or_add(result, para)
        else:
            for sc in _chunk_by_sentence(para):
                _merge_or_add(result, sc)

    return [c.strip() for c in result if c.strip()]


# ──────────────────────────────────────────────────────────────────────
# Tách theo câu
# ──────────────────────────────────────────────────────────────────────

def _chunk_by_sentence(paragraph: str) -> list[str]:
    sentences = [s.strip() for s in _SENTENCE_SPLIT.split(paragraph) if s.strip()]
    chunks: list[str] = []
    buffer = ""

    for sentence in sentences:
        if len(sentence) > MAX_CHUNK_CHARS:
            # Câu đơn lẻ đã quá dài → hard split
            if buffer:
                chunks.append(buffer.strip())
                buffer = ""
            chunks.extend(_hard_split(sentence))
            continue

        pending = len(sentence) if not buffer else len(buffer) + 1 + len(sentence)

        if pending <= MAX_CHUNK_CHARS:
            buffer = sentence if not buffer else f"{buffer} {sentence}"
        else:
            # Hết chỗ → đóng chunk NGAY tại đây, câu hiện tại sang chunk mới
            if buffer:
                chunks.append(buffer.strip())
            buffer = sentence

    if buffer:
        chunks.append(buffer.strip())

    return chunks


def _hard_split(text: str) -> list[str]:
    """Cắt cứng tại khoảng trắng gần nhất, không cắt giữa từ."""
    parts = []
    start = 0
    while start < len(text):
        end = min(start + MAX_CHUNK_CHARS, len(text))
        if end < len(text):
            space = text.rfind(" ", start, end)
            if space > start:
                end = space
        parts.append(text[start:end].strip())
        start = end + 1
    return parts


# ──────────────────────────────────────────────────────────────────────
# Gộp chunk nhỏ
# ──────────────────────────────────────────────────────────────────────

def _merge_or_add(chunks: list[str], text: str) -> None:
    if chunks and len(text) < MIN_CHUNK_CHARS:
        last = chunks[-1]
        if len(last) + 1 + len(text) <= MAX_CHUNK_CHARS:
            chunks[-1] = f"{last} {text}"
            return
    chunks.append(text)
