// types/index.ts
// Matching actual Supabase schema

export type Document = {
  id: string;
  filename: string;
  content: string;
  summary?: string | null;
  created_at: string;
};

export type Chunk = {
  id: number;
  documentId: string;
  content: string;
  chunkIndex: number;
  embedding?: number[];
};

export type ChatSession = {
  id: string;
  document_id: string;
  title: string;
  created_at: string;
  updated_at: string;
  document_name?: string;
  is_pinned?: boolean;
};

export type ChatFile = {
  fileId: string;
  filename: string;
  mimeType: string;
  storageUrl: string;
  fileSize: number;
  extractedText?: string | null;
};

export type Message = {
  id: string;
  session_id: string;
  role: 'user' | 'assistant';
  content: string;
  imageUrls?: string[];
  imageUrl?: string | null;
  chatFiles?: ChatFile[];
  citations: Citation[];
  created_at: string;
};

export type Citation = {
  filename: string;
  chunkIndex: number;
  contentPreview: string;
};

export type MessageAnnotation = {
  id: string;
  userId: string;
  sessionId: string;
  documentId: string;
  messageId: string;
  noteContent: string;
  highlightColor: HighlightColor | null;
  selectionStart: number;
  selectionEnd: number;
  isPinned: boolean;
  createdAt: string;
  updatedAt: string;
};

export type HighlightColor = "rose" | "amber" | "emerald" | "sky" | "violet";

// ==================== RAG Infrastructure Types ====================

export type ChunkMetadata = {
  title?: string;
  section?: string;
  pageNumber?: number;
  chunkType: "paragraph" | "sentence" | "fixed";
};

export type SearchResult = {
  chunkIndex: number;
  content: string;
  metadata: ChunkMetadata;
  score: number;
  source: "document" | "file";
  documentId?: string;
};

export type MetadataFilters = {
  section?: string;
  pageNumber?: number;
  chunkType?: string;
};
