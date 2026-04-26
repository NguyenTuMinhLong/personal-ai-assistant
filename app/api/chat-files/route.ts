// app/api/chat-files/route.ts
import { currentUser } from "@clerk/nextjs/server";
import { createHash } from "crypto";
import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

import { getSupabaseUrl } from "@/lib/supabase";
import {
  generateFileId,
  upsertFileCache,
  getFileCache,
  embedFileChunks,
  type FileChunk,
} from "@/lib/file-cache";

const BUCKET_NAME = "chat-files";
const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB
const ALLOWED_TYPES: Record<string, string> = {
  "application/pdf": ".pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
  "text/plain": ".txt",
  "text/markdown": ".md",
  "text/csv": ".csv",
};

const ALLOWED_EXTENSIONS = new Set(Object.values(ALLOWED_TYPES));

function createSupabaseAdminClient() {
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseServiceRoleKey) {
    throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY.");
  }
  return createClient(getSupabaseUrl(), supabaseServiceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function extractText(file: File): Promise<string> {
  const buffer = Buffer.from(await file.arrayBuffer());

  if (file.type === "application/pdf") {
    const { PDFParse } = await import("pdf-parse");
    const parser = new PDFParse({ data: buffer });
    const result = await parser.getText();
    await parser.destroy();
    return result.text ?? "";
  }

  if (file.type.includes("wordprocessingml.document")) {
    const mammoth = await import("mammoth");
    const result = await mammoth.extractRawText({ buffer });
    return result.value ?? "";
  }

  if (file.type === "text/csv") {
    const text = buffer.toString("utf-8");
    return text;
  }

  if (file.type === "text/plain" || file.type === "text/markdown" || file.type === "text/csv") {
    return buffer.toString("utf-8");
  }

  return "";
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const user = await currentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let supabase: ReturnType<typeof createSupabaseAdminClient> | null = null;

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file || file.size === 0) {
      return NextResponse.json({ error: "No file provided." }, { status: 400 });
    }

    if (!file.name || file.name.length > 255) {
      return NextResponse.json({ error: "Invalid file name." }, { status: 400 });
    }

    const fileExtension = "." + file.name.split(".").pop()?.toLowerCase();
    if (!ALLOWED_EXTENSIONS.has(fileExtension)) {
      return NextResponse.json(
        { error: `Unsupported format. Allowed: PDF, DOCX, TXT, MD, CSV, XLSX.` },
        { status: 400 },
      );
    }

    const detectedMime = ALLOWED_EXTENSIONS.has(fileExtension)
      ? Object.entries(ALLOWED_TYPES).find(([, ext]) => ext === fileExtension)?.[0]
      : file.type;

    if (!detectedMime || !ALLOWED_TYPES[detectedMime]) {
      return NextResponse.json(
        { error: `Unsupported format: ${fileExtension}. Allowed: PDF, DOCX, TXT, MD, CSV, XLSX.` },
        { status: 400 },
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File too large. Maximum size is 20MB.` },
        { status: 400 },
      );
    }

    if (file.size < 10) {
      return NextResponse.json({ error: "File appears empty." }, { status: 400 });
    }

    const fileId = generateFileId(user.id, file.name, file.size);

    const existing = await getFileCache(user.id, fileId);
    if (existing) {
      return NextResponse.json({
        fileId: existing.fileId,
        filename: existing.filename,
        mimeType: existing.mimeType,
        storageUrl: existing.storageUrl,
        fileSize: existing.fileSizeBytes,
        extractedText: existing.extractedText,
        deduplicated: true,
      });
    }

    let arrayBuffer: ArrayBuffer;
    try {
      arrayBuffer = await file.arrayBuffer();
    } catch {
      return NextResponse.json({ error: "Failed to read file." }, { status: 400 });
    }

    const buffer = Buffer.from(arrayBuffer);
    const timestamp = Date.now();
    const randomSuffix = Math.random().toString(36).substring(2, 8);
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_").slice(0, 100);
    const storagePath = `${user.id}/${timestamp}-${randomSuffix}-${sanitizedName}`;

    supabase = createSupabaseAdminClient();

    const { error: uploadError } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(storagePath, buffer, { contentType: detectedMime, upsert: false });

    if (uploadError) {
      if (uploadError.statusCode === "STORAGE_BUCKET_NOT_FOUND") {
        return NextResponse.json(
          { error: "Storage bucket not found. Please create 'chat-files' bucket in Supabase." },
          { status: 500 },
        );
      }
      console.error("[chat-files upload]", uploadError);
      return NextResponse.json({ error: "Failed to upload file." }, { status: 500 });
    }

    const { data: urlData } = supabase.storage.from(BUCKET_NAME).getPublicUrl(storagePath);

    const extractedText = await extractText(file);
    const chunks: FileChunk[] = [];
    if (extractedText.trim()) {
      const rawChunks: FileChunk[] = [];
      const CHUNK_SIZE = 600;
      const OVERLAP = 80;
      let start = 0;
      let idx = 0;
      while (start < extractedText.length) {
        let end = start + CHUNK_SIZE;
        if (end < extractedText.length) {
          const bp = extractedText.lastIndexOf("\n", end);
          if (bp > start + CHUNK_SIZE / 2) end = bp;
        }
        const content = extractedText.slice(start, end).trim();
        if (content) rawChunks.push({ index: idx++, content, embedding: [] });
        start = end - OVERLAP;
        if (rawChunks.length > 0 && start <= rawChunks[rawChunks.length - 1].content.length) {
          start = end;
        }
      }

      try {
        chunks.push(...(await embedFileChunks(rawChunks)));
      } catch {
        chunks.push(...rawChunks);
      }
    }

    const textHash = extractedText.trim()
      ? createHash("sha256").update(extractedText).digest("hex")
      : null;

    await upsertFileCache({
      user_id: user.id,
      session_id: null,
      file_id: fileId,
      filename: file.name,
      mime_type: detectedMime,
      storage_url: urlData.publicUrl,
      extracted_text: extractedText.trim() || null,
      text_hash: textHash,
      chunks,
      file_size_bytes: file.size,
    });

    return NextResponse.json({
      fileId,
      filename: file.name,
      mimeType: detectedMime,
      storageUrl: urlData.publicUrl,
      fileSize: file.size,
      extractedText: extractedText.trim() || null,
      deduplicated: false,
    });
  } catch (error) {
    console.error("[chat-files]", error);
    const msg = error instanceof Error ? error.message : "Upload failed.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
