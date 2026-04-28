import { currentUser } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { getSupabaseUrl } from "@/lib/supabase";

const BUCKET_NAME = "chat-images";
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"] as const;
const ALLOWED_EXTENSIONS = new Set(["jpg", "jpeg", "png", "gif", "webp"] as const);

// Magic byte signatures for image validation
const MAGIC_BYTES: Record<string, Array<[string, number[]]>> = {
  "image/jpeg": [["JPEG", [0xFF, 0xD8, 0xFF]]],
  "image/png": [["PNG", [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]]],
  "image/gif": [["GIF", [0x47, 0x49, 0x46, 0x38]]],
  "image/webp": [["WebP", [0x52, 0x49, 0x46, 0x46]]],
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

function createErrorResponse(message: string, status: number, requestId?: string) {
  return NextResponse.json(
    { error: message, ...(requestId ? { requestId } : {}) },
    { status },
  );
}

function validateMagicBytes(buffer: Buffer, declaredType: string): boolean {
  const magic = MAGIC_BYTES[declaredType];
  if (!magic) return true;

  for (const [, bytes] of magic) {
    const header = buffer.slice(0, bytes.length);
    if (header.equals(Buffer.from(bytes))) {
      return true;
    }
  }
  return false;
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const requestId = `img_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;

  const user = await currentUser();
  if (!user) {
    return createErrorResponse("Unauthorized", 401, requestId);
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return createErrorResponse("No file provided. Please select an image.", 400, requestId);
    }

    if (file.size === 0) {
      return createErrorResponse("The file is empty. Please select a valid image.", 400, requestId);
    }

    if (!file.name || file.name.length > 255) {
      return createErrorResponse("Invalid file name.", 400, requestId);
    }

    const fileExtension = file.name.split(".").pop()?.toLowerCase() || "";
    const ext = (fileExtension || "") as "jpg" | "jpeg" | "png" | "gif" | "webp";
    if (!ALLOWED_EXTENSIONS.has(ext)) {
      return createErrorResponse(
        `Invalid file extension ".${fileExtension}". Allowed: ${[...ALLOWED_EXTENSIONS].join(", ")}.`,
        400,
        requestId,
      );
    }

    if (!ALLOWED_TYPES.includes(file.type as typeof ALLOWED_TYPES[number])) {
      return createErrorResponse(
        `Unsupported format: ${file.type}. Supported: JPEG, PNG, GIF, WebP.`,
        400,
        requestId,
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return createErrorResponse(
        `File too large. Maximum size is ${(MAX_FILE_SIZE / (1024 * 1024)).toFixed(0)}MB.`,
        400,
        requestId,
      );
    }

    if (file.size < 1000) {
      return createErrorResponse("This image appears to be corrupted or invalid.", 400, requestId);
    }

    let arrayBuffer: ArrayBuffer;
    try {
      arrayBuffer = await file.arrayBuffer();
    } catch {
      return createErrorResponse("Failed to read the file. Please try again.", 400, requestId);
    }

    const buffer = Buffer.from(arrayBuffer);

    if (buffer.length === 0) {
      return createErrorResponse("Failed to process the image. Please try a different file.", 400, requestId);
    }

    // Magic byte validation
    const declaredMime = file.type;
    if (!validateMagicBytes(buffer, declaredMime)) {
      console.warn(`[${requestId}] Magic byte mismatch for ${file.name} (declared: ${declaredMime})`);
      return createErrorResponse(
        "File content does not match its declared type. Please upload a valid image.",
        400,
        requestId,
      );
    }

    const fileExt = ALLOWED_EXTENSIONS.has(ext) ? ext : "jpg";
    const sanitizedName = file.name
      .replace(/[^a-zA-Z0-9.-]/g, "_")
      .slice(0, 100);
    const fileName = `${user.id}/${requestId}-${sanitizedName}`;

    const supabase = createSupabaseAdminClient();

    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(fileName, buffer, {
        contentType: file.type,
        upsert: false,
      });

    if (error) {
      console.error(`[${requestId}] Storage upload error:`, error);

      if (error.statusCode === "STORAGE_BUCKET_NOT_FOUND") {
        return createErrorResponse(
          "Storage not configured. Please contact support.",
          500,
          requestId,
        );
      }
      if (error.statusCode === "STORAGE_QUOTA_EXCEEDED") {
        return createErrorResponse(
          "Storage quota exceeded. Please delete some images.",
          507,
          requestId,
        );
      }
      if (error.statusCode === "409" || error.message?.includes("already exists")) {
        const { data: existing } = supabase.storage
          .from(BUCKET_NAME)
          .getPublicUrl(fileName);
        return NextResponse.json({
          url: existing.publicUrl,
          fileName,
          success: true,
          requestId,
          deduplicated: true,
        });
      }

      return createErrorResponse(
        "Failed to upload image. Please try again.",
        500,
        requestId,
      );
    }

    const { data: urlData } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(fileName);

    return NextResponse.json({
      url: urlData.publicUrl,
      fileName,
      success: true,
      requestId,
    });
  } catch (error) {
    console.error(`[${requestId}] Upload error:`, error);

    if (error instanceof Error) {
      if (error.message.includes("fetch")) {
        return createErrorResponse(
          "Network error during upload. Please check your connection.",
          503,
          requestId,
        );
      }
      if (error.message.includes("SUPABASE_SERVICE_ROLE_KEY")) {
        return createErrorResponse(
          "Server configuration error. Please contact support.",
          500,
          requestId,
        );
      }
    }

    return createErrorResponse(
      "Something went wrong. Please try again.",
      500,
      requestId,
    );
  }
}
