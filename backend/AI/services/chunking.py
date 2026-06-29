import re
import os
from typing import List, Dict

MAX_CHUNK_CHARS = int(os.getenv("MAX_CHUNK_CHARS", "800"))
MIN_CHUNK_CHARS = int(os.getenv("MIN_CHUNK_CHARS", "80"))
OVERLAP_CHARS = int(os.getenv("OVERLAP_CHARS", "100"))

def get_overlap_text(text: str) -> str:
    if len(text) <= OVERLAP_CHARS:
        return text
    tail = text[-OVERLAP_CHARS:]
    match = re.search(r'(?<=[.?!;:,])\s+', tail)
    if match:
        return tail[match.end():].strip()
    return tail.strip()

def chunk_text(text: str) -> List[Dict[str, str]]:
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
                
    result = []
    for i, chunk in enumerate(merged_chunks):
        result.append({
            "chunk_index": i,
            "content": chunk
        })
        
    return result
