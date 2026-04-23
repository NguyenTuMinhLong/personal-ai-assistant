import { currentUser } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";

import { listSessionAnnotations } from "@/lib/annotations";
import { getChatSession, listMessages } from "@/lib/sessions";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const user = await currentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { sessionId } = await params;
  
  const session = await getChatSession(user.id, sessionId);

  if (!session) {
    return NextResponse.json({ error: "Session not found." }, { status: 404 });
  }

  const [messages, annotations] = await Promise.all([
    listMessages(sessionId),
    listSessionAnnotations(user.id, sessionId),
  ]);

  // Transform to snake_case for UI compatibility
  const transformedMessages = messages.map((msg) => ({
    id: msg.id,
    role: msg.role,
    content: msg.content,
    image_url: msg.imageUrl ?? null,
    citations: msg.citations ?? [],
    created_at: msg.created_at,
  }));

  const transformedAnnotations = annotations.map((ann) => ({
    id: ann.id,
    user_id: ann.userId,
    session_id: ann.sessionId,
    document_id: ann.documentId,
    message_id: ann.messageId,
    note_content: ann.noteContent,
    highlight_color: ann.highlightColor,
    selection_start: ann.selectionStart,
    selection_end: ann.selectionEnd,
    created_at: ann.createdAt,
    updated_at: ann.updatedAt,
  }));

  return NextResponse.json({ 
    messages: transformedMessages, 
    annotations: transformedAnnotations 
  });
}
