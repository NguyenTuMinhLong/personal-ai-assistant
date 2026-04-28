import { currentUser } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";
import { generateText } from "ai";
import { NextRequest, NextResponse } from "next/server";

import { getChatModel, batchEmbed } from "@/lib/ai";
import { getSupabaseUrl } from "@/lib/supabase";
import { semanticChunk } from "@/lib/chunking";

type UploadResult = {
  id: string;
  filename: string;
  size: string;
  summary?: string | null;
};

type UploadFailure = {
  filename: string;
  error: string;
};

type SupabaseLikeError = {
  code?: string;
  message?: string;
  details?: string;
  hint?: string;
};

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const TEXT_FILE_TYPES = new Set(["text/plain", "text/markdown"]);

function isDocxFile(file: File) {
  return file.type.includes("wordprocessingml.document");
}

function formatSupabaseError(error: SupabaseLikeError, supabaseUrl: string) {
  const details = `${error.message ?? ""}\n${error.details ?? ""}\n${
    error.hint ?? ""
  }`;
  const host = new URL(supabaseUrl).host;

  if (details.includes("ENOTFOUND")) {
    return `Could not resolve ${host}. Check NEXT_PUBLIC_SUPABASE_URL in .env.local and your DNS/network connection.`;
  }

  if (details.includes("fetch failed")) {
    return `Could not reach Supabase at ${host}. Check your internet connection, VPN/firewall, or Supabase URL.`;
  }

  return (
    error.message ||
    error.details ||
    error.hint ||
    "Could not save document metadata."
  );
}

async function extractText(file: File) {
  const buffer = Buffer.from(await file.arrayBuffer());

  if (file.type === "application/pdf") {
    const { PDFParse } = await import("pdf-parse");
    const parser = new PDFParse({ data: buffer });
    const result = await parser.getText();
    await parser.destroy();
    return result.text;
  }

  if (isDocxFile(file)) {
    const mammoth = await import("mammoth");
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  }

  if (TEXT_FILE_TYPES.has(file.type)) {
    return buffer.toString("utf-8");
  }

  return "";
}

async function generateDocumentSummary(content: string) {
  const prompt = content.slice(0, 8000).trim();

  if (!prompt) {
    return null;
  }

  const { text } = await generateText({
    model: getChatModel(),
    system:
      "You are a document summarizer. Summarize the document in 3-5 concise sentences. Focus on the main topic, key points, and purpose. Match the language of the document.",
    prompt,
  });

  return text.trim() || null;
}

export async function POST(req: NextRequest) {
  const user = await currentUser();
  const supabaseUrl = getSupabaseUrl();
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!supabaseServiceRoleKey) {
    return NextResponse.json(
      { error: "Missing SUPABASE_SERVICE_ROLE_KEY." },
      { status: 500 },
    );
  }

  let formData: FormData;

  try {
    formData = await req.formData();
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Invalid upload payload";

    return NextResponse.json(
      {
        error:
          message === "Failed to parse body as FormData."
            ? "Upload payload could not be parsed. Try a smaller batch or re-upload the files."
            : message,
      },
      { status: 400 },
    );
  }

  const files = formData
    .getAll("files")
    .filter((value): value is File => value instanceof File && value.size > 0);

  if (files.length === 0) {
    return NextResponse.json({ error: "No files uploaded" }, { status: 400 });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const results: UploadResult[] = [];
  const failures: UploadFailure[] = [];

  for (const file of files) {
    try {
      const text = (await extractText(file)).trim();

      if (!text) {
        failures.push({
          filename: file.name,
          error: "Unsupported file type or no readable text found.",
        });
        continue;
      }

      const { data: doc, error: docError } = await supabase
        .from("documents")
        .insert({
          user_id: user.id,
          filename: file.name,
          content: text,
        })
        .select("id")
        .single();

      if (docError || !doc) {
        console.error("Insert error:", {
          filename: file.name,
          code: docError?.code,
          message: docError?.message,
          details: docError?.details,
          hint: docError?.hint,
        });

        failures.push({
          filename: file.name,
          error: formatSupabaseError(docError ?? {}, supabaseUrl),
        });

        continue;
      }

      const { chunks: semanticChunks } = await semanticChunk(text, {
        maxChunkTokens: 512,
        overlapTokens: 64,
        filename: file.name,
        chunkType: "document",
      });

      // Batch embedding: collect all non-empty chunks and embed in one API call
      const validChunks: Array<{ index: number; content: string; chunk: typeof semanticChunks[0] }> = [];
      for (let i = 0; i < semanticChunks.length; i++) {
        const content = semanticChunks[i].content.trim();
        if (content) {
          validChunks.push({ index: i, content, chunk: semanticChunks[i] });
        }
      }

      if (validChunks.length > 0) {
        // Batch embed all chunks using parallel API calls (much faster than sequential)
        const chunkTexts = validChunks.map(c => c.content);
        const embeddings = await batchEmbed(chunkTexts, {
          batchSize: 100,
          concurrency: 5,
        });

        // Build embedding rows for batch insert
        const embeddingRows = validChunks.map((c, idx) => ({
          document_id: doc.id,
          content: c.content,
          chunk_index: c.index,
          embedding: embeddings[idx],
          metadata: c.chunk.metadata,
          title: c.chunk.metadata.title ?? null,
          section: c.chunk.metadata.section ?? null,
          page_number: c.chunk.metadata.pageNumber ?? null,
          chunk_type: c.chunk.metadata.chunkType,
        }));

        const { error: embeddingError } = await supabase
          .from("document_embeddings")
          .insert(embeddingRows);

        if (embeddingError) {
          console.error("Embedding batch insert error:", file.name, embeddingError);
          throw new Error(formatSupabaseError(embeddingError, supabaseUrl));
        }
      }

      let summary: string | null = null;

      try {
        summary = await generateDocumentSummary(text);

        if (summary) {
          const { error: summaryError } = await supabase
            .from("documents")
            .update({ summary })
            .eq("id", doc.id)
            .eq("user_id", user.id);

          if (summaryError) {
            console.error("Summary update error:", summaryError);
          }
        }
      } catch (summaryError) {
        console.error("Summary generation error:", file.name, summaryError);
      }

      results.push({
        id: doc.id,
        filename: file.name,
        size: `${(file.size / 1024 / 1024).toFixed(2)} MB`,
        summary,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unexpected upload error";

      console.error("Upload error:", file.name, message);

      failures.push({
        filename: file.name,
        error: message,
      });
    }
  }

  return NextResponse.json(
    {
      success: results.length > 0,
      documents: results,
      failures,
    },
    { status: results.length > 0 ? 200 : 400 },
  );
}