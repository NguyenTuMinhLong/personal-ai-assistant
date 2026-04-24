import { currentUser } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";

import {
  deleteMessageAnnotation,
  upsertMessageAnnotation,
  type HighlightColor,
} from "@/lib/annotations";
import { getChatSession, getSessionMessage } from "@/lib/sessions";

type RequestBody = {
  sessionId?: string;
  messageId?: string;
  noteContent?: string | null;
  highlightColor?: HighlightColor | null;
  selectionStart?: number | null;
  selectionEnd?: number | null;
  isPinned?: boolean;
};

const VALID_HIGHLIGHT_COLORS = new Set<HighlightColor>([
  "rose",
  "amber",
  "emerald",
  "sky",
  "violet",
]);

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const user = await currentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: RequestBody;

  try {
    body = (await req.json()) as RequestBody;
  } catch {
    return NextResponse.json(
      { error: "Invalid request body." },
      { status: 400 },
    );
  }

  const sessionId = body.sessionId?.trim();
  const messageId = body.messageId?.trim();
  const noteContent = body.noteContent?.trim() || null;
  const highlightColor = body.highlightColor ?? null;
  const isPinned = body.isPinned ?? false;

  const selectionStart =
    typeof body.selectionStart === "number" &&
    Number.isInteger(body.selectionStart)
      ? body.selectionStart
      : null;

  const selectionEnd =
    typeof body.selectionEnd === "number" && Number.isInteger(body.selectionEnd)
      ? body.selectionEnd
      : null;

  if (!sessionId || !messageId) {
    return NextResponse.json(
      { error: "sessionId and messageId are required." },
      { status: 400 },
    );
  }

  if (highlightColor && !VALID_HIGHLIGHT_COLORS.has(highlightColor)) {
    return NextResponse.json(
      { error: "Invalid highlight color." },
      { status: 400 },
    );
  }

  if ((selectionStart === null) !== (selectionEnd === null)) {
    return NextResponse.json(
      { error: "selectionStart and selectionEnd must be provided together." },
      { status: 400 },
    );
  }

  if (
    selectionStart !== null &&
    selectionEnd !== null &&
    (selectionStart < 0 || selectionEnd <= selectionStart)
  ) {
    return NextResponse.json(
      { error: "Invalid text selection range." },
      { status: 400 },
    );
  }

  const session = await getChatSession(user.id, sessionId);

  if (!session) {
    return NextResponse.json({ error: "Session not found." }, { status: 404 });
  }

  const message = await getSessionMessage(sessionId, messageId);

  if (!message) {
    return NextResponse.json({ error: "Message not found." }, { status: 404 });
  }

  if (message.role !== "assistant") {
    return NextResponse.json(
      { error: "Only assistant messages can be annotated." },
      { status: 400 },
    );
  }

  const documentId = (session as { document_id?: string }).document_id;

  if (!documentId) {
    return NextResponse.json(
      { error: "Session is missing document_id." },
      { status: 400 },
    );
  }

  try {
    // Delete if: no content, no color, and not pinning (unpinning)
    if (!noteContent && !highlightColor && !isPinned) {
      await deleteMessageAnnotation(user.id, messageId);
      return NextResponse.json({ success: true, deleted: true });
    }

    const annotation = await upsertMessageAnnotation({
      userId: user.id,
      sessionId,
      documentId,
      messageId,
      noteContent,
      highlightColor,
      selectionStart,
      selectionEnd,
      isPinned,
    });

    return NextResponse.json({
      success: true,
      annotation,
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Could not save annotation.";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}