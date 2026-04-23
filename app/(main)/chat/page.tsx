import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

import { ChatWorkspace } from "@/components/chat/ChatWorkspace";
import { listUserDocuments } from "@/lib/documents";
import { getChatSession, listMessages } from "@/lib/sessions";
import { listSessionAnnotations } from "@/lib/annotations";

type ChatPageProps = {
  searchParams: Promise<{
    documentId?: string | string[];
    sessionId?: string | string[];
  }>;
};

export const dynamic = "force-dynamic";

export default async function ChatPage({ searchParams }: ChatPageProps) {
  const user = await currentUser();

  if (!user) {
    redirect("/sign-in");
  }

  const params = await searchParams;

  const documentIdParam = params.documentId;
  const sessionIdParam = params.sessionId;
  const sessionId =
    typeof sessionIdParam === "string" ? sessionIdParam : null;

  // Fetch documents and (optionally) session data in parallel
  const [documents, sessionData] = await Promise.all([
    listUserDocuments(user.id),
    sessionId
      ? Promise.all([
          getChatSession(user.id, sessionId),
          listMessages(sessionId),
          listSessionAnnotations(user.id, sessionId),
        ])
      : Promise.resolve([null, [], []]),
  ]);

  const [session, initialMessages, initialAnnotations] = sessionData;

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

  // Fallback to first document only if no document could be determined
  if (!initialDocumentId && documents.length > 0) {
    initialDocumentId = documents[0].id;
  }

  // Transform server messages + annotations into the shape ChatWorkspace expects
  const transformedMessages = initialMessages.map((msg, index) => ({
    id: msg.id,
    role: msg.role,
    content: msg.content,
    imageUrl: msg.imageUrl ?? null,
    citations: (msg.citations ?? []).map((c, i) => ({
      index: i + 1,
      snippet: c.contentPreview ?? "",
    })),
    highlightColor: null,
    selectionStart: null,
    selectionEnd: null,
  }));

  const transformedAnnotations = initialAnnotations.map((ann) => ({
    id: ann.id,
    messageId: ann.messageId,
  }));

  return (
    <ChatWorkspace
      documents={documents}
      initialDocumentId={initialDocumentId}
      initialSessionId={sessionId}
      initialMessages={transformedMessages}
      initialNotes={transformedAnnotations}
    />
  );
}