import os
import tiktoken
from openai import OpenAI
from tenacity import retry, wait_exponential, stop_after_attempt, retry_if_exception_type
from typing import List, Dict

client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
EMBED_MODEL = os.getenv("EMBED_MODEL", "text-embedding-3-small")

tokenizer = tiktoken.get_encoding("cl100k_base")

# In-memory dictionary cache
embedding_cache = {}

def get_token_count(text: str) -> int:
    return len(tokenizer.encode(text))

@retry(
    wait=wait_exponential(multiplier=1, min=2, max=10),
    stop=stop_after_attempt(5),
    retry=retry_if_exception_type(Exception)
)
def generate_embedding(text: str) -> List[float]:
    if not text:
        return []
        
    if text in embedding_cache:
        return embedding_cache[text]
        
    response = client.embeddings.create(
        input=text,
        model=EMBED_MODEL
    )
    
    embedding = response.data[0].embedding
    embedding_cache[text] = embedding
    return embedding

def process_chunks(chunks: List[Dict[str, str]]) -> List[Dict[str, any]]:
    for chunk in chunks:
        text = chunk["content"]
        chunk["token_count"] = get_token_count(text)
        chunk["embedding"] = generate_embedding(text)
    return chunks
