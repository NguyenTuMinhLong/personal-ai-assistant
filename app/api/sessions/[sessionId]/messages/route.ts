import { currentUser } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";

import { listSessionAnnotations } from "@/lib/annotations";
import { getChatSession, listMessages, countMessages } from "@/lib/sessions";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
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

  const { searchParams } = new URL(req.url);
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "", 10) || 50, 200);
  const offset = Math.max(parseInt(searchParams.get("offset") ?? "", 10) || 0, 0);
  const cursor = searchParams.get("cursor") ?? undefined;
  const direction = searchParams.get("direction") ?? "older";

  if (direction === "older") {
    const [messages, annotations, total] = await Promise.all([
      listMessages(sessionId, { limit, offset }),
      listSessionAnnotations(user.id, sessionId),
      countMessages(sessionId),
    ]);

    const transformedMessages = messages.map((msg) => ({
      id: msg.id,
      role: msg.role,
      content: msg.content,
      image_url: msg.imageUrl ?? null,
      image_urls: msg.imageUrls ?? (msg.imageUrl ? [msg.imageUrl] : []),
      chat_files: msg.chatFiles ?? undefined,
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
      annotations: transformedAnnotations,
      pagination: {
        total,
        offset,
        limit,
        hasMore: offset + messages.length < total,
      },
    });
  }

  const messages = await listMessages(sessionId, { limit, cursor });

  const transformedMessages = messages.map((msg) => ({
    id: msg.id,
    role: msg.role,
    content: msg.content,
    image_url: msg.imageUrl ?? null,
    image_urls: msg.imageUrls ?? (msg.imageUrl ? [msg.imageUrl] : []),
    chat_files: msg.chatFiles ?? undefined,
    citations: msg.citations ?? [],
    created_at: msg.created_at,
  }));

  return NextResponse.json({
    messages: transformedMessages,
    pagination: {
      limit,
      hasMore: messages.length === limit,
      nextCursor: messages.length > 0 ? messages[messages.length - 1].id : null,
    },
  });
}
