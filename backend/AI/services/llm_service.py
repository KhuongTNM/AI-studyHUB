import os
import re
import json
import logging
from decimal import Decimal
from openai import OpenAI
from typing import List, Dict, Any, Optional

logger = logging.getLogger(__name__)


def _json_default(obj: Any) -> Any:
    """Serialize Decimal (trả về từ Postgres) sang float."""
    if isinstance(obj, Decimal):
        return float(obj)
    raise TypeError(f"Object of type {obj.__class__.__name__} is not JSON serializable")


# ─── LLM Provider Registry ────────────────────────────────────────────────────
#
# Thứ tự ưu tiên: Gemma 4 31B  →  gpt-oss-120b  →  zai-glm-4.7
#
# Khi một model bị rate-limit / hết quota, service tự động chuyển sang model
# tiếp theo trong chain.  Sau khi qua đêm (quota reset), model đầu tiên
# sẽ được thử lại ở request tiếp theo tự động.
#
# Env vars cần set trong .env:
#   GEMINI_API_KEY    – Google AI Studio key  (hoặc OPENAI_API_KEY như cũ)
#   CEREBRAS_API_KEY  – Cerebras API key
#
# supports_json_mode:
#   True  → truyền response_format={"type":"json_object"} (dùng cho flashcards)
#   False → inject JSON instruction vào prompt và parse thủ công từ text
# ─────────────────────────────────────────────────────────────────────────────

_GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/openai/"
_CEREBRAS_BASE_URL = "https://api.cerebras.ai/v1/"

_PROVIDER_CONFIGS: List[Dict[str, Any]] = [
    # ── Gemini Flash models (dùng OPENAI_API_KEY = Gemini key) ──────────────
    {
        "name": "gemini-2.5-flash",
        "model": "gemini-2.5-flash",
        "api_key_env": "GEMINI_API_KEY",
        "fallback_key_env": "OPENAI_API_KEY",
        "base_url": _GEMINI_BASE_URL,
        "supports_json_mode": True,
        "supports_streaming": True,
    },
    {
        "name": "gemini-2.5-flash-lite",
        "model": "gemini-2.5-flash-lite",
        "api_key_env": "GEMINI_API_KEY",
        "fallback_key_env": "OPENAI_API_KEY",
        "base_url": _GEMINI_BASE_URL,
        "supports_json_mode": True,
        "supports_streaming": True,
    },
    {
        "name": "gemini-3-flash",
        "model": "gemini-3-flash",
        "api_key_env": "GEMINI_API_KEY",
        "fallback_key_env": "OPENAI_API_KEY",
        "base_url": _GEMINI_BASE_URL,
        "supports_json_mode": True,
        "supports_streaming": True,
    },
    {
        "name": "gemini-3.1-flash-lite",
        "model": "gemini-3.1-flash-lite",
        "api_key_env": "GEMINI_API_KEY",
        "fallback_key_env": "OPENAI_API_KEY",
        "base_url": _GEMINI_BASE_URL,
        "supports_json_mode": True,
        "supports_streaming": True,
    },
    # ── Gemma (Gemini API) ───────────────────────────────────────────────────
    {
        "name": "gemma-4-31b",
        "model": "gemma-4-31b",
        "api_key_env": "GEMINI_API_KEY",
        "fallback_key_env": "OPENAI_API_KEY",
        "base_url": _GEMINI_BASE_URL,
        "supports_json_mode": True,
        "supports_streaming": True,
    },
    # ── Cerebras models ──────────────────────────────────────────────────────
    {
        "name": "gpt-oss-120b",
        "model": "gpt-oss-120b",
        "api_key_env": "CEREBRAS_API_KEY",
        "fallback_key_env": None,
        "base_url": _CEREBRAS_BASE_URL,
        "supports_json_mode": True,
        "supports_streaming": True,
    },
    {
        "name": "zai-glm-4.7",
        "model": "zai-glm-4.7",
        "api_key_env": "CEREBRAS_API_KEY",
        "fallback_key_env": None,
        "base_url": _CEREBRAS_BASE_URL,
        "supports_json_mode": False,   # GLM không hỗ trợ json_object mode
        "supports_streaming": True,
    },
]


class _LLMProvider:
    """Đại diện cho một LLM provider trong chain."""

    def __init__(
        self,
        name: str,
        model: str,
        client: OpenAI,
        supports_json_mode: bool,
        supports_streaming: bool,
    ) -> None:
        self.name = name
        self.model = model
        self.client = client
        self.supports_json_mode = supports_json_mode
        self.supports_streaming = supports_streaming

    def __repr__(self) -> str:  # pragma: no cover
        return f"<LLMProvider name={self.name!r}>"


def _build_providers() -> List[_LLMProvider]:
    """Xây dựng danh sách provider từ env vars, bỏ qua provider thiếu API key."""
    providers: List[_LLMProvider] = []

    for cfg in _PROVIDER_CONFIGS:
        api_key = os.getenv(cfg["api_key_env"])
        if not api_key and cfg.get("fallback_key_env"):
            api_key = os.getenv(cfg["fallback_key_env"])

        if not api_key:
            logger.warning(
                f"[LLM] Skipping provider '{cfg['name']}': "
                f"env var '{cfg['api_key_env']}' is not set."
            )
            continue

        providers.append(
            _LLMProvider(
                name=cfg["name"],
                model=cfg["model"],
                client=OpenAI(api_key=api_key, base_url=cfg["base_url"]),
                supports_json_mode=cfg["supports_json_mode"],
                supports_streaming=cfg["supports_streaming"],
            )
        )

    # Fallback cuối cùng: tương thích với cấu hình cũ (OPENAI_API_KEY + LLM_MODEL)
    if not providers:
        api_key = os.getenv("OPENAI_API_KEY")
        llm_model = os.getenv("LLM_MODEL", "gemini-2.5-flash")
        if api_key:
            logger.warning(
                "[LLM] No named providers found. "
                f"Using legacy fallback: model='{llm_model}' via OPENAI_API_KEY."
            )
            providers.append(
                _LLMProvider(
                    name=llm_model,
                    model=llm_model,
                    client=OpenAI(
                        api_key=api_key,
                        base_url="https://generativelanguage.googleapis.com/v1beta/openai/",
                    ),
                    supports_json_mode=True,
                    supports_streaming=True,
                )
            )
        else:
            logger.error(
                "[LLM] CRITICAL: No LLM providers configured! "
                "Set GEMINI_API_KEY and/or CEREBRAS_API_KEY."
            )

    if providers:
        chain = " → ".join(p.name for p in providers)
        logger.info(f"[LLM] Provider chain: {chain}")

    return providers


# Module-level state
_providers: List[_LLMProvider] = _build_providers()
_current_index: int = 0   # cursor tự động tiến khi gặp quota error


# ─── Helpers ─────────────────────────────────────────────────────────────────

def _is_quota_error(exc: Exception) -> bool:
    """Kiểm tra xem lỗi có phải do hết quota / rate-limit không."""
    msg = str(exc).lower()
    keywords = ("429", "rate limit", "quota", "too many requests", "resource exhausted", "overloaded")
    return any(kw in msg for kw in keywords)


def _extract_json_from_text(text: str) -> Dict[str, Any]:
    """
    Parse JSON từ raw text (dùng khi model không hỗ trợ json_object mode).
    Xử lý cả markdown code block (```json ... ```) và raw JSON.
    """
    # Thử code block trước
    code_block = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", text, re.DOTALL)
    if code_block:
        return json.loads(code_block.group(1))

    # Thử raw JSON object
    raw_json = re.search(r"\{.*\}", text, re.DOTALL)
    if raw_json:
        return json.loads(raw_json.group(0))

    raise ValueError(f"No JSON object found in model response: {text[:300]!r}")


def _get_provider(index: int) -> Optional[_LLMProvider]:
    if not _providers:
        return None
    return _providers[index % len(_providers)]


# ─── Answer Streaming ─────────────────────────────────────────────────────────

async def generate_answer_stream(query: str, retrieved_chunks: List[Dict[str, Any]]):
    """
    Sinh câu trả lời dưới dạng stream.

    Thử từng provider theo thứ tự chain.  Nếu provider hiện tại bị rate-limit
    hoặc hết quota, tự động chuyển sang provider tiếp theo và log cảnh báo.
    Provider thành công sẽ được ghi nhớ làm điểm bắt đầu cho request tiếp theo.
    """
    global _current_index

    if not _providers:
        raise RuntimeError("No LLM providers configured.")

    context_text = "\n\n".join(
        [f"[{i+1}] {chunk['content']}" for i, chunk in enumerate(retrieved_chunks)]
    )
    system_prompt = (
        "Bạn là trợ lý AI. Chỉ trả lời dựa trên thông tin trong các đoạn văn bản dưới đây. "
        "Nếu không có thông tin, nói \"Tôi không tìm thấy thông tin phù hợp trong tài liệu của bạn.\"\n"
        "--- Ngữ cảnh ---\n"
        f"{context_text}"
    )
    user_prompt = f"--- Câu hỏi ---\n{query}"

    n = len(_providers)
    start = _current_index

    for attempt in range(n):
        idx = (start + attempt) % n
        provider = _providers[idx]

        try:
            logger.info(f"[LLM] Streaming with '{provider.name}' (index={idx})")

            response = provider.client.chat.completions.create(
                model=provider.model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                temperature=0.3,
                stream=True,
            )

            for chunk in response:
                delta = chunk.choices[0].delta.content
                if delta:
                    yield delta

            # Thành công → giữ provider này cho request tiếp theo
            _current_index = idx
            sources_metadata = json.dumps(
                {"sources": retrieved_chunks, "model": provider.name},
                default=_json_default,
            )
            yield f"\n\n[SOURCES]\n{sources_metadata}\n\n"
            return

        except Exception as exc:
            if _is_quota_error(exc):
                logger.warning(
                    f"[LLM] Provider '{provider.name}' exhausted (quota/rate-limit). "
                    f"Switching to next provider. Error: {exc}"
                )
                # Advance cursor qua provider đã fail
                _current_index = (idx + 1) % n
            else:
                logger.error(
                    f"[LLM] Provider '{provider.name}' unexpected error.",
                    exc_info=True,
                )
                raise

    raise RuntimeError(
        "All LLM providers are currently unavailable (quota exhausted or errors). "
        "Please try again later."
    )


# ─── Flashcard Generation ─────────────────────────────────────────────────────

def generate_flashcards_from_text(text: str, count: int = 5) -> List[Dict[str, Any]]:
    """
    Sinh flashcard từ text.  Cùng logic fallback chain như generate_answer_stream.

    Với provider hỗ trợ json_object mode → dùng response_format.
    Với provider không hỗ trợ (vd: zai-glm-4.7) → inject JSON prompt và parse thủ công.
    """
    global _current_index

    if not _providers:
        raise RuntimeError("No LLM providers configured.")

    calculated_max_tokens = min(65536, count * 200 + 1000)
    n = len(_providers)
    start = _current_index

    for attempt in range(n):
        idx = (start + attempt) % n
        provider = _providers[idx]

        try:
            logger.info(f"[Flashcards] Using provider '{provider.name}' (index={idx})")

            if provider.supports_json_mode:
                system_prompt = (
                    f"Generate exactly {count} high-quality educational flashcards "
                    "based strictly on the text below. "
                    "Return a clean JSON object containing an array of flashcards "
                    "with 'question' and 'answer' keys."
                )
                extra_kwargs: Dict[str, Any] = {
                    "response_format": {"type": "json_object"}
                }
            else:
                # Providers không hỗ trợ json_object mode: dùng prompt engineering
                system_prompt = (
                    f"Generate exactly {count} high-quality educational flashcards "
                    "based strictly on the text below. "
                    "You MUST respond with ONLY a valid JSON object (no markdown, no explanation). "
                    'Format: {"flashcards": [{"question": "...", "answer": "..."}, ...]}'
                )
                extra_kwargs = {}

            response = provider.client.chat.completions.create(
                model=provider.model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": text},
                ],
                temperature=0.3,
                max_tokens=calculated_max_tokens,
                **extra_kwargs,
            )

            _current_index = idx
            content: str = response.choices[0].message.content or ""

            # Parse JSON
            try:
                parsed = json.loads(content)
            except json.JSONDecodeError:
                # Thử extract JSON từ text (cho model không json_mode)
                parsed = _extract_json_from_text(content)

            # Tìm array flashcards trong object
            flashcards_array: List[Any] = []
            if isinstance(parsed, list):
                flashcards_array = parsed
            elif isinstance(parsed, dict):
                for value in parsed.values():
                    if isinstance(value, list):
                        flashcards_array = value
                        break

            valid = [
                item for item in flashcards_array
                if isinstance(item, dict)
                and item.get("question")
                and item.get("answer")
            ]
            return valid

        except Exception as exc:
            if _is_quota_error(exc):
                logger.warning(
                    f"[Flashcards] Provider '{provider.name}' exhausted. "
                    f"Switching to next. Error: {exc}"
                )
                _current_index = (idx + 1) % n
            else:
                logger.error(
                    f"[Flashcards] Provider '{provider.name}' unexpected error.",
                    exc_info=True,
                )
                raise

    raise RuntimeError(
        "All LLM providers are currently unavailable. Please try again later."
    )
