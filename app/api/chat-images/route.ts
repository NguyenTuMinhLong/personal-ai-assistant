import { currentUser } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { getSupabaseUrl } from "@/lib/supabase";

const BUCKET_NAME = "chat-images";
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];
const ALLOWED_EXTENSIONS = ["jpg", "jpeg", "png", "gif", "webp"];

function createSupabaseAdminClient() {
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseServiceRoleKey) {
    throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY.");
  }

  return createClient(getSupabaseUrl(), supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

type UploadError = {
  code: string;
  message: string;
};

function createErrorResponse(message: string, status: number): NextResponse {
  return NextResponse.json({ error: message }, { status });
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const user = await currentUser();

  if (!user) {
    return createErrorResponse("Unauthorized", 401);
  }

  let supabase: ReturnType<typeof createSupabaseAdminClient> | null = null;

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    // Edge case: No file provided
    if (!file) {
      return createErrorResponse("No file provided. Please select an image.", 400);
    }

    // Edge case: Empty file
    if (file.size === 0) {
      return createErrorResponse("The file is empty. Please select a valid image.", 400);
    }

    // Edge case: File name missing or suspicious
    if (!file.name || file.name.length > 255) {
      return createErrorResponse("Invalid file name.", 400);
    }

    // Edge case: Check extension matches MIME type
    const fileExtension = file.name.split(".").pop()?.toLowerCase() || "";
    if (!ALLOWED_EXTENSIONS.includes(fileExtension)) {
      return createErrorResponse(
        `Invalid file extension ".${fileExtension}". Allowed: ${ALLOWED_EXTENSIONS.join(", ")}.`,
        400
      );
    }

    // Validate file type (MIME)
    if (!ALLOWED_TYPES.includes(file.type)) {
      return createErrorResponse(
        `Unsupported format: ${file.type}. Supported: JPEG, PNG, GIF, WebP.`,
        400
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      const sizeMB = (MAX_FILE_SIZE / (1024 * 1024)).toFixed(0);
      return createErrorResponse(`File too large. Maximum size is ${sizeMB}MB.`, 400);
    }

    // Validate file size is reasonable (detect corrupt files)
    if (file.size < 1000) {
      return createErrorResponse("This image appears to be corrupted or invalid.", 400);
    }

    // Read file as array buffer
    let arrayBuffer: ArrayBuffer;
    try {
      arrayBuffer = await file.arrayBuffer();
    } catch {
      return createErrorResponse("Failed to read the file. Please try again.", 400);
    }

    const buffer = Buffer.from(arrayBuffer);

    // Edge case: Buffer is empty after conversion
    if (buffer.length === 0) {
      return createErrorResponse("Failed to process the image. Please try a different file.", 400);
    }

    // Generate unique filename with user isolation
    const timestamp = Date.now();
    const randomSuffix = Math.random().toString(36).substring(2, 8);
    const safeExtension = ALLOWED_EXTENSIONS.includes(fileExtension) ? fileExtension : "jpg";
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_").slice(0, 100);
    const fileName = `${user.id}/${timestamp}-${randomSuffix}-${sanitizedName}`;

    supabase = createSupabaseAdminClient();

    // Upload to Supabase Storage with retry logic
    let uploadResult;
    let uploadError: UploadError | null = null;

    for (let attempt = 1; attempt <= 2; attempt++) {
      const { data, error } = await supabase.storage
        .from(BUCKET_NAME)
        .upload(fileName, buffer, {
          contentType: file.type,
          upsert: false,
        });

      if (error) {
        uploadError = { code: error.code || "UNKNOWN", message: error.message };
        // Only retry on network-like errors
        if (attempt < 2 && (error.code === "STORAGE_NETWORK_ERROR" || !error.status)) {
          await new Promise((resolve) => setTimeout(resolve, 500 * attempt));
          continue;
        }
        break;
      }

      uploadResult = data;
      uploadError = null;
      break;
    }

    if (uploadError) {
      console.error("Storage upload error:", uploadError);

      // Specific error messages for common issues
      if (uploadError.code === "STORAGE_BUCKET_NOT_FOUND") {
        return createErrorResponse(
          "Storage not configured. Please contact support.",
          500
        );
      }
      if (uploadError.code === "STORAGE_QUOTA_EXCEEDED") {
        return createErrorResponse(
          "Storage quota exceeded. Please delete some images.",
          507
        );
      }

      return createErrorResponse(
        "Failed to upload image. Please try again.",
        500
      );
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(fileName);

    return NextResponse.json({
      url: urlData.publicUrl,
      fileName,
      success: true,
    });
  } catch (error) {
    console.error("Upload error:", error);

    // Specific error handling
    if (error instanceof Error) {
      if (error.message.includes("fetch")) {
        return createErrorResponse(
          "Network error during upload. Please check your connection.",
          503
        );
      }
      if (error.message.includes("SUPABASE_SERVICE_ROLE_KEY")) {
        return createErrorResponse(
          "Server configuration error. Please contact support.",
          500
        );
      }
    }

    return createErrorResponse(
      "Something went wrong. Please try again.",
      500
    );
  }
}
