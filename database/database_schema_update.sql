CREATE EXTENSION IF NOT EXISTS vector SCHEMA public;

CREATE SCHEMA IF NOT EXISTS ai;

CREATE TABLE IF NOT EXISTS ai.document_chunks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES docs.documents(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES core.users(id) ON DELETE CASCADE,
    chunk_index INT NOT NULL,
    content TEXT NOT NULL,
    token_count INT,
    embedding vector(1536),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (document_id, chunk_index)
);

CREATE INDEX IF NOT EXISTS idx_dc_document_id ON ai.document_chunks (document_id);
CREATE INDEX IF NOT EXISTS idx_dc_user_id ON ai.document_chunks (user_id);
CREATE INDEX IF NOT EXISTS idx_dc_embedding_cosine ON ai.document_chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

ALTER TABLE docs.documents ADD COLUMN IF NOT EXISTS embedding_status VARCHAR(20) NOT NULL DEFAULT 'none' CHECK (embedding_status IN ('none','processing','done','failed'));

-- Add full-text search column
ALTER TABLE ai.document_chunks ADD COLUMN IF NOT EXISTS fts tsvector GENERATED ALWAYS AS (to_tsvector('simple', content)) STORED;

-- Create GIN index for keyword search
CREATE INDEX IF NOT EXISTS idx_dc_fts ON ai.document_chunks USING GIN (fts);
