import { currentUser } from "@clerk/nextjs/server";
import { embed } from "ai";
import { NextRequest, NextResponse } from "next/server";

import { getEmbeddingModel } from "@/lib/ai";
import { crossDocumentSearch } from "@/lib/hybrid-search";
import { createSupabaseServerClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RequestBody = {
  query: string;
};

export async function POST(req: NextRequest) {
  const user = await currentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: RequestBody;
  try {
    body = (await req.json()) as RequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const query = body.query?.trim();
  if (!query || query.length < 2) {
    return NextResponse.json({ error: "Query must be at least 2 characters." }, { status: 400 });
  }

  if (query.length > 300) {
    return NextResponse.json({ error: "Query too long (max 300 characters)." }, { status: 400 });
  }

  try {
    // Embed the query
    const { embedding } = await embed({
      model: getEmbeddingModel(),
      value: query,
    });

    // Perform cross-document search
    const chunks = await crossDocumentSearch(query, embedding, user.id, {
      topK: 30,
      chunksPerDoc: 4,
    });

    // Group results by document
    const docGroups = new Map<string, { docName: string; chunks: typeof chunks; totalScore: number }>();

    for (const chunk of chunks) {
      const docId = chunk.documentId ?? "unknown";
      if (!docGroups.has(docId)) {
        docGroups.set(docId, { docName: "", chunks: [], totalScore: 0 });
      }
      const group = docGroups.get(docId)!;
      group.chunks.push(chunk);
      group.totalScore += chunk.score;
    }

    // Fetch document names
    const supabase = await createSupabaseServerClient();
    const docIds = Array.from(docGroups.keys()).filter(id => id !== "unknown");
    let docNames: Record<string, string> = {};

    if (docIds.length > 0) {
      const { data } = await supabase
        .from("documents")
        .select("id, filename")
        .in("id", docIds);
      if (data) {
        for (const doc of data) {
          docNames[doc.id] = doc.filename;
        }
      }
    }

    // Build final results
    const results = Array.from(docGroups.entries()).map(([docId, group]) => ({
      documentId: docId,
      documentName: docNames[docId] ?? group.docName ?? "Unknown Document",
      chunks: group.chunks,
      totalScore: group.totalScore,
    }));

    // Sort by total score descending
    results.sort((a, b) => b.totalScore - a.totalScore);

    return NextResponse.json({
      results,
      query,
      totalResults: chunks.length,
      searchedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[global-search] Error:", error);
    return NextResponse.json({ error: "Search failed. Please try again." }, { status: 500 });
  }
}
