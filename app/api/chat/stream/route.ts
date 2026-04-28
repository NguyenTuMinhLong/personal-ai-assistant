import { currentUser } from "@clerk/nextjs/server";
import { embed, streamText, type UserModelMessage } from "ai";
import { NextRequest, NextResponse } from "next/server";

import { getChatModel, getEmbeddingModel } from "@/lib/ai";
import { hybridSearch } from "@/lib/hybrid-search";
import { buildContext } from "@/lib/context-builder";
import { getUserDocument } from "@/lib/documents";
import { searchFileChunks } from "@/lib/file-cache";

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
    hasContext: boolean;
    hasFileContext: boolean;
    hasFiles: boolean;
    documentFilename: string;
    chatFileCount?: number;
    chatFileNames?: string[];
  },
): string {
  const { hasContext, hasFileContext, hasFiles, documentFilename, chatFileCount, chatFileNames } = options;
  const ctx = hasContext || hasFileContext;
  const vi = lang === "vi";

  const citeNote = hasFiles
    ? (vi ? "\n\nVới các file đính kèm, hãy dùng citations kiểu [F1.1] cho file 1 đoạn 1." : "\n\nFor attached files, use citations like [F1.1] for file 1 chunk 1.")
    : "";

  if (ctx) {
    return vi
      ? `Trả lời câu hỏi bằng tiếng Việt, sử dụng ngữ cảnh tài liệu được cung cấp${hasFiles ? " và các file đính kèm" : ""}. Hãy hữu ích và ngắn gọn. Nếu câu trả lời không được hỗ trợ bởi ngữ cảnh, hãy nói rõ điều đó. Khi có thể, hãy đề cập citations như [1] hoặc [2] trong câu trả lời.${citeNote}`
      : `Answer questions in English using the provided document context${hasFiles ? " and attached files" : ""}. Be helpful and concise. If the answer is not supported by the context, say that clearly. When possible, mention citations like [1] or [2] inline.${citeNote}`;
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

// ─── Route exports ─────────────────────────────────────────────
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const requestId = generateRequestId();

  const user = await currentUser();

  if (!user) {
    return NextResponse.json(
      { error: "Unauthorized", requestId },
      { status: 401 },
    );
  }

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
  const chatFiles = body.chatFiles || undefined;
  const documentId = body.documentId?.trim();

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

  const document = await getUserDocument(user.id, documentId);

  if (!document) {
    return NextResponse.json(
      { error: "Document not found.", requestId },
      { status: 404 },
    );
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

  let context = "";

  if (topChunks.length > 0) {
    const { context: builtContext } = buildContext(topChunks, {
      maxChars: MAX_CONTEXT_CHARS,
      includeMetadata: true,
      compressMode: "smart_truncate",
    });
    context = builtContext;
  }

  // ── File context ──────────────────────────────────────────────
  let fileContext = "";

  if (chatFiles && chatFiles.length > 0) {
    const fileBlocks: string[] = [];

    for (const file of chatFiles) {
      if (file.extractedText && file.extractedText.trim()) {
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
              const block = relevant.map((c) => c.content).join("\n\n");
              fileBlocks.push(`[File: ${sanitizeFilename(file.filename)}]\n${block}`);
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
  const promptContent: UserModelMessage = {
    role: "user",
    content: `Document name: ${document.filename}
${fileContext ? `\nAttached files:\n${fileContext}` : ""}

Question:
${message}

Context:
${context}`,
  };

  const lang = detectLanguage(message);
  const hasFiles = !!(chatFiles && chatFiles.length > 0);

  const systemPrompt = buildSystemPrompt(lang, {
    hasContext: !!context,
    hasFileContext: !!fileContext,
    hasFiles,
    documentFilename: document.filename,
    chatFileCount: chatFiles?.length,
    chatFileNames: chatFiles?.map(f => f.filename),
  });

  // ── Stream response ─────────────────────────────────────────
  const result = streamText({
    model: getChatModel(false),
    system: systemPrompt,
    messages: [promptContent],
  });

  // Return streaming response using AI SDK's text stream response
  return result.toTextStreamResponse();
}
