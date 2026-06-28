import logging
import pdfplumber
import docx
import pptx

logger = logging.getLogger(__name__)

def extract_text_from_pdf(file_path: str) -> str:
    try:
        text_parts = []
        with pdfplumber.open(file_path) as pdf:
            for page in pdf.pages:
                extracted = page.extract_text()
                if extracted:
                    text_parts.append(extracted)
        return "\n".join(text_parts)
    except Exception as e:
        logger.error(f"Error extracting text from PDF {file_path}: {e}")
        return ""

def extract_text_from_docx(file_path: str) -> str:
    try:
        doc = docx.Document(file_path)
        text_parts = [para.text for para in doc.paragraphs if para.text.strip()]
        return "\n".join(text_parts)
    except Exception as e:
        logger.error(f"Error extracting text from DOCX {file_path}: {e}")
        return ""

def extract_text_from_pptx(file_path: str) -> str:
    try:
        prs = pptx.Presentation(file_path)
        text_parts = []
        for slide in prs.slides:
            for shape in slide.shapes:
                if hasattr(shape, "text") and shape.text.strip():
                    text_parts.append(shape.text)
        return "\n".join(text_parts)
    except Exception as e:
        logger.error(f"Error extracting text from PPTX {file_path}: {e}")
        return ""

def extract_text(file_path: str, file_type: str) -> str:
    file_type = file_type.lower().strip('.')
    if file_type == 'pdf':
        return extract_text_from_pdf(file_path)
    elif file_type in ['doc', 'docx']:
        return extract_text_from_docx(file_path)
    elif file_type in ['ppt', 'pptx']:
        return extract_text_from_pptx(file_path)
    else:
        logger.error(f"Unsupported file type: {file_type}")
        return ""
