"use client";

import dynamic from "next/dynamic";
import type { StoredDocument } from "@/lib/documents";

const ChatWorkspace = dynamic(
  () => import("@/components/chat/ChatWorkspace").then((mod) => mod.ChatWorkspace),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center">
        <div className="flex items-center gap-3 text-stone-500">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-stone-300 border-t-stone-500" />
          <span>Loading chat...</span>
        </div>
      </div>
    ),
  }
);

type ChatWorkspaceClientProps = {
  documents: StoredDocument[];
  initialDocumentId: string | null;
  initialSessionId: string | null;
  initialMessages?: Array<{
    id: string;
    role: "user" | "assistant";
    content: string;
    imageUrls?: string[];
    chatFiles?: Array<{
      fileId: string;
      filename: string;
      mimeType: string;
      storageUrl: string;
      fileSize: number;
      extractedText?: string | null;
    }>;
    citations?: Array<{ index: number; snippet: string }>;
    highlightColor?: "rose" | "amber" | "emerald" | "sky" | "violet" | null;
    selectionStart?: number | null;
    selectionEnd?: number | null;
    createdAt?: string | null;
  }>;
  initialNotes?: Array<{
    id: string;
    messageId: string;
    isPinned?: boolean;
  }>;
};

export function ChatWorkspaceClient(props: ChatWorkspaceClientProps) {
  return <ChatWorkspace {...props} />;
}
