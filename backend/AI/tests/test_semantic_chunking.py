import os
import sys

# Mocks or configure environment for testing
os.environ["SEMANTIC_CHUNKING_ENABLED"] = "true"
os.environ["SEMANTIC_BREAKPOINT_PERCENTILE"] = "80" # lower for testing
os.environ["MAX_CHUNK_CHARS"] = "800"
os.environ["MIN_CHUNK_CHARS"] = "80"
os.environ["OVERLAP_CHARS"] = "100"
os.environ["SEMANTIC_BUFFER_SIZE"] = "1"

# Add parent directory to path so we can import services
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

import services.embedding
import numpy as np

# Mock the embedding function to prevent API calls during test
def dummy_generate_embeddings_batch(texts):
    return [np.random.rand(1536).tolist() for _ in texts]

services.embedding.generate_embeddings_batch = dummy_generate_embeddings_batch

from services.chunking import semantic_chunk_text

sample_text = """
Quantum computing is a rapidly-emerging technology that harnesses the laws of quantum mechanics to solve problems too complex for classical computers. 
Today, IBM Quantum makes real quantum hardware available to thousands of developers. Engineers regularly maintain the cryogenic systems.
In contrast, making a perfect chocolate chip cookie requires precision in the kitchen. 
You must blend brown sugar, softened butter, and vanilla extract until light and fluffy. 
Baking at 350 degrees Fahrenheit ensures the edges are crispy while the center remains chewy. 
However, if we look back at quantum error correction, it requires thousands of physical qubits to create a single logical qubit.
This overhead is one of the biggest challenges in building a fault-tolerant quantum computer.
"""

def main():
    print("Running Semantic Chunking Test...")
    print("-" * 50)
    
    chunks = semantic_chunk_text(sample_text)
    
    print(f"\nTotal Chunks Generated: {len(chunks)}")
    for chunk in chunks:
        print(f"\n[Chunk {chunk['chunk_index']}] (Length: {len(chunk['content'])}):")
        print(chunk['content'])
        print("-" * 50)

if __name__ == "__main__":
    main()