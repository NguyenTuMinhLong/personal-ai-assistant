-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Add metadata columns to document_embeddings (for semantic chunks + filtering)
ALTER TABLE document_embeddings
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS title TEXT,
  ADD COLUMN IF NOT EXISTS section TEXT,
  ADD COLUMN IF NOT EXISTS page_number INTEGER,
  ADD COLUMN IF NOT EXISTS chunk_type TEXT;

-- Create BM25 index on document_embeddings (full-text search)
CREATE INDEX IF NOT EXISTS idx_doc_emb_content_fts
  ON document_embeddings
  USING GIN (to_tsvector('english', content));

-- Create pgvector index on embeddings (for ANN search)
-- Using HNSW for faster approximate nearest neighbor search
ALTER TABLE document_embeddings
  ALTER COLUMN embedding TYPE vector(1536);

CREATE INDEX IF NOT EXISTS idx_doc_emb_embedding_hnsw
  ON document_embeddings
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- Add metadata index
CREATE INDEX IF NOT EXISTS idx_doc_emb_metadata
  ON document_embeddings USING GIN (metadata);

-- Create BM25 index function for hybrid search
CREATE OR REPLACE FUNCTION match_documents_bm25(
  query_text TEXT,
  doc_id UUID DEFAULT NULL,
  top_k INTEGER DEFAULT 10
)
RETURNS TABLE(chunk_index INTEGER, content TEXT, metadata JSONB, bm25_score REAL, chunk_index_col INTEGER)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    de.chunk_index,
    de.content,
    de.metadata,
    ts_rank(to_tsvector('english', de.content), plainto_tsquery('english', query_text)) AS bm25_score,
    de.chunk_index as chunk_index_col
  FROM document_embeddings de
  WHERE
    (doc_id IS NULL OR de.document_id = doc_id)
    AND to_tsvector('english', de.content) @@ plainto_tsquery('english', query_text)
  ORDER BY bm25_score DESC
  LIMIT top_k;
END;
$$;
