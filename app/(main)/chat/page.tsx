import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

import { ChatWorkspace } from "@/components/chat/ChatWorkspace";
import { listUserDocuments } from "@/lib/documents";

type ChatPageProps = {
  searchParams: Promise<{ documentId?: string | string[] }>;
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
  const documentId =
    typeof documentIdParam === "string" ? documentIdParam : null;
  const initialDocumentId =
    documentId && documents.some((doc) => doc.id === documentId)
      ? documentId
      : documents[0]?.id ?? null;

  return (
    <ChatWorkspace
      documents={documents}
      initialDocumentId={initialDocumentId}
    />
  );
}
