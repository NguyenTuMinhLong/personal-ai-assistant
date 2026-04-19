import { currentUser } from "@clerk/nextjs/server";
import { embed, generateText } from "ai";
import { NextRequest, NextResponse } from "next/server";

import { getChatModel, getEmbeddingModel } from "@/lib/ai";
import { getUserDocument, listDocumentEmbeddings } from "@/lib/documents";
import {
  createChatSession,
  getChatSession,
  saveMessage,
  touchChatSession,
} from "@/lib/sessions";

type RequestBody = {
  documentId?: string;
  message?: string;
  sessionId?: string;
};

type EmbeddingRow = {
  chunk_index: number;
  content: string;
  embedding: unknown;
};

function parseEmbedding(value: unknown) {
  if (Array.isArray(value)) {
    return value.filter((item): item is number => typeof item === "number");
  }

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);

      if (Array.isArray(parsed)) {
        return parsed.filter((item): item is number => typeof item === "number");
      }
    } catch {}
  }

  return [];
}

function cosineSimilarity(a: number[], b: number[]) {
  if (!a.length || !b.length || a.length !== b.length) {
    return -1;
  }

  let dotProduct = 0;
  let magnitudeA = 0;
  let magnitudeB = 0;

  for (let index = 0; index < a.length; index += 1) {
    dotProduct += a[index] * b[index];
    magnitudeA += a[index] * a[index];
    magnitudeB += b[index] * b[index];
  }

  if (!magnitudeA || !magnitudeB) {
    return -1;
  }

  return dotProduct / (Math.sqrt(magnitudeA) * Math.sqrt(magnitudeB));
}

function rankChunks(rows: EmbeddingRow[], queryEmbedding: number[]) {
  return rows
    .map((row) => ({
      ...row,
      score: cosineSimilarity(queryEmbedding, parseEmbedding(row.embedding)),
    }))
    .filter((row) => row.score >= 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 4);
}

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

  const message = body.message?.trim();
  const documentId = body.documentId?.trim();
  const incomingSessionId = body.sessionId?.trim();

  if (!documentId) {
    return NextResponse.json(
      { error: "Choose a document first." },
      { status: 400 },
    );
  }

  if (!message) {
    return NextResponse.json(
      { error: "Ask a question first." },
      { status: 400 },
    );
  }

  const document = await getUserDocument(user.id, documentId);

  if (!document) {
    return NextResponse.json({ error: "Document not found." }, { status: 404 });
  }

  try {
    let sessionId = incomingSessionId ?? null;

    if (sessionId) {
      const existing = await getChatSession(user.id, sessionId);

      if (!existing) {
        sessionId = null;
      }
    }

    if (!sessionId) {
      const title = message.slice(0, 60);
      const session = await createChatSession(user.id, documentId, title);
      sessionId = session?.id ?? null;
    }

    const rows = await listDocumentEmbeddings(documentId);
    let citations: Array<{ index: number; snippet: string }> = [];
    let context = document.content.slice(0, 6000);

    if (rows.length > 0) {
      const { embedding: queryEmbedding } = await embed({
        model: getEmbeddingModel(),
        value: message,
      });

      const topChunks = rankChunks(rows, queryEmbedding);

      if (topChunks.length > 0) {
        citations = topChunks.map((chunk, index) => ({
          index: index + 1,
          snippet: chunk.content.slice(0, 280),
        }));

        context = topChunks
          .map((chunk, index) => `[${index + 1}] ${chunk.content}`)
          .join("\n\n");
      }
    }

    if (citations.length === 0) {
      citations = [
        {
          index: 1,
          snippet: document.content.slice(0, 280),
        },
      ];
    }

    const { text } = await generateText({
      model: getChatModel(),
      system:
        "You answer questions using only the provided document context. Be helpful and concise. If the answer is not supported by the context, say that clearly. When possible, mention citations like [1] or [2] inline.",
      prompt: `Document name: ${document.filename}

Question:
${message}

Context:
${context}`,
    });

    let assistantMessageId: string | null = null;

    if (sessionId) {
      const dbCitations = citations.map((citation) => ({
        filename: document.filename,
        chunk_index: citation.index,
        content_preview: citation.snippet,
      }));

      await saveMessage(sessionId, "user", message);

      const savedAssistantMessage = await saveMessage(
        sessionId,
        "assistant",
        text,
        dbCitations,
      );

      await touchChatSession(sessionId);

      assistantMessageId = savedAssistantMessage?.id ?? null;
    }

    return NextResponse.json({
      answer: text,
      citations,
      sessionId,
      assistantMessageId,
      document: {
        id: document.id,
        filename: document.filename,
      },
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Could not answer this question.";

    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}