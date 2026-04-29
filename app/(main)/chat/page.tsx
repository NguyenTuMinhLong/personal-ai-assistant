import { currentUser } from "@clerk/nextjs/server";

import { ChatWorkspaceClient } from "./ChatWorkspaceClient";
import { listUserDocuments } from "@/lib/documents";
import { getChatSession, listMessages } from "@/lib/sessions";
import { listSessionAnnotations } from "@/lib/annotations";
import type { ChatSession, Message, MessageAnnotation, HighlightColor } from "@/types";

type ChatPageProps = {
  searchParams: Promise<{
    documentId?: string | string[];
    sessionId?: string | string[];
  }>;
};

export const dynamic = "force-dynamic";

export default async function ChatPage({ searchParams }: ChatPageProps) {
  const user = await currentUser();

  const params = await searchParams;

  const documentIdParam = params.documentId;
  const sessionIdParam = params.sessionId;
  const sessionId =
    typeof sessionIdParam === "string" ? sessionIdParam : null;

  // ── Authenticated users: load their documents and session data ──
  // ── Guest users: handled client-side via useGuestSession ──
  let documents: Awaited<ReturnType<typeof listUserDocuments>> = [];
  let session: ChatSession | null = null;
  let initialMessages: Message[] = [];
  let initialAnnotations: MessageAnnotation[] = [];

  if (user) {
    const [docs, sessionData] = await Promise.all([
      listUserDocuments(user.id),
      sessionId
        ? Promise.all([
            getChatSession(user.id, sessionId),
            listMessages(sessionId),
            listSessionAnnotations(user.id, sessionId),
          ])
        : Promise.resolve([null, [], []]),
    ]);

    documents = docs;
    [session, initialMessages, initialAnnotations] = sessionData as [
      ChatSession | null,
      Message[],
      MessageAnnotation[]
    ];
  }

  // Determine which document to show
  let initialDocumentId: string | null = null;

  if (typeof documentIdParam === "string" && documentIdParam) {
    initialDocumentId = documents.some((doc) => doc.id === documentIdParam)
      ? documentIdParam
      : null;
  } else if (session) {
    initialDocumentId = documents.some((doc) => doc.id === session.document_id)
      ? session.document_id
      : null;
  }

  // Fallback to first document only if authenticated
  if (!initialDocumentId && documents.length > 0) {
    initialDocumentId = documents[0].id;
  }

  // For guests without documents, use a virtual document ID
  // The API will handle this by skipping RAG but still accepting the request
  if (!initialDocumentId && !user) {
    initialDocumentId = "guest-default";
  }

  // Transform server messages + annotations into the shape ChatWorkspace expects
  const highlightMap = new Map(
    initialAnnotations.map((ann) => [ann.messageId, ann])
  );
  const transformedMessages = initialMessages.map((msg) => {
    const ann = highlightMap.get(msg.id);
    const urls = msg.imageUrls ?? (msg.imageUrl ? [msg.imageUrl] : []);
    return {
      id: msg.id,
      role: msg.role,
      content: msg.content,
      imageUrls: urls.length > 0 ? urls : undefined,
      chatFiles: msg.chatFiles ? (msg.chatFiles.length > 0 ? msg.chatFiles : undefined) : undefined,
      citations: (msg.citations ?? []).map((c, i) => ({
        index: i + 1,
        snippet: c.contentPreview ?? "",
      })),
      highlightColor: (ann?.highlightColor ?? null) as HighlightColor | null,
      selectionStart: ann?.selectionStart ?? null,
      selectionEnd: ann?.selectionEnd ?? null,
      createdAt: msg.created_at ?? null,
    };
  });

  const transformedAnnotations = initialAnnotations.map((ann) => ({
    id: ann.id,
    messageId: ann.messageId,
    isPinned: (ann as { isPinned?: boolean }).isPinned ?? false,
  }));

  return (
    <ChatWorkspaceClient
      documents={documents}
      initialDocumentId={initialDocumentId}
      initialSessionId={sessionId}
      initialMessages={transformedMessages}
      initialNotes={transformedAnnotations}
    />
  );
}
