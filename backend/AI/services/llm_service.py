import os
import json
from openai import OpenAI
from typing import List, Dict, Any

client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
LLM_MODEL = os.getenv("LLM_MODEL", "gpt-4o-mini")

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
            
    sources_metadata = json.dumps({"sources": retrieved_chunks})
    yield f"\n\n[SOURCES]\n{sources_metadata}\n\n"
