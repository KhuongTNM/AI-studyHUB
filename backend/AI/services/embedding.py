import os
import logging
import tiktoken
from openai import OpenAI
from tenacity import retry, wait_exponential, stop_after_attempt, retry_if_exception_type
from typing import List, Dict, Any
from dotenv import load_dotenv

logger = logging.getLogger(__name__)
load_dotenv()

# ─── Embedding Model Registry ─────────────────────────────────────────────────
#
# Cả 2 model đều được truncate về 1536 chiều để khớp với schema DB: vector(1536)
#
# EMBED_MODEL (env var):
#   "gemini-embedding-001"  →  Gemini Embedding 1 (mặc định, stable)
#   "gemini-embedding-004"  →  Gemini Embedding 2 (mới hơn, hỗ trợ đến 3072 dims,
#                               truncated xuống 1536 để tương thích DB)
#
# Nếu muốn dùng Embedding 2 với full 3072 dims, cần migrate DB schema:
#   ALTER TABLE ai.document_chunks ALTER COLUMN embedding TYPE vector(3072);
# và set EMBED_DIMENSIONS=3072 trong .env, rồi re-ingest toàn bộ tài liệu.
# ─────────────────────────────────────────────────────────────────────────────

_EMBEDDING_REGISTRY: Dict[str, Dict[str, Any]] = {
    "text-embedding-3-small": {
        "model": "text-embedding-3-small",
        "provider": "openai",
        "default_dimensions": 1536,
        "description": "OpenAI text-embedding-3-small - 1536 dims",
    },
    "text-embedding-3-large": {
        "model": "text-embedding-3-large",
        "provider": "openai",
        "default_dimensions": 1536,
        "description": "OpenAI text-embedding-3-large - truncated to 1536 dims",
    },
    "gemini-embedding-001": {
        "model": "gemini-embedding-001",
        "provider": "gemini",
        "default_dimensions": 1536,
        "description": "Gemini Embedding 1 – stable, 1536 dims",
    },
    "gemini-embedding-2": {
        "model": "gemini-embedding-2",
        "provider": "gemini",
        "default_dimensions": 1536,   # truncated from max 3072 → compatible với DB hiện tại
        "description": "Gemini Embedding 2 – newer model, truncated to 1536 for DB compatibility",
    },
}

# Resolve active embedding model
_EMBED_MODEL_NAME = os.getenv("EMBED_MODEL", "gemini-embedding-001")

if _EMBED_MODEL_NAME not in _EMBEDDING_REGISTRY:
    logger.warning(
        f"Unknown EMBED_MODEL '{_EMBED_MODEL_NAME}'. "
        f"Valid values: {list(_EMBEDDING_REGISTRY.keys())}. "
        "Falling back to 'gemini-embedding-001'."
    )
    _EMBED_MODEL_NAME = "gemini-embedding-001"

_embed_cfg = _EMBEDDING_REGISTRY[_EMBED_MODEL_NAME]
EMBED_MODEL: str = _embed_cfg["model"]
EMBED_PROVIDER: str = _embed_cfg["provider"]

# EMBED_DIMENSIONS từ env override mọi default (để dễ migrate DB sau này)
EMBED_DIMENSIONS: int = int(os.getenv("EMBED_DIMENSIONS", str(_embed_cfg["default_dimensions"])))

logger.info(
    f"[Embedding] Active model: {EMBED_MODEL}  |  "
    f"provider={EMBED_PROVIDER}  |  dimensions={EMBED_DIMENSIONS}  |  "
    f"{_embed_cfg['description']}"
)

# ─── Gemini Client (OpenAI-compatible endpoint) ───────────────────────────────
# OPENAI_API_KEY trong .env là Gemini API key (https://aistudio.google.com/apikey)
# Hoặc có thể set GEMINI_API_KEY riêng; GEMINI_API_KEY được ưu tiên hơn.
def _build_client() -> OpenAI:
    if EMBED_PROVIDER == "gemini":
        api_key = os.getenv("GEMINI_API_KEY") or os.getenv("OPENAI_API_KEY")
        if not api_key:
            raise RuntimeError("[Embedding] GEMINI_API_KEY or OPENAI_API_KEY must be set for Gemini embeddings.")
        return OpenAI(
            api_key=api_key,
            base_url="https://generativelanguage.googleapis.com/v1beta/openai/",
        )

    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise RuntimeError("[Embedding] OPENAI_API_KEY must be set for OpenAI embeddings.")
    return OpenAI(api_key=api_key)


client: OpenAI | None = None


def get_client() -> OpenAI:
    global client
    if client is None:
        client = _build_client()
    return client

BATCH_SIZE: int = int(os.getenv("OPENAI_EMBEDDING_BATCH_SIZE", "100"))
tokenizer = None

# In-memory dictionary cache
embedding_cache: Dict[str, List[float]] = {}


def get_token_count(text: str) -> int:
    global tokenizer
    try:
        if tokenizer is None:
            tokenizer = tiktoken.get_encoding("cl100k_base")
        return len(tokenizer.encode(text))
    except Exception as e:
        logger.warning(f"Could not load tiktoken tokenizer, using approximate token count: {e}")
        return max(1, len(text) // 4)


@retry(
    wait=wait_exponential(multiplier=1, min=2, max=10),
    stop=stop_after_attempt(5),
    retry=retry_if_exception_type(Exception),
)
def generate_embeddings_batch(texts: List[str]) -> List[List[float]]:
    if not texts:
        return []

    response = get_client().embeddings.create(
        input=texts,
        model=EMBED_MODEL,
        dimensions=EMBED_DIMENSIONS,
    )

    return [data.embedding for data in response.data]


def generate_embedding(text: str) -> List[float]:
    if not text:
        return []

    if text in embedding_cache:
        return embedding_cache[text]

    emb = generate_embeddings_batch([text])[0]
    embedding_cache[text] = emb
    return emb


def process_chunks(chunks: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    texts_to_embed: List[str] = []
    chunk_indices_to_embed: List[int] = []

    for i, chunk in enumerate(chunks):
        text = chunk["content"]
        chunk["token_count"] = get_token_count(text)
        if text in embedding_cache:
            chunk["embedding"] = embedding_cache[text]
        else:
            texts_to_embed.append(text)
            chunk_indices_to_embed.append(i)

    for i in range(0, len(texts_to_embed), BATCH_SIZE):
        batch_texts = texts_to_embed[i : i + BATCH_SIZE]
        batch_indices = chunk_indices_to_embed[i : i + BATCH_SIZE]

        embeddings = generate_embeddings_batch(batch_texts)

        for idx, text, emb in zip(batch_indices, batch_texts, embeddings):
            embedding_cache[text] = emb
            chunks[idx]["embedding"] = emb

    return chunks
