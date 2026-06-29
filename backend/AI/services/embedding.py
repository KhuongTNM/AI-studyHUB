import os
import tiktoken
from openai import OpenAI
from tenacity import retry, wait_exponential, stop_after_attempt, retry_if_exception_type
from typing import List, Dict

client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
EMBED_MODEL = os.getenv("EMBED_MODEL", "text-embedding-3-small")
BATCH_SIZE = int(os.getenv("OPENAI_EMBEDDING_BATCH_SIZE", "100"))

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
def generate_embeddings_batch(texts: List[str]) -> List[List[float]]:
    if not texts:
        return []
        
    response = client.embeddings.create(
        input=texts,
        model=EMBED_MODEL
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

def process_chunks(chunks: List[Dict[str, any]]) -> List[Dict[str, any]]:
    texts_to_embed = []
    chunk_indices_to_embed = []
    
    for i, chunk in enumerate(chunks):
        text = chunk["content"]
        chunk["token_count"] = get_token_count(text)
        if text in embedding_cache:
            chunk["embedding"] = embedding_cache[text]
        else:
            texts_to_embed.append(text)
            chunk_indices_to_embed.append(i)
            
    for i in range(0, len(texts_to_embed), BATCH_SIZE):
        batch_texts = texts_to_embed[i:i + BATCH_SIZE]
        batch_indices = chunk_indices_to_embed[i:i + BATCH_SIZE]
        
        embeddings = generate_embeddings_batch(batch_texts)
        
        for idx, text, emb in zip(batch_indices, batch_texts, embeddings):
            embedding_cache[text] = emb
            chunks[idx]["embedding"] = emb
            
    return chunks
