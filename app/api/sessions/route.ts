// app/api/sessions/route.ts
import { currentUser } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { listChatSessions } from "@/lib/sessions";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const user = await currentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const documentId = searchParams.get("documentId") ?? undefined;

  const sessions = await listChatSessions(user.id, documentId);
  return NextResponse.json({ sessions });
}