import { currentUser } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";

import { deleteChatSession, getChatSession } from "@/lib/sessions";

export const dynamic = "force-dynamic";

type RouteParams = {
  params: Promise<{ sessionId: string }>;
};

export async function DELETE(
  _req: NextRequest,
  { params }: RouteParams,
) {
  const user = await currentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { sessionId } = await params;

  if (!sessionId) {
    return NextResponse.json(
      { error: "Session id is required." },
      { status: 400 },
    );
  }

  // Verify session exists and belongs to user
  const session = await getChatSession(user.id, sessionId);
  
  if (!session) {
    return NextResponse.json(
      { error: "Session not found." },
      { status: 404 },
    );
  }

  try {
    await deleteChatSession(user.id, sessionId);
    return NextResponse.json({ success: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not delete session.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
