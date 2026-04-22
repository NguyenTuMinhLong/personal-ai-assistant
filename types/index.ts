// types/index.ts
export type Document = {
  id: string;
  user_id: string;
  filename: string;
  content: string;
  summary?: string | null;
  metadata: {
    size?: number;
    pageCount?: number;
    mimeType?: string;
  };
  created_at: string;
  updated_at?: string;
};

export type Chunk = {
  id: number;
  document_id: string;
  content: string;
  chunk_index: number;
  embedding?: number[];
};

export type ChatSession = {
  id: string;
  user_id: string;
  document_id: string;
  title: string;
  created_at: string;
  updated_at: string;
  document_name?: string;
};

export type Message = {
  id: string;
  session_id: string;
  role: 'user' | 'assistant';
  content: string;
  imageUrl?: string | null;
  citations: Array<{
    filename: string;
    chunk_index: number;
    content_preview: string;
  }>;
  created_at: string;
};

export type Citation = {
  filename: string;
  chunk_index: number;
  content_preview: string;
};