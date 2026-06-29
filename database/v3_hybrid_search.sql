-- Add full-text search column
ALTER TABLE ai.document_chunks ADD COLUMN IF NOT EXISTS fts tsvector GENERATED ALWAYS AS (to_tsvector('simple', content)) STORED;

-- Create GIN index for keyword search
CREATE INDEX IF NOT EXISTS idx_dc_fts ON ai.document_chunks USING GIN (fts);
