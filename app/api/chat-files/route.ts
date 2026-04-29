// app/api/chat-files/route.ts
import { currentUser } from "@clerk/nextjs/server";
import { createHash } from "crypto";
import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

import { getSupabaseUrl } from "@/lib/supabase";
import { semanticChunk } from "@/lib/chunking";
import {
  generateFileId,
  upsertFileCache,
  getFileCache,
  embedFileChunks,
  type FileChunk,
} from "@/lib/file-cache";
import { getGuestLimits, markGuestUploadUsed } from "@/lib/guest-auth";

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

// Magic bytes for file type verification
const FILE_SIGNATURES: Record<string, Array<number[]>> = {
  ".pdf": [[0x25, 0x50, 0x44, 0x46]],
  ".docx": [[0x50, 0x4B, 0x03, 0x04]],
  ".txt": [],
  ".md": [],
  ".csv": [],
};

function createSupabaseAdminClient() {
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseServiceRoleKey) {
    throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY.");
  }
  return createClient(getSupabaseUrl(), supabaseServiceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function validateMagicBytes(buffer: Buffer, ext: string): boolean {
  const signatures = FILE_SIGNATURES[ext];
  if (!signatures || signatures.length === 0) return true;

  return signatures.some((sig) => {
    const header = buffer.slice(0, sig.length);
    return sig.every((byte, i) => header[i] === byte);
  });
}

async function extractText(file: File): Promise<string> {
  const buffer = Buffer.from(await file.arrayBuffer());

  if (file.type === "application/pdf") {
    const { PDFParse } = await import("pdf-parse");
    const parser = new PDFParse({ data: buffer });
    const result = await parser.getText();
    await parser.destroy();
    return (result.text ?? "").trim();
  }

  if (file.type.includes("wordprocessingml.document")) {
    const mammoth = await import("mammoth");
    const result = await mammoth.extractRawText({ buffer });
    return (result.value ?? "").trim();
  }

  if (file.type === "text/plain" || file.type === "text/markdown" || file.type === "text/csv") {
    return buffer.toString("utf-8").trim();
  }

  return "";
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const requestId = `file_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;

  const user = await currentUser();
  const anonymousId = req.headers.get("x-anonymous-id");

  if (!user && !anonymousId) {
    return NextResponse.json(
      { error: "Unauthorized", requestId },
      { status: 401 },
    );
  }

  const effectiveUserId = user?.id ?? anonymousId!;
  const isGuestMode = !user && !!anonymousId;

  // ── Guest upload limit check ──
  if (isGuestMode && anonymousId) {
    const limits = await getGuestLimits(anonymousId);
    if (limits.isBlocked) {
      return NextResponse.json(
        { error: "Trial ended. Sign up to continue.", requestId, trialEnded: true },
        { status: 403 }
      );
    }
    if (limits.uploadUsed) {
      return NextResponse.json(
        { error: "Guest trial allows only 1 file upload. Sign up to upload more.", requestId, uploadLimitReached: true },
        { status: 403 }
      );
    }
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file || file.size === 0) {
      return NextResponse.json(
        { error: "No file provided.", requestId },
        { status: 400 },
      );
    }

    if (!file.name || file.name.length > 255) {
      return NextResponse.json(
        { error: "Invalid file name.", requestId },
        { status: 400 },
      );
    }

    const fileExtension = "." + (file.name.split(".").pop()?.toLowerCase() ?? "");
    if (!ALLOWED_EXTENSIONS.has(fileExtension)) {
      return NextResponse.json(
        {
          error: `Unsupported format "${fileExtension}". Allowed: PDF, DOCX, TXT, MD, CSV.`,
          requestId,
        },
        { status: 400 },
      );
    }

    const detectedMime = ALLOWED_TYPES[fileExtension];
    if (!detectedMime) {
      return NextResponse.json(
        { error: `Unsupported format: ${fileExtension}.`, requestId },
        { status: 400 },
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB.`, requestId },
        { status: 400 },
      );
    }

    if (file.size < 10) {
      return NextResponse.json(
        { error: "File appears empty.", requestId },
        { status: 400 },
      );
    }

    // Read file once for both validation and upload
    let arrayBuffer: ArrayBuffer;
    try {
      arrayBuffer = await file.arrayBuffer();
    } catch {
      return NextResponse.json(
        { error: "Failed to read file.", requestId },
        { status: 400 },
      );
    }

    const buffer = Buffer.from(arrayBuffer);

    // Magic byte check
    if (!validateMagicBytes(buffer, fileExtension)) {
      console.warn(`[${requestId}] Magic byte mismatch for ${file.name}`);
      return NextResponse.json(
        {
          error: "File content does not match its extension. Please upload a valid file.",
          requestId,
        },
        { status: 400 },
      );
    }

    const fileId = generateFileId(effectiveUserId, file.name, file.size);

    // Check deduplication cache
    const existing = await getFileCache(effectiveUserId, fileId);
    if (existing) {
      return NextResponse.json({
        fileId: existing.fileId,
        filename: existing.filename,
        mimeType: existing.mimeType,
        storageUrl: existing.storageUrl,
        fileSize: existing.fileSizeBytes,
        extractedText: existing.extractedText,
        deduplicated: true,
        requestId,
      });
    }

    const timestamp = Date.now();
    const randomSuffix = Math.random().toString(36).substring(2, 8);
    const sanitizedName = file.name
      .replace(/[^a-zA-Z0-9.-]/g, "_")
      .slice(0, 100);
    const storagePath = `${effectiveUserId}/${requestId}-${sanitizedName}`;

    const supabase = createSupabaseAdminClient();

    const { error: uploadError } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(storagePath, buffer, {
        contentType: detectedMime,
        upsert: false,
      });

    if (uploadError) {
      if (uploadError.statusCode === "STORAGE_BUCKET_NOT_FOUND") {
        return NextResponse.json(
          {
            error: "Storage bucket not found. Please create the 'chat-files' bucket in Supabase.",
            requestId,
          },
          { status: 500 },
        );
      }
      if (uploadError.statusCode === "STORAGE_QUOTA_EXCEEDED") {
        return NextResponse.json(
          { error: "Storage quota exceeded.", requestId },
          { status: 507 },
        );
      }
      console.error(`[${requestId}] Storage error:`, uploadError);
      return NextResponse.json(
        { error: "Failed to upload file.", requestId },
        { status: 500 },
      );
    }

    const { data: urlData } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(storagePath);

    // Extract text (for large files, do this after upload so user doesn't wait)
    const extractedText = await extractText(file);
    const textHash = extractedText
      ? createHash("sha256").update(extractedText).digest("hex")
      : null;

    const chunks: FileChunk[] = [];
    if (extractedText) {
      try {
        const { chunks: semanticChunks } = await semanticChunk(extractedText, {
          maxChunkTokens: 512,
          overlapTokens: 64,
          filename: file.name,
          chunkType: "file",
        });

        const rawChunks: FileChunk[] = semanticChunks.map((chunk, idx) => ({
          index: idx,
          content: chunk.content,
          embedding: [],
          metadata: chunk.metadata,
        }));

        chunks.push(...(await embedFileChunks(rawChunks)));
      } catch {
        // Text extracted but chunking/embedding failed — still usable
      }
    }

    await upsertFileCache({
      user_id: effectiveUserId,
      session_id: null,
      file_id: fileId,
      filename: file.name,
      mime_type: detectedMime,
      storage_url: urlData.publicUrl,
      extracted_text: extractedText || null,
      text_hash: textHash,
      chunks,
      file_size_bytes: file.size,
    });

    // ── Mark guest upload as used after successful upload ──
    if (isGuestMode && anonymousId) {
      await markGuestUploadUsed(anonymousId);
    }

    return NextResponse.json({
      fileId,
      filename: file.name,
      mimeType: detectedMime,
      storageUrl: urlData.publicUrl,
      fileSize: file.size,
      extractedText: extractedText || null,
      deduplicated: false,
      requestId,
    });
  } catch (error) {
    console.error(`[${requestId}]`, error);
    const msg = error instanceof Error ? error.message : "Upload failed.";
    return NextResponse.json({ error: msg, requestId }, { status: 500 });
  }
}
