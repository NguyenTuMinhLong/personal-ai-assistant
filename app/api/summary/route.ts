// app/api/summary/route.ts
import { currentUser } from "@clerk/nextjs/server";
import { generateText } from "ai";
import { NextRequest, NextResponse } from "next/server";

import { getChatModel } from "@/lib/ai";
import { getUserDocument } from "@/lib/documents";
import { supabaseClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const user = await currentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { documentId } = (await req.json()) as { documentId?: string };
  if (!documentId) {
    return NextResponse.json({ error: "documentId required" }, { status: 400 });
  }

  const document = await getUserDocument(user.id, documentId);
  if (!document) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  // Nếu đã có summary thì trả luôn
  if (document.summary) {
    return NextResponse.json({ summary: document.summary });
  }

  const { text: summary } = await generateText({
    model: getChatModel(),
    system:
      "You are a document summarizer. Summarize the document in 3-5 concise sentences. Focus on: main topic, key points, and purpose. Match the language of the document.",
    prompt: document.content.slice(0, 8000),
  });

  // Lưu vào DB
  await supabaseClient
    .from("documents")
    .update({ summary })
    .eq("id", documentId)
    .eq("user_id", user.id);

  return NextResponse.json({ summary });
}