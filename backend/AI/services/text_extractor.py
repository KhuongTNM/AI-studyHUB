"""
Trích xuất text thuần từ file PDF / DOCX / PPTX.

Thư viện:
    PDF  → pdfplumber
    DOCX → python-docx
    PPTX → python-pptx
"""

import re
from pathlib import Path

import pdfplumber
from docx import Document
from pptx import Presentation


def extract(file_path: str, file_type: str) -> str:
    """
    Trích xuất toàn bộ text từ file.

    Args:
        file_path: đường dẫn tuyệt đối tới file
        file_type: "pdf" | "docx" | "pptx"

    Returns:
        Chuỗi text đã normalize, các đoạn phân tách bằng "\\n\\n"
    """
    ft = file_type.lower()
    if ft == "pdf":
        raw = _extract_pdf(file_path)
    elif ft == "docx":
        raw = _extract_docx(file_path)
    elif ft == "pptx":
        raw = _extract_pptx(file_path)
    else:
        raise ValueError(f"Unsupported file type: {file_type}")

    return _normalize(raw)


# ──────────────────────────────────────────────────────────────────────
# PDF
# ──────────────────────────────────────────────────────────────────────

def _extract_pdf(path: str) -> str:
    parts = []
    with pdfplumber.open(path) as pdf:
        for page in pdf.pages:
            text = page.extract_text()
            if text:
                parts.append(text)
    return "\n\n".join(parts)


# ──────────────────────────────────────────────────────────────────────
# DOCX
# ──────────────────────────────────────────────────────────────────────

def _extract_docx(path: str) -> str:
    doc = Document(path)
    paragraphs = [p.text.strip() for p in doc.paragraphs if p.text.strip()]
    return "\n\n".join(paragraphs)


# ──────────────────────────────────────────────────────────────────────
# PPTX
# ──────────────────────────────────────────────────────────────────────

def _extract_pptx(path: str) -> str:
    prs = Presentation(path)
    parts = []
    for slide in prs.slides:
        for shape in slide.shapes:
            if hasattr(shape, "text") and shape.text.strip():
                parts.append(shape.text.strip())
    return "\n\n".join(parts)


# ──────────────────────────────────────────────────────────────────────
# Normalize
# ──────────────────────────────────────────────────────────────────────

def _normalize(text: str) -> str:
    """Chuẩn hóa whitespace: gộp nhiều dòng trống → \\n\\n, trim."""
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    text = re.sub(r"\n{3,}", "\n\n", text)   # 3+ newlines → 2
    text = re.sub(r"[ \t]+", " ", text)       # nhiều space → 1
    return text.strip()
