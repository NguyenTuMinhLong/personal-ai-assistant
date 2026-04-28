import { currentUser } from "@clerk/nextjs/server";
import { embed, generateText, type UserModelMessage } from "ai";
import { NextRequest, NextResponse } from "next/server";

import { getChatModel, getEmbeddingModel } from "@/lib/ai";
import { hybridSearch } from "@/lib/hybrid-search";
import { buildContext } from "@/lib/context-builder";
import { getUserDocument } from "@/lib/documents";
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
import { createSupabaseAdminClient } from "@/lib/supabase";
import {
  searchFileChunks,
} from "@/lib/file-cache";

// ─── Analytics helper ──────────────────────────────────────────
async function trackEvent(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  userId: string,
  eventType: string,
  eventData: Record<string, unknown> = {}
) {
  try {
    await supabase.from("usage_events").insert({
      user_id: userId,
      event_type: eventType,
      event_data: eventData,
    });
  } catch (error) {
    console.error("[analytics] Failed to track event:", error);
  }
}

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
const MAX_IMAGES = 5;
const MAX_FILES = 3;
const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024; // 20MB
const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

// ─── Constants ──────────────────────────────────────────────────
const VIETNAMESE_REGEX = /[ăâđêôơưáàảãạấầẩẫậắằẳẳặéèẻẽẹếềểễệíìỉĩịóòỏõọốồổỗộớờởỡợúùủũụứừửữựýỳỷỹỵ]/i;

// ─── Helpers ───────────────────────────────────────────────────
function generateRequestId(): string {
  return `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function toUICitations(citations: CachedCitation[]) {
  return citations.map((citation, index) => ({
    index: index + 1,
    snippet: citation.contentPreview,
    filename: citation.filename,
    chunkIndex: citation.chunkIndex,
  }));
}

function detectLanguage(text: string): "vi" | "en" {
  if (VIETNAMESE_REGEX.test(text)) return "vi";
  return "en";
}

function validateFileSize(size: number, maxBytes: number, label: string): string | null {
  if (size === 0) return `${label} is empty.`;
  if (size > maxBytes) return `${label} exceeds maximum size of ${Math.round(maxBytes / 1024 / 1024)}MB.`;
  if (size < 1000) return `${label} appears corrupted or invalid.`;
  return null;
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

function isDuplicateQuestion(
  cached: { answer: string; cachedAt: number },
  answer: string,
  timeWindowMs = 30_000,
): boolean {
  return (
    cached.answer.trim() === answer.trim() &&
    Date.now() - cached.cachedAt < timeWindowMs
  );
}

// ─── Route exports ─────────────────────────────────────────────
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const requestId = generateRequestId();
  const startTime = Date.now();

  const user = await currentUser();

  if (!user) {
    return NextResponse.json(
      { error: "Unauthorized", requestId },
      { status: 401 },
    );
  }

  const supabase = createSupabaseAdminClient();

  let body: RequestBody;

  try {
    body = (await req.json()) as RequestBody;
  } catch {
    return NextResponse.json(
      { error: "Invalid request body. Expected JSON.", requestId },
      { status: 400 },
    );
  }

  const message = body.message?.trim() ?? "";
  const imageUrl = body.imageUrl?.trim() || undefined;
  const imageUrls = body.imageUrls?.filter(Boolean).map(u => u.trim()) || undefined;
  const chatFiles = body.chatFiles || undefined;
  const documentId = body.documentId?.trim();
  const incomingSessionId = body.sessionId?.trim();

  // ── Input validation ──────────────────────────────────────────
  if (!documentId) {
    return NextResponse.json(
      { error: "Choose a document first.", requestId },
      { status: 400 },
    );
  }

  if (!message) {
    return NextResponse.json(
      { error: "Ask a question first.", requestId },
      { status: 400 },
    );
  }

  if (message.length > MAX_MESSAGE_LENGTH) {
    return NextResponse.json(
      {
        error: `Message too long. Maximum ${MAX_MESSAGE_LENGTH} characters. You used ${message.length}.`,
        requestId,
      },
      { status: 400 },
    );
  }

  if (message.length < 2) {
    return NextResponse.json(
      { error: "Message too short. Please ask a meaningful question.", requestId },
      { status: 400 },
    );
  }

  // Validate attached files
  if (chatFiles && chatFiles.length > MAX_FILES) {
    return NextResponse.json(
      { error: `Maximum ${MAX_FILES} files allowed.`, requestId },
      { status: 400 },
    );
  }

  for (const file of chatFiles ?? []) {
    const sizeErr = validateFileSize(file.fileSize, MAX_FILE_SIZE_BYTES, `File "${file.filename}"`);
    if (sizeErr) {
      return NextResponse.json({ error: sizeErr, requestId }, { status: 400 });
    }
  }

  const document = await getUserDocument(user.id, documentId);

  if (!document) {
    return NextResponse.json(
      { error: "Document not found.", requestId },
      { status: 404 },
    );
  }

  // ── Session management ────────────────────────────────────────
  let sessionId = incomingSessionId ?? null;

  if (sessionId) {
    const existing = await getChatSession(user.id, sessionId);

    if (!existing || existing.document_id !== documentId) {
      sessionId = null;
    }
  }

  if (!sessionId) {
    const title = message.slice(0, 60);
    const session = await createChatSession(user.id, documentId, title);

    if (!session?.id) {
      return NextResponse.json(
        { error: "Failed to create chat session. Please try again.", requestId },
        { status: 500 },
      );
    }

    sessionId = session.id;

    trackEvent(supabase, user.id, "chat_session_created", {
      sessionId: session.id,
      documentId,
    });
  }

  // ── Cache lookup ──────────────────────────────────────────────
  const cached = await findCachedAnswer({
    userId: user.id,
    documentId,
    question: message,
    sessionId,
  });

  if (cached) {
    let assistantMessageId: string | null = null;

    if (sessionId) {
      const allImageUrls = imageUrls && imageUrls.length > 0 ? imageUrls : (imageUrl ? [imageUrl] : undefined);
      await saveMessage(sessionId, "user", message, [], allImageUrls, chatFiles);

      const savedAssistantMessage = await saveMessage(
        sessionId,
        "assistant",
        cached.answer,
        cached.citations,
      );

      await touchChatSession(sessionId);
      assistantMessageId = savedAssistantMessage?.id ?? null;
    }

    const elapsedMs = Date.now() - startTime;

    trackEvent(supabase, user.id, "cache_hit", { documentId, sessionId, elapsedMs });

    return NextResponse.json({
      answer: cached.answer,
      citations: toUICitations(cached.citations),
      sessionId,
      assistantMessageId,
      reused: true,
      cacheHit: true,
      document: {
        id: document.id,
        filename: document.filename,
      },
      requestId,
      meta: {
        elapsedMs,
        contextUsed: false,
        imageProcessed: false,
      },
    }, {
      headers: {
        "X-Request-Id": requestId,
        "X-Cache-Hit": "true",
        "X-Response-Time": String(elapsedMs),
      },
    });
  }

  // ── Context size limits ───────────────────────────────────────
  const MAX_CONTEXT_CHARS = parseInt(process.env.MAX_CONTEXT_CHARS ?? "", 10) || 3000;
  const MAX_CONTEXT_CHARS_WITH_IMAGE = parseInt(process.env.MAX_CONTEXT_CHARS_WITH_IMAGE ?? "", 10) || 2000;
  const RAG_TOP_K = parseInt(process.env.RAG_TOP_K ?? "", 10) || 8;

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

  // ── RAG: hybrid search ───────────────────────────────────────
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

  let citations: CachedCitation[] = [];
  let context = "";

  if (topChunks.length > 0) {
    const { context: builtContext, citations: builtCitations } = buildContext(topChunks, {
      maxChars: shouldProcessImage ? MAX_CONTEXT_CHARS_WITH_IMAGE : MAX_CONTEXT_CHARS,
      includeMetadata: true,
      compressMode: "smart_truncate",
    });

    context = builtContext;
    citations = builtCitations.map((c, idx) => ({
      index: idx + 1,
      snippet: c.snippet,
      filename: document.filename,
      chunkIndex: idx + 1,
      contentPreview: c.snippet,
    }));
  }

  // ── File context ──────────────────────────────────────────────
  const MAX_FILE_CHARS = 2500;
  const citedFileCitations: Array<{ filename: string; chunkIndex: number; contentPreview: string }> = [];

  let fileContext = "";

  if (chatFiles && chatFiles.length > 0) {
    const fileBlocks: string[] = [];
    let citationIdx = 0;

    for (const file of chatFiles) {
      if (file.extractedText && file.extractedText.trim()) {
        const text = file.extractedText.trim();

        if (text.length <= MAX_FILE_CHARS) {
          citationIdx++;
          fileBlocks.push(`[File: ${sanitizeFilename(file.filename)}]\n${text}`);
          citedFileCitations.push({
            filename: file.filename,
            chunkIndex: citationIdx,
            contentPreview: text.slice(0, 280),
          });
        } else {
          try {
            const { embedding: fileQueryEmbedding } = await embed({
              model: getEmbeddingModel(),
              value: message,
            });
            const relevant = await searchFileChunks(file.fileId, fileQueryEmbedding, 5);
            citationIdx++;

            if (relevant.length > 0) {
              const block = relevant.map((c) => c.content).join("\n\n");
              fileBlocks.push(`[File: ${sanitizeFilename(file.filename)}]\n${block}`);
              relevant.forEach((c) =>
                citedFileCitations.push({
                  filename: file.filename,
                  chunkIndex: c.index,
                  contentPreview: c.content.slice(0, 280),
                }),
              );
            } else {
              fileBlocks.push(`[File: ${sanitizeFilename(file.filename)}]\n${text.slice(0, MAX_FILE_CHARS)}`);
              citedFileCitations.push({
                filename: file.filename,
                chunkIndex: citationIdx,
                contentPreview: text.slice(0, 280),
              });
            }
          } catch {
            citationIdx++;
            fileBlocks.push(`[File: ${sanitizeFilename(file.filename)}]\n${text.slice(0, MAX_FILE_CHARS)}`);
            citedFileCitations.push({
              filename: file.filename,
              chunkIndex: citationIdx,
              contentPreview: text.slice(0, 280),
            });
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
    documentFilename: document.filename,
    chatFileCount: chatFiles?.length,
    chatFileNames: chatFiles?.map(f => f.filename),
  });

  // ── AI generation ────────────────────────────────────────────
  let text: string;

  try {
    const result = await generateText({
      model: getChatModel(shouldProcessImage),
      system: systemPrompt,
      messages: [promptContent],
    });

    text = result.text;
  } catch (error) {
    console.error(`[${requestId}] AI generation error:`, error);

    if (error instanceof Error) {
      const msg = error.message.toLowerCase();

      if (msg.includes("rate limit") || msg.includes("quota") || msg.includes("429")) {
        return NextResponse.json(
          { error: "AI rate limit reached. Please wait a moment and try again.", requestId },
          { status: 429 },
        );
      }
      if (msg.includes("invalid json") || msg.includes("invalid response") || msg.includes("parse")) {
        return NextResponse.json(
          { error: "AI returned an invalid response. Please try again.", requestId },
          { status: 502 },
        );
      }
      if (msg.includes("fetch") || msg.includes("network") || msg.includes("econnreset")) {
        return NextResponse.json(
          { error: "Network error connecting to AI service. Please check your connection and try again.", requestId },
          { status: 503 },
        );
      }
      if (msg.includes("context_length") || msg.includes("context_window") || msg.includes("maximum")) {
        return NextResponse.json(
          { error: "Question or context is too long. Try a shorter question or a smaller document.", requestId },
          { status: 400 },
        );
      }
    }

    return NextResponse.json(
      { error: "Failed to generate response. Please try again.", requestId },
      { status: 500 },
    );
  }

  // ── Cache image analysis ─────────────────────────────────────
  if (imageUrl) {
    if (shouldProcessImage) {
      const isRelated =
        !text.toLowerCase().includes("không liên quan") &&
        !text.toLowerCase().includes("not related");
      setCachedImageAnalysis(imageUrl, text.slice(0, 200), isRelated);
    } else {
      console.log(`[${requestId}] Caching random image as unrelated`);
      setCachedImageAnalysis(imageUrl, "random image", false);
    }
  }

  // ── Persist to DB ────────────────────────────────────────────
  const docCitations: CachedCitation[] = citations.map((citation) => ({
    filename: document.filename,
    chunkIndex: citation.chunkIndex,
    contentPreview: citation.contentPreview,
  }));
  const dbCitations: CachedCitation[] = [...citedFileCitations, ...docCitations];

  let assistantMessageId: string | null = null;

  if (sessionId) {
    const allImageUrls = imageUrls && imageUrls.length > 0 ? imageUrls : (imageUrl ? [imageUrl] : undefined);
    const savedUserMessage = await saveMessage(sessionId, "user", message, [], allImageUrls, chatFiles);

    if (!savedUserMessage) {
      console.error(`[${requestId}] Failed to save user message, continuing anyway`);
    }

    const savedAssistantMessage = await saveMessage(
      sessionId,
      "assistant",
      text,
      dbCitations,
    );

    if (!savedAssistantMessage) {
      console.error(`[${requestId}] Failed to save assistant message`);
    }

    await touchChatSession(sessionId);
    assistantMessageId = savedAssistantMessage?.id ?? null;
  }

  // ── Cache answer ─────────────────────────────────────────────
  await upsertCachedAnswer({
    userId: user.id,
    documentId,
    sessionId,
    question: message,
    answer: text,
    citations: dbCitations,
  });

  const elapsedMs = Date.now() - startTime;

  // Fire-and-forget: don't await, don't block response
  trackEvent(supabase, user.id, "query", {
    documentId,
    sessionId,
    reused: false,
    elapsedMs,
    contextUsed: topChunks.length > 0,
    imageProcessed: shouldProcessImage,
  });

  return NextResponse.json({
    answer: text,
    citations: toUICitations(citations),
    sessionId,
    assistantMessageId,
    reused: false,
    cacheHit: false,
    document: {
      id: document.id,
      filename: document.filename,
    },
    requestId,
    meta: {
      elapsedMs,
      contextUsed: topChunks.length > 0,
      chunksRetrieved: topChunks.length,
      imageProcessed: shouldProcessImage,
      contextChars: context.length,
    },
  }, {
    headers: {
      "X-Request-Id": requestId,
      "X-Cache-Hit": "false",
      "X-Response-Time": String(elapsedMs),
    },
  });
}
