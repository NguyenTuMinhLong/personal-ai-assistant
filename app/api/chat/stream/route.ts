import { currentUser } from "@clerk/nextjs/server";
import { embed, streamText, type UserModelMessage } from "ai";
import { NextRequest, NextResponse } from "next/server";

import { getChatModel, getEmbeddingModel } from "@/lib/ai";
import { hybridSearch } from "@/lib/hybrid-search";
import { buildContext } from "@/lib/context-builder";
import { getUserDocument } from "@/lib/documents";
import { searchFileChunks } from "@/lib/file-cache";
import {
  createChatSession,
  getChatSession,
  saveMessage,
  touchChatSession,
} from "@/lib/sessions";
import { createSupabaseAdminClient } from "@/lib/supabase";
import {
  getCachedImageAnalysis,
  setCachedImageAnalysis,
} from "@/lib/cache/in-memory-cache";
import { getGuestLimits, incrementGuestMessageCount } from "@/lib/guest-auth";

// ─── Types ─────────────────────────────────────────────────────
type RequestBody = {
  documentId?: string;
  message?: string;
  imageUrl?: string;
  imageUrls?: string[];
  chatFiles?: Array<{
    fileId: string;
    filename: string;
    mimeType: string;
    storageUrl: string;
    fileSize: number;
    extractedText?: string | null;
  }>;
  sessionId?: string;
};

// ─── Config ────────────────────────────────────────────────────
const MAX_MESSAGE_LENGTH = 2000;
const MAX_FILE_CHARS = 2500;
const RAG_TOP_K = parseInt(process.env.RAG_TOP_K ?? "", 10) || 8;
const MAX_CONTEXT_CHARS = parseInt(process.env.MAX_CONTEXT_CHARS ?? "", 10) || 3000;
const MAX_CONTEXT_CHARS_WITH_IMAGE = parseInt(process.env.MAX_CONTEXT_CHARS_WITH_IMAGE ?? "", 10) || 2000;

// ─── Constants ──────────────────────────────────────────────────
const VIETNAMESE_REGEX = /[ăâđêôơưáàảãạấầẩẫậắằẳẳặéèẻẽẹếềểễệíìỉĩịóòỏõọốồổỗộớờởỡợúùủũụứừửữựýỳỷỹỵ]/i;

// ─── Helpers ───────────────────────────────────────────────────
function generateRequestId(): string {
  return `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function detectLanguage(text: string): "vi" | "en" {
  if (VIETNAMESE_REGEX.test(text)) return "vi";
  return "en";
}

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 200);
}

function buildSystemPrompt(
  lang: "vi" | "en",
  options: {
    shouldProcessImage: boolean;
    hasContext: boolean;
    hasFileContext: boolean;
    hasFiles: boolean;
    imageUrl?: string;
    documentFilename: string;
    chatFileCount?: number;
    chatFileNames?: string[];
  },
): string {
  const { shouldProcessImage, hasContext, hasFileContext, hasFiles, imageUrl, documentFilename, chatFileCount, chatFileNames } = options;
  const ctx = hasContext || hasFileContext;
  const vi = lang === "vi";

  const citeNote = hasFiles
    ? (vi ? "\n\nVới các file đính kèm, hãy dùng citations kiểu [F1.1] cho file 1 đoạn 1." : "\n\nFor attached files, use citations like [F1.1] for file 1 chunk 1.")
    : "";

  if (imageUrl && !shouldProcessImage) {
    return `Bạn đang trả lời câu hỏi cho người dùng. Họ có gửi kèm 1 ảnh không liên quan nhưng đang hỏi về tài liệu "${documentFilename}".${hasFiles ? " Họ cũng attach thêm files." : ""}

Trả lời THÂN THIỆN, TỰ NHIÊN bằng tiếng Việt:
- Bắt đầu bằng 1 câu châm chích vui về ảnh random (ví dụ: "Ảnh đẹp đấy!", "Bé này dễ thương ghê", ":D")
- Rồi QUAY VỀ trả lời câu hỏi chính dựa trên context
- Nói chuyện như đang chat với bạn, KHÔNG formal
- Đừng nói "dựa trên context" hay "theo như tài liệu" - nói tự nhiên thôi`;
  }

  if (shouldProcessImage) {
    if (ctx) {
      return vi
        ? `Trả lời câu hỏi bằng tiếng Việt, sử dụng ngữ cảnh tài liệu được cung cấp${hasFiles ? ", các file đính kèm" : ""} và hình ảnh (nếu có). Hãy hữu ích và ngắn gọn. Nếu câu trả lời không được hỗ trợ bởi ngữ cảnh, hãy nói rõ điều đó. Khi có thể, hãy đề cập citations như [1] hoặc [2] trong câu trả lời.${citeNote}

Nếu có hình ảnh kèm theo:
- Phân tích hình ảnh cẩn thận nếu nó liên quan đến câu hỏi.
- Nếu hình ảnh không liên quan đến tài liệu, hãy nói: "Tôi nhận thấy hình ảnh này có vẻ không liên quan đến tài liệu. Tôi sẵn sàng giúp nếu bạn có câu hỏi về ${documentFilename}."`
        : `Answer questions in English using the provided document context${hasFiles ? ", attached files" : ""} and any images provided. Be helpful and concise. If the answer is not supported by the context, say that clearly. When possible, mention citations like [1] or [2] inline.${citeNote}

If an image is provided:
- Analyze the image carefully if it's relevant to the question.
- If the image appears unrelated to the document, mention: "I notice this image doesn't seem related to the document. I'm happy to help if you have questions about ${documentFilename}."`;
    } else {
      return vi
        ? `Người dùng đã upload một hình ảnh liên quan đến "${documentFilename}" nhưng không tìm thấy nội dung văn bản cụ thể trong tài liệu.${hasFiles ? " Họ cũng đính kèm các file - hãy đọc chúng để trả lời câu hỏi." : ""}

Hãy phân tích hình ảnh và trả lời câu hỏi của người dùng bằng tiếng Việt. Hãy hữu ích và ngắn gọn. Nếu bạn không thể xác định câu trả lời chỉ từ hình ảnh, hãy nói rõ điều đó.`
        : `A user has uploaded an image related to "${documentFilename}" but no specific text content was found in the document.${hasFiles ? " They also attached files - read them to answer the question." : ""}

Analyze the image and answer the user's question in English. Be helpful and concise. If you cannot determine the answer from the image alone, say so.`;
    }
  }

  if (ctx) {
    return vi
      ? `Trả lời câu hỏi bằng tiếng Việt, sử dụng ngữ cảnh tài liệu được cung cấp${hasFiles ? " và các file đính kèm" : ""}. Hãy hữu ích và ngắn gọn. Nếu câu trả lời không được hỗ trợ bởi ngữ cảnh, hãy nói rõ điều đó. Khi có thể, hãy đề cập citations như [1] hoặc [2] trong câu trả lời.${citeNote}

Lưu ý: Nếu có hình ảnh được đính kèm nhưng bạn không được yêu cầu phân tích, chỉ cần trả lời dựa trên tài liệu. Bạn có thể đề cập ngắn gọn nếu hình ảnh có vẻ hoàn toàn không liên quan đến ${documentFilename}.`
      : `Answer questions in English using the provided document context${hasFiles ? " and attached files" : ""}. Be helpful and concise. If the answer is not supported by the context, say that clearly. When possible, mention citations like [1] or [2] inline.${citeNote}

Note: If an image was attached but you're not asked to analyze it, just answer the question based on the document. You may briefly note if the image seems completely unrelated to ${documentFilename}.`;
  }

  if (hasFiles) {
    const fileList = chatFileNames?.map(f => `"${f}"`).join(", ") ?? "";
    return vi
      ? `Người dùng đã đính kèm ${chatFileCount} file: ${fileList}. Hãy đọc kỹ các file này và trả lời câu hỏi bằng tiếng Việt dựa trên nội dung của chúng. Hãy hữu ích và ngắn gọn. Trích dẫn nguồn file trong câu trả lời của bạn.${citeNote}`
      : `The user has attached ${chatFileCount} file${(chatFileCount ?? 0) > 1 ? "s" : ""}: ${fileList}. Read these files carefully and answer the question in English based on their content. Be helpful and concise. Cite file sources in your answer.${citeNote}`;
  }

  return vi
    ? `Người dùng đang hỏi về "${documentFilename}" nhưng không tìm thấy nội dung cụ thể trong tài liệu. Hãy trả lời bằng tiếng Việt dựa trên kiến thức của bạn nếu có thể, và lưu ý nếu câu hỏi có vẻ không liên quan đến tài liệu.`
    : `The user is asking about "${documentFilename}" but no specific content was found in the document. Answer in English based on your knowledge if possible, and note if the question doesn't seem related to the document.`;
}

// ─── Track stream event (fire-and-forget) ─────────────────────────────────────
function trackStreamEvent(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  userId: string,
  eventType: string,
  eventData: Record<string, unknown>,
) {
  try {
    supabase.from("usage_events").insert({
      user_id: userId,
      event_type: eventType,
      event_data: eventData,
    }).then(({ error }) => {
      if (error) console.error("[analytics] Track event error:", error.message);
    });
  } catch (err) {
    console.error("[analytics] Track event error:", err);
  }
}

// ─── Route exports ─────────────────────────────────────────────
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const requestId = generateRequestId();

  const user = await currentUser();
  const anonymousId = req.headers.get("x-anonymous-id");

  if (!user && !anonymousId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ── Guest trial limit check ──
  if (anonymousId) {
    const limits = await getGuestLimits(anonymousId);
    if (limits.isBlocked) {
      return NextResponse.json(
        { error: "Trial ended. Sign up to continue.", trialEnded: true },
        { status: 403 }
      );
    }
  }

  const supabase = createSupabaseAdminClient();
  const effectiveUserId = user?.id ?? anonymousId!;
  const isGuestMode = !user && !!anonymousId;

  let body: RequestBody;
  try {
    body = (await req.json()) as RequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const message = body.message?.trim() ?? "";
  const imageUrl = body.imageUrl?.trim() || undefined;
  const imageUrls = body.imageUrls?.filter(Boolean).map(u => u.trim()) || undefined;
  const chatFiles = body.chatFiles || undefined;
  const documentId = body.documentId?.trim();
  const incomingSessionId = body.sessionId?.trim();

  if (!documentId) {
    return NextResponse.json({ error: "Choose a document first." }, { status: 400 });
  }
  if (!message) {
    return NextResponse.json({ error: "Ask a question first." }, { status: 400 });
  }
  if (message.length > MAX_MESSAGE_LENGTH) {
    return NextResponse.json(
      { error: `Message too long. Maximum ${MAX_MESSAGE_LENGTH} characters.` },
      { status: 400 }
    );
  }

  // ── Document lookup ──
  let document: { id: string; filename: string } | null = null;
  if (!isGuestMode) {
    document = await getUserDocument(user!.id, documentId);
    if (!document) {
      return NextResponse.json({ error: "Document not found." }, { status: 404 });
    }
  } else {
    document = { id: documentId, filename: documentId };
  }

  // ── Session management ────────────────────────────────────────
  let sessionId = incomingSessionId ?? null;

  if (sessionId) {
    const existing = await getChatSession(effectiveUserId, sessionId);
    if (!existing || existing.document_id !== documentId) {
      sessionId = null;
    }
  }

  if (!sessionId) {
    const session = await createChatSession(effectiveUserId, documentId, message.slice(0, 60));
    sessionId = session?.id ?? null;
  }

  // ── Save user message ─────────────────────────────────────────
  if (sessionId) {
    const allImageUrls = imageUrls && imageUrls.length > 0 ? imageUrls : (imageUrl ? [imageUrl] : undefined);
    await saveMessage(sessionId, "user", message, [], allImageUrls, chatFiles);
    await touchChatSession(sessionId);
  }

  // ── Smart image handling ─────────────────────────────────────
  let shouldProcessImage = !!imageUrl;

  if (imageUrl) {
    const cached = getCachedImageAnalysis(imageUrl);

    if (cached && !cached.isRelated) {
      console.log(`[${requestId}] Image cached as unrelated, skipping AI vision`);
      shouldProcessImage = false;
    } else if (cached && cached.isRelated) {
      console.log(`[${requestId}] Image cached as related:`, cached.description.slice(0, 50));
    } else {
      const questionLower = (message ?? "").toLowerCase();
      const imageKeywords = ["image", "picture", "photo", "screenshot", "this", "what is", "show", "see", "look", "ảnh", "hình"];
      const seemsAskingAboutImage = imageKeywords.some(k => questionLower.includes(k));
      if (!seemsAskingAboutImage) {
        console.log(`[${requestId}] User not asking about image, skipping AI vision`);
        shouldProcessImage = false;
      }
    }
  }

  // ── RAG: hybrid search (skip for guest mode — no uploaded documents) ──
  let context = "";
  if (!isGuestMode) {
    const { embedding: queryEmbedding } = await embed({
      model: getEmbeddingModel(),
      value: message,
    });

    const topChunks = await hybridSearch({
      query: message,
      queryEmbedding,
      documentId,
      topK: RAG_TOP_K,
    });

    if (topChunks.length > 0) {
      const { context: builtContext } = buildContext(topChunks, {
        maxChars: shouldProcessImage ? MAX_CONTEXT_CHARS_WITH_IMAGE : MAX_CONTEXT_CHARS,
        includeMetadata: true,
        compressMode: "smart_truncate",
      });
      context = builtContext;
    }
  }

  // ── File context ──────────────────────────────────────────────
  let fileContext = "";
  if (chatFiles && chatFiles.length > 0) {
    const fileBlocks: string[] = [];
    for (const file of chatFiles) {
      if (file.extractedText?.trim()) {
        const text = file.extractedText.trim();
        if (text.length <= MAX_FILE_CHARS) {
          fileBlocks.push(`[File: ${sanitizeFilename(file.filename)}]\n${text}`);
        } else {
          try {
            const { embedding: fileQueryEmbedding } = await embed({
              model: getEmbeddingModel(),
              value: message,
            });
            const relevant = await searchFileChunks(file.fileId, fileQueryEmbedding, 5);
            if (relevant.length > 0) {
              fileBlocks.push(
                `[File: ${sanitizeFilename(file.filename)}]\n${relevant.map(c => c.content).join("\n\n")}`
              );
            } else {
              fileBlocks.push(`[File: ${sanitizeFilename(file.filename)}]\n${text.slice(0, MAX_FILE_CHARS)}`);
            }
          } catch {
            fileBlocks.push(`[File: ${sanitizeFilename(file.filename)}]\n${text.slice(0, MAX_FILE_CHARS)}`);
          }
        }
      } else {
        fileBlocks.push(`[File: ${sanitizeFilename(file.filename)}]\nURL: ${file.storageUrl}`);
      }
    }

    let built = "";
    for (const block of fileBlocks) {
      if ((built + block + "\n\n").length > MAX_FILE_CHARS) break;
      built += block + "\n\n";
    }
    fileContext = built.trim();
  }

  // ── Build prompt ──────────────────────────────────────────────
  let promptContent: UserModelMessage;

  if (shouldProcessImage && imageUrl) {
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
${fileContext ? `\nAttached files:\n${fileContext}` : ""}

Question:
${message}

Context:
${context}`,
          },
          { type: "image" as const, image: dataUrl },
        ],
      };
    } catch (fetchError) {
      console.warn(`[${requestId}] Failed to fetch image for AI vision, proceeding without image:`, fetchError);
      shouldProcessImage = false;
      promptContent = {
        role: "user",
        content: `Document name: ${document.filename}
${fileContext ? `\nAttached files:\n${fileContext}` : ""}

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
${fileContext ? `\nAttached files:\n${fileContext}` : ""}

Question:
${message}

Context:
${context}`,
    };
  }

  const lang = detectLanguage(message);
  const hasFiles = !!(chatFiles && chatFiles.length > 0);

  const systemPrompt = buildSystemPrompt(lang, {
    shouldProcessImage,
    hasContext: !!context,
    hasFileContext: !!fileContext,
    hasFiles,
    imageUrl,
    documentFilename: document!.filename,
    chatFileCount: chatFiles?.length,
    chatFileNames: chatFiles?.map(f => f.filename),
  });

  // ── Track query event (fire-and-forget, never blocks the response) ──
  trackStreamEvent(supabase, effectiveUserId, "query", {
    documentId,
    sessionId,
    contextUsed: !!context,
    hasFiles,
    imageProcessed: shouldProcessImage,
    isGuest: isGuestMode,
  });

  // ── Save assistant message placeholder to get DB ID ───────────
  const savedAssistantMessage = sessionId
    ? await saveMessage(sessionId, "assistant", "", [])
    : null;
  const serverMessageId = savedAssistantMessage?.id ?? null;

  // ── Stream via SSE ─────────────────────────────────────────────
  const result = streamText({
    model: getChatModel(shouldProcessImage),
    system: systemPrompt,
    messages: [promptContent],
  });

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      // Send session + message ID first so client can use it for feedback
      if (sessionId) {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: "session", sessionId })}\n\n`)
        );
      }
      if (serverMessageId) {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: "message_id", messageId: serverMessageId })}\n\n`)
        );
      }

      const textStream = result.fullStream;

      for await (const event of textStream) {
        if (event.type === "text-delta") {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: "text", content: event.text })}\n\n`)
          );
        }
        if (event.type === "finish") {
          // Cache image processing decision (not the full text, since we stream)
          if (imageUrl && !getCachedImageAnalysis(imageUrl)) {
            setCachedImageAnalysis(imageUrl, shouldProcessImage ? "image processed" : "image skipped", shouldProcessImage);
          }
          // ── Increment guest message count after stream finishes ──
          if (anonymousId) {
            incrementGuestMessageCount(anonymousId).catch((err) =>
              console.error("[guest] Failed to increment message count:", err)
            );
          }
          controller.enqueue(encoder.encode(`data: [DONE]\n\n`));
          controller.close();
          return;
        }
      }

      controller.enqueue(encoder.encode(`data: [DONE]\n\n`));
      controller.close();
    },
    cancel() {
      // Handle stream cancellation
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
      "X-Request-Id": requestId,
    },
  });
}
