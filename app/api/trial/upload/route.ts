// app/api/trial/upload/route.ts
// Handles temporary document uploads for guest trial users

import { createClient } from "@supabase/supabase-js";
import { generateText } from "ai";
import { NextRequest, NextResponse } from "next/server";

import { getChatModel, batchEmbed } from "@/lib/ai";
import { getSupabaseUrl } from "@/lib/supabase";
import { semanticChunk } from "@/lib/chunking";

const TEXT_FILE_TYPES = new Set(["text/plain", "text/markdown"]);
const TRIAL_FILE_EXPIRY_MS = 30 * 60 * 1000; // 30 minutes

type UploadResult = {
  id: string;
  filename: string;
  expiresAt: string;
};

type UploadFailure = {
  filename: string;
  error: string;
};

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function isDocxFile(file: File) {
  return file.type.includes("wordprocessingml.document");
}

function isPdfByExtension(name: string) {
  return name.toLowerCase().endsWith(".pdf");
}

function isValidPdfBuffer(buffer: Buffer): boolean {
  return (
    buffer[0] === 0x25 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x44 &&
    buffer[3] === 0x46
  );
}

async function extractText(file: File) {
  const buffer = Buffer.from(await file.arrayBuffer());

  if (file.type === "application/pdf" || isPdfByExtension(file.name)) {
    if (!isValidPdfBuffer(buffer)) {
      throw new Error(
        "File is not a valid PDF document. The file may be corrupted or is not actually a PDF."
      );
    }
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const pdfParse = require("pdf-parse");
      const result = await pdfParse(buffer);
      return result.text || "";
    } catch (pdfError) {
      console.error("[trial-upload] PDF parse error:", pdfError);
      throw new Error(
        "Failed to extract text from PDF. The file may be corrupted or password-protected."
      );
    }
  }

  if (isDocxFile(file)) {
    try {
      const mammoth = await import("mammoth");
      const result = await mammoth.extractRawText({ arrayBuffer: buffer });
      return result.value || "";
    } catch (docxError) {
      console.error("[trial-upload] DOCX parse error:", docxError);
      throw new Error(
        "Failed to extract text from DOCX. The file may be corrupted."
      );
    }
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
  // No auth required - this is a guest trial endpoint
  const supabaseUrl = getSupabaseUrl();
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

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
      { error: message },
      { status: 400 },
    );
  }

  const files = formData
    .getAll("files")
    .filter((value): value is File => value instanceof File && value.size > 0);

  if (files.length === 0) {
    return NextResponse.json({ error: "No files uploaded" }, { status: 400 });
  }

  // Limit to 1 file for trial
  if (files.length > 1) {
    return NextResponse.json(
      { error: "Trial allows only 1 file at a time" },
      { status: 400 },
    );
  }

  const file = files[0];

  // Limit file size to 10MB for trial
  const MAX_TRIAL_FILE_SIZE = 10 * 1024 * 1024;
  if (file.size > MAX_TRIAL_FILE_SIZE) {
    return NextResponse.json(
      { error: "Trial file size limited to 10MB. Sign up for larger files." },
      { status: 400 },
    );
  }

  const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const expiresAt = new Date(Date.now() + TRIAL_FILE_EXPIRY_MS).toISOString();

  try {
    const text = (await extractText(file)).trim();

    if (!text) {
      return NextResponse.json(
        {
          failures: [{
            filename: file.name,
            error: "Unsupported file type or no readable text found.",
          }],
        },
        { status: 400 },
      );
    }

    // Create document with trial user ID prefix and expiration
    const trialUserId = `trial_guest_${Date.now()}`;

  // Try with expires_at first; if it fails for ANY reason, fallback to without it
  let doc;
  let docError;

  console.log(`[trial-upload] Attempting to insert document for ${file.name}`);

  const { data: docWithExpiry, error: docWithExpiryError } = await supabase
    .from("documents")
    .insert({
      user_id: trialUserId,
      filename: file.name,
      content: text,
      expires_at: expiresAt,
    })
    .select("id")
    .single();

  if (docWithExpiryError) {
    console.log(`[trial-upload] Insert with expires_at failed:`, docWithExpiryError);
    // Fallback: insert without expires_at (column may not exist yet)
    const { data: docWithoutExpiry, error: docWithoutExpiryError } = await supabase
      .from("documents")
      .insert({
        user_id: trialUserId,
        filename: file.name,
        content: text,
      })
      .select("id")
      .single();

    doc = docWithoutExpiry;
    docError = docWithoutExpiryError;
  } else {
    doc = docWithExpiry;
    docError = null;
    console.log(`[trial-upload] Document inserted successfully:`, doc?.id);
  }

    if (docError || !doc) {
      console.error("Insert error:", docError);
      return NextResponse.json(
        {
          failures: [{
            filename: file.name,
            error: docError?.message || "Could not create document.",
          }],
        },
        { status: 500 },
      );
    }

    // Create embeddings
    const { chunks: semanticChunks } = await semanticChunk(text, {
      maxChunkTokens: 512,
      overlapTokens: 64,
      filename: file.name,
      chunkType: "document",
    });

    const validChunks: Array<{ index: number; content: string; chunk: typeof semanticChunks[0] }> = [];
    for (let i = 0; i < semanticChunks.length; i++) {
      const content = semanticChunks[i].content.trim();
      if (content) {
        validChunks.push({ index: i, content, chunk: semanticChunks[i] });
      }
    }

    if (validChunks.length > 0) {
      const chunkTexts = validChunks.map(c => c.content);
      const embeddings = await batchEmbed(chunkTexts, {
        batchSize: 100,
        concurrency: 5,
      });

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
      } else {
        console.log(`[trial-upload] Embeddings inserted successfully: ${embeddingRows.length} chunks`);
      }
    }

    // Generate summary (non-blocking, but try)
    try {
      const summary = await generateDocumentSummary(text);
      if (summary) {
        await supabase
          .from("documents")
          .update({ summary })
          .eq("id", doc.id);
      }
    } catch (summaryError) {
      console.error("Summary generation error:", file.name, summaryError);
    }

    return NextResponse.json({
      success: true,
      documents: [{
        id: doc.id,
        filename: file.name,
        expiresAt,
      }],
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unexpected upload error";

    console.error("Trial upload error:", file.name, message);

    return NextResponse.json(
      {
        failures: [{
          filename: file.name,
          error: message,
        }],
      },
      { status: 500 },
    );
  }
}
