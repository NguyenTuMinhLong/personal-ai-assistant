import { currentUser } from "@clerk/nextjs/server";
import { embed, generateText, type ModelMessage, type UserModelMessage } from "ai";
import { NextRequest, NextResponse } from "next/server";

import { getChatModel, getEmbeddingModel } from "@/lib/ai";
import { getUserDocument, listDocumentEmbeddings } from "@/lib/documents";
import {
  findCachedAnswer,
  type CachedCitation,
  upsertCachedAnswer,
} from "@/lib/qa-cache";
import {
  createChatSession,
  getChatSession,
  saveMessage,
  touchChatSession,
} from "@/lib/sessions";
import {
  getCachedImageAnalysis,
  setCachedImageAnalysis,
} from "@/lib/cache/in-memory-cache";

type RequestBody = {
  documentId?: string;
  message?: string;
  imageUrl?: string;
  imageUrls?: string[];
  sessionId?: string;
};

type EmbeddingRow = {
  chunkIndex: number;
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

function toUICitations(citations: CachedCitation[]) {
  return citations.map((citation, index) => ({
    index: index + 1,
    snippet: citation.contentPreview,
  }));
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
  const imageUrl = body.imageUrl?.trim() || undefined;
  const imageUrls = body.imageUrls?.filter((u: string) => u.trim()) || undefined;
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

  // Note: Images are stored but processed separately for display
  // AI vision processing can be added back once storage is verified

  const document = await getUserDocument(user.id, documentId);

  if (!document) {
    return NextResponse.json({ error: "Document not found." }, { status: 404 });
  }

  try {
    let sessionId = incomingSessionId ?? null;

    // If sessionId provided, validate it exists and belongs to user for this document
    if (sessionId) {
      const existing = await getChatSession(user.id, sessionId);
      
      // Session not found or doesn't belong to this user -> create new session
      if (!existing) {
        sessionId = null;
      } 
      // Session exists but for a different document -> create new session
      else if (existing.document_id !== documentId) {
        sessionId = null;
      }
    }

    // Create new session only if needed
    if (!sessionId) {
      const title = message.slice(0, 60);
      const session = await createChatSession(user.id, documentId, title);
      
      if (!session?.id) {
        return NextResponse.json(
          { error: "Failed to create chat session. Please try again." },
          { status: 500 },
        );
      }
      
      sessionId = session.id;
    }

    const cached = await findCachedAnswer({
      userId: user.id,
      documentId,
      question: message,
      sessionId: sessionId
    });

    if (cached) {
      let assistantMessageId: string | null = null;

      if (sessionId) {
        const allImageUrls = imageUrls && imageUrls.length > 0 ? imageUrls : (imageUrl ? [imageUrl] : undefined);
        await saveMessage(sessionId, "user", message, [], allImageUrls);

        const savedAssistantMessage = await saveMessage(
          sessionId,
          "assistant",
          cached.answer,
          cached.citations,
        );

        await touchChatSession(sessionId);
        assistantMessageId = savedAssistantMessage?.id ?? null;
      }

      return NextResponse.json({
        answer: cached.answer,
        citations: toUICitations(cached.citations),
        sessionId,
        assistantMessageId,
        reused: true,
        document: {
          id: document.id,
          filename: document.filename,
        },
      });
    }

    // Context size limits to save tokens
    const MAX_CONTEXT_CHARS = 3000;
    const MAX_CONTEXT_CHARS_WITH_IMAGE = 2000;

    const rows = await listDocumentEmbeddings(documentId);
    let citations: Array<{ index: number; snippet: string }> = [];
    let context = "";

    // Smart image handling - check cache and pre-filter
    let shouldProcessImage = !!imageUrl;

    if (imageUrl) {
      // Check if image was previously analyzed
      const cached = getCachedImageAnalysis(imageUrl);

      if (cached && !cached.isRelated) {
        // Image was previously analyzed as unrelated - skip AI vision entirely
        console.log("Image cached as unrelated, skipping AI vision");
        shouldProcessImage = false;
      } else if (cached && cached.isRelated) {
        // Image was previously analyzed as related - use cache hint
        console.log("Image cached as related:", cached.description.slice(0, 50));
        // Still process it since it's related
      } else {
        // No cache - check if user is actually asking about the image
        const questionLower = (message ?? "").toLowerCase();
        const imageKeywords = ["image", "picture", "photo", "screenshot", "this", "what is", "show", "see", "look"];
        const seemsAskingAboutImage = imageKeywords.some(k => questionLower.includes(k));

        // If user is NOT asking about the image and no cache, skip AI vision
        if (!seemsAskingAboutImage) {
          console.log("User not asking about image, skipping AI vision");
          shouldProcessImage = false;
        }
      }
    }

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

        // Build context with chunk limit based on image presence
        const maxChars = shouldProcessImage ? MAX_CONTEXT_CHARS_WITH_IMAGE : MAX_CONTEXT_CHARS;
        const chunkTexts = topChunks.map((chunk, index) => `[${index + 1}] ${chunk.content}`);
        let builtContext = "";
        for (const chunkText of chunkTexts) {
          if ((builtContext + chunkText + "\n\n").length > maxChars) break;
          builtContext += chunkText + "\n\n";
        }
        context = builtContext.trim();
      }
    }

    // If no embeddings found, do NOT fallback to full document content
  // Just use empty context - the question will be answered based on general knowledge
  // This prevents burning tokens on unrelated full document content
  if (citations.length === 0) {
    // No relevant content found - AI will answer from its knowledge
    // Only include filename for reference
    context = "";
  }

    // Build prompt content and handle image if present
    let promptContent: UserModelMessage;

    if (shouldProcessImage && imageUrl) {
      // Convert image to base64 for AI vision
      try {
        const imageRes = await fetch(imageUrl);
        if (!imageRes.ok) {
          throw new Error(`Failed to fetch image: ${imageRes.status}`);
        }
        const imageBuffer = await imageRes.arrayBuffer();
        const base64 = Buffer.from(imageBuffer).toString("base64");
        const mimeType = imageRes.headers.get("content-type") || "image/jpeg";
        const dataUrl = `data:${mimeType};base64,${base64}`;

        promptContent = {
          role: "user",
          content: [
            {
              type: "text" as const,
              text: `Document name: ${document.filename}

Question:
${message}

Context:
${context}`,
            },
            { type: "image" as const, image: dataUrl },
          ],
        };
      } catch (fetchError) {
        console.warn("Failed to fetch image for AI vision, proceeding without image:", fetchError);
        shouldProcessImage = false;
        promptContent = {
          role: "user",
          content: `Document name: ${document.filename}

Question:
${message}

Context:
${context}`,
        };
      }
    } else {
      promptContent = {
        role: "user",
        content: `Document name: ${document.filename}

Question:
${message}

Context:
${context}`,
      };
    }

    // Build system prompt based on context availability
    let systemPrompt: string;
    if (shouldProcessImage) {
      if (context) {
        systemPrompt = `You answer questions using the provided document context and any images provided. Be helpful and concise. If the answer is not supported by the context, say that clearly. When possible, mention citations like [1] or [2] inline.

If an image is provided:
- Analyze the image carefully if it's relevant to the question.
- If the image appears unrelated to the document, mention: "I notice this image doesn't seem related to the document. I'm happy to help if you have questions about ${document.filename}."`;
      } else {
        // No document context but has image - focus on image analysis
        systemPrompt = `A user has uploaded an image related to "${document.filename}" but no specific text content was found in the document.

Analyze the image and answer the user's question. Be helpful and concise. If you cannot determine the answer from the image alone, say so.`;
      }
    } else {
      if (context) {
        // Check if user sent a random image with their question
        const hadRandomImage = !!imageUrl;
        if (hadRandomImage) {
          // Casual Vietnamese response for random images
          systemPrompt = `Bạn đang trả lời câu hỏi cho người dùng. Họ có gửi kèm 1 ảnh không liên quan nhưng đang hỏi về tài liệu "${document.filename}".
          
Trả lời THÂN THIỆN, TỰ NHIÊN bằng tiếng Việt:
- Bắt đầu bằng 1 câu châm chích vui về ảnh random (ví dụ: "Ảnh đẹp đấy!", "Bé này dễ thương ghê", ":D")
- Rồi QUAY VỀ trả lời câu hỏi chính dựa trên context
- Nói chuyện như đang chat với bạn, KHÔNG formal
- Đừng nói "dựa trên context" hay "theo như tài liệu" - nói tự nhiên thôi`;
        } else {
          systemPrompt = `You answer questions using only the provided document context. Be helpful and concise. If the answer is not supported by the context, say that clearly. When possible, mention citations like [1] or [2] inline.

Note: If an image was attached but you're not asked to analyze it, just answer the question based on the document. You may briefly note if the image seems completely unrelated to ${document.filename}.`;
        }
      } else {
        // No context and no image - user asked a general question
        systemPrompt = `The user is asking about "${document.filename}" but no specific content was found in the document for their question. Answer based on your knowledge if possible, and note if the question doesn't seem related to the document.`;
      }
    }

    const { text } = await generateText({
      model: getChatModel(shouldProcessImage),
      system: systemPrompt,
      messages: [promptContent],
    });

    // Cache image analysis for future deduplication
    if (imageUrl) {
      if (shouldProcessImage) {
        // Image was processed - cache based on response
        const isRelated = !text.toLowerCase().includes("doesn't seem related") &&
                          !text.toLowerCase().includes("not related");
        setCachedImageAnalysis(imageUrl, text.slice(0, 200), isRelated);
      } else {
        // Image was skipped (random) - cache as unrelated
        console.log("Caching random image as unrelated");
        setCachedImageAnalysis(imageUrl, "random image", false);
      }
    }

    const dbCitations: CachedCitation[] = citations.map((citation) => ({
      filename: document.filename,
      chunkIndex: citation.index,
      contentPreview: citation.snippet,
    }));

    let assistantMessageId: string | null = null;

    if (sessionId) {
      // Pass all image URLs to saveMessage
      const allImageUrls = imageUrls && imageUrls.length > 0 ? imageUrls : (imageUrl ? [imageUrl] : undefined);
      const savedUserMessage = await saveMessage(sessionId, "user", message, [], allImageUrls);

      if (!savedUserMessage) {
        console.error("[chat] Failed to save user message, continuing anyway");
      }

      const savedAssistantMessage = await saveMessage(
        sessionId,
        "assistant",
        text,
        dbCitations,
      );

      if (!savedAssistantMessage) {
        console.error("[chat] Failed to save assistant message");
      }

      await touchChatSession(sessionId);

      assistantMessageId = savedAssistantMessage?.id ?? null;
    }

    await upsertCachedAnswer({
      userId: user.id,
      documentId,
      sessionId,
      question: message,
      answer: text,
      citations: dbCitations,
    });

    return NextResponse.json({
      answer: text,
      citations,
      sessionId,
      assistantMessageId,
      reused: false,
      document: {
        id: document.id,
        filename: document.filename,
      },
    });
  } catch (error) {
    console.error("Chat API Error:", error);

    // Log more details for debugging
    if (error instanceof Error) {
      console.error("Error name:", error.name);
      console.error("Error message:", error.message);
      console.error("Error stack:", error.stack);

      // Check for specific error types
      if (error.message.includes("rate limit") || error.message.includes("quota")) {
        return NextResponse.json(
          { error: "AI rate limit reached. Please wait a moment and try again." },
          { status: 429 }
        );
      }
      if (error.message.includes("Invalid JSON") || error.message.includes("invalid response")) {
        return NextResponse.json(
          { error: "AI returned an invalid response. Please try again." },
          { status: 502 }
        );
      }
      if (error.message.includes("fetch") || error.message.includes("network")) {
        return NextResponse.json(
          { error: "Network error. Please check your connection and try again." },
          { status: 503 }
        );
      }
    }

    // Generic AI SDK error check
    if (error && typeof error === "object" && "message" in error) {
      const errorObj = error as { message?: string; cause?: unknown };
      if (errorObj.message?.includes("Invalid JSON")) {
        return NextResponse.json(
          { error: "AI returned an invalid response. Please try again." },
          { status: 502 }
        );
      }
    }

    const errorMessage =
      error instanceof Error ? error.message : "Could not answer this question.";

    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}