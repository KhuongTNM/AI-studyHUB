import re
import os
import numpy as np
from typing import List, Dict
import tiktoken

MAX_CHUNK_CHARS = int(os.getenv("MAX_CHUNK_CHARS", "800"))
MIN_CHUNK_CHARS = int(os.getenv("MIN_CHUNK_CHARS", "80"))
OVERLAP_CHARS = int(os.getenv("OVERLAP_CHARS", "100"))
SEMANTIC_BUFFER_SIZE = int(os.getenv("SEMANTIC_BUFFER_SIZE", "1"))
SEMANTIC_BREAKPOINT_PERCENTILE = float(os.getenv("SEMANTIC_BREAKPOINT_PERCENTILE", "90"))

def get_overlap_text(text: str) -> str:
    if len(text) <= OVERLAP_CHARS:
        return text
    tail = text[-OVERLAP_CHARS:]
    match = re.search(r'(?<=[.?!;:,])\s+', tail)
    if match:
        return tail[match.end():].strip()
    return tail.strip()

def recursive_chunk_strings(text: str) -> List[str]:
    if not text:
        return []
        
    paragraphs = re.split(r'\n\n+', text)
    raw_chunks = []
    
    for para in paragraphs:
        para = para.strip()
        if not para:
            continue
            
        if len(para) <= MAX_CHUNK_CHARS:
            raw_chunks.append(para)
        else:
            lines = re.split(r'\n+', para)
            for line in lines:
                line = line.strip()
                if not line:
                    continue
                if len(line) <= MAX_CHUNK_CHARS:
                    raw_chunks.append(line)
                else:
                    sentences = re.split(r'(?<=[.?!;:,])(?=\s+|$)', line)
                    current_sentence_chunk = ""
                    for sentence in sentences:
                        sentence = sentence.strip()
                        if not sentence:
                            continue
                        if len(current_sentence_chunk) + len(sentence) + 1 <= MAX_CHUNK_CHARS:
                            if current_sentence_chunk:
                                current_sentence_chunk += " " + sentence
                            else:
                                current_sentence_chunk = sentence
                        else:
                            if current_sentence_chunk:
                                raw_chunks.append(current_sentence_chunk)
                            current_sentence_chunk = sentence
                    if current_sentence_chunk:
                        raw_chunks.append(current_sentence_chunk)
                        
    merged_chunks = []
    for chunk in raw_chunks:
        if not merged_chunks:
            merged_chunks.append(chunk)
        else:
            if len(chunk) < MIN_CHUNK_CHARS and len(merged_chunks[-1]) + len(chunk) + 1 <= MAX_CHUNK_CHARS:
                merged_chunks[-1] += " " + chunk
            else:
                overlap = get_overlap_text(merged_chunks[-1])
                if overlap and len(overlap) + len(chunk) + 1 <= MAX_CHUNK_CHARS:
                    chunk = overlap + " " + chunk
                merged_chunks.append(chunk)
                
    return merged_chunks

def recursive_chunk_text(text: str) -> List[Dict[str, str]]:
    merged_chunks = recursive_chunk_strings(text)
    result = []
    for i, chunk in enumerate(merged_chunks):
        result.append({
            "chunk_index": i,
            "content": chunk
        })
    return result

def compute_cosine_similarity(vec_a: List[float], vec_b: List[float]) -> float:
    a = np.array(vec_a)
    b = np.array(vec_b)
    norm_a = np.linalg.norm(a)
    norm_b = np.linalg.norm(b)
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return np.dot(a, b) / (norm_a * norm_b)

def semantic_chunk_text(text: str) -> List[Dict[str, str]]:
    if not text:
        return []
        
    raw_sentences = re.split(r'(?<=[.?!;:…])(?=\s+|$)', text)
    sentences = [s.strip() for s in raw_sentences if s.strip()]
    
    if not sentences:
        return []
    if len(sentences) == 1:
        return recursive_chunk_text(text)
        
    combined_sentences = []
    for i in range(len(sentences)):
        start_idx = max(0, i - SEMANTIC_BUFFER_SIZE)
        end_idx = min(len(sentences), i + SEMANTIC_BUFFER_SIZE + 1)
        combined = " ".join(sentences[start_idx:end_idx])
        combined_sentences.append(combined)
        
    from services.embedding import generate_embeddings_batch, BATCH_SIZE
    embeddings = []
    for i in range(0, len(combined_sentences), BATCH_SIZE):
        batch = combined_sentences[i:i + BATCH_SIZE]
        embeddings.extend(generate_embeddings_batch(batch))
    
    distances = []
    for i in range(len(embeddings) - 1):
        similarity = compute_cosine_similarity(embeddings[i], embeddings[i+1])
        distance = 1.0 - similarity
        distances.append(distance)
        
    threshold = np.percentile(distances, SEMANTIC_BREAKPOINT_PERCENTILE) if distances else 0.0
    avg_similarity = 1.0 - np.mean(distances) if distances else 0.0
    
    import logging
    logger = logging.getLogger(__name__)
    logger.info(f"Semantic Chunking: Threshold (P{SEMANTIC_BREAKPOINT_PERCENTILE}) = {threshold:.4f}, Average sentence similarity = {avg_similarity:.4f}")
        
        
    breakpoints = []
    for i, dist in enumerate(distances):
        if dist > threshold:
            breakpoints.append(i)
            
    raw_chunks = []
    chunk_distances = []
    start_idx = 0
    for bp in breakpoints:
        chunk = " ".join(sentences[start_idx:bp + 1])
        raw_chunks.append(chunk)
        chunk_distances.append(distances[bp])
        start_idx = bp + 1
    
    if start_idx < len(sentences):
        chunk = " ".join(sentences[start_idx:])
        raw_chunks.append(chunk)
        
    if not raw_chunks:
        return []
        
    i = 0
    while i < len(raw_chunks):
        if len(raw_chunks[i]) < MIN_CHUNK_CHARS and len(raw_chunks) > 1:
            if i == 0:
                raw_chunks[0] = raw_chunks[0] + " " + raw_chunks[1]
                raw_chunks.pop(1)
                chunk_distances.pop(0)
                continue
            elif i == len(raw_chunks) - 1:
                raw_chunks[i-1] = raw_chunks[i-1] + " " + raw_chunks[i]
                raw_chunks.pop(i)
                chunk_distances.pop(i-1)
                i -= 1
                continue
            else:
                dist_prev = chunk_distances[i-1]
                dist_next = chunk_distances[i]
                if dist_prev <= dist_next:
                    raw_chunks[i-1] = raw_chunks[i-1] + " " + raw_chunks[i]
                    raw_chunks.pop(i)
                    chunk_distances.pop(i-1)
                    i -= 1
                    continue
                else:
                    raw_chunks[i] = raw_chunks[i] + " " + raw_chunks[i+1]
                    raw_chunks.pop(i+1)
                    chunk_distances.pop(i)
                    continue
        i += 1

    overlapped_chunks = []
    for i in range(len(raw_chunks)):
        if i == 0:
            overlapped_chunks.append(raw_chunks[i])
        else:
            overlap = get_overlap_text(overlapped_chunks[-1])
            chunk = raw_chunks[i]
            if overlap:
                chunk = overlap + " " + chunk
            overlapped_chunks.append(chunk)

    final_chunks = []
    for chunk in overlapped_chunks:
        if len(chunk) > MAX_CHUNK_CHARS:
            split_chunks = recursive_chunk_strings(chunk)
            final_chunks.extend(split_chunks)
        else:
            final_chunks.append(chunk)

    result = []
    for i, chunk in enumerate(final_chunks):
        result.append({
            "chunk_index": i,
            "content": chunk
        })
        
    return result

def build_context_within_budget(chunks: List[dict], max_tokens: int = int(os.getenv("FLASHCARD_CONTEXT_MAX_TOKENS", "900000"))) -> str:
    if not chunks:
        return ""

    encoding = tiktoken.get_encoding("cl100k_base")
    context = ""
    current_tokens = 0

    sorted_chunks = sorted(chunks, key=lambda x: x.get("chunk_index", 0))

    for chunk in sorted_chunks:
        content = chunk.get("content", "")
        if not content:
            continue

        text_to_add = content if not context else "\n\n" + content
        token_count = len(encoding.encode(text_to_add))

        if current_tokens + token_count > max_tokens:
            break

        context += text_to_add
        current_tokens += token_count

    return context