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

export type Message = {
  id: string;
  session_id: string;
  role: 'user' | 'assistant';
  content: string;
  imageUrl?: string | null;
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
