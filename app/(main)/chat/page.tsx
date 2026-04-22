import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

import { ChatWorkspace } from "@/components/chat/ChatWorkspace";
import { listUserDocuments } from "@/lib/documents";
import { getChatSession } from "@/lib/sessions";

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

  const documents = await listUserDocuments(user.id);
  const params = await searchParams;

  const documentIdParam = params.documentId;
  const sessionIdParam = params.sessionId;
  const sessionId =
    typeof sessionIdParam === "string" ? sessionIdParam : null;

  // If we have a sessionId but no documentId, look up the document from the session
  let initialDocumentId: string | null = null;

  if (typeof documentIdParam === "string" && documentIdParam) {
    // documentId provided - validate it exists
    initialDocumentId = documents.some((doc) => doc.id === documentIdParam)
      ? documentIdParam
      : null;
  } else if (sessionId) {
    // No documentId but have sessionId - fetch session to get document_id
    const session = await getChatSession(user.id, sessionId);
    if (session) {
      // Check if the session's document exists in user's documents
      initialDocumentId = documents.some((doc) => doc.id === session.document_id)
        ? session.document_id
        : null;
    }
  }

  // Fallback to first document only if no document could be determined
  if (!initialDocumentId && documents.length > 0) {
    initialDocumentId = documents[0].id;
  }

  return (
    <ChatWorkspace
      documents={documents}
      initialDocumentId={initialDocumentId}
      initialSessionId={sessionId}
    />
  );
}