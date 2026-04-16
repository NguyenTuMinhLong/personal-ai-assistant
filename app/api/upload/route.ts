import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";
import { embed } from "ai";

import { getEmbeddingModel } from "@/lib/ai";
import { getSupabaseUrl } from "@/lib/supabase";

type UploadResult = { id: string; filename: string; size: string };
type UploadFailure = { filename: string; error: string };
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
  const details = `${error.message ?? ""}\n${error.details ?? ""}\n${error.hint ?? ""}`;
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

export async function POST(req: NextRequest) {
  const user = await currentUser();
  const supabaseUrl = getSupabaseUrl();
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const embeddingModel = getEmbeddingModel();

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

      const chunks = text.match(/[\s\S]{1,800}/g) ?? [];

      for (let i = 0; i < chunks.length; i += 1) {
        const chunk = chunks[i].trim();

        if (!chunk) {
          continue;
        }

        const { embedding } = await embed({
          model: embeddingModel,
          value: chunk,
        });

        const { error: embeddingError } = await supabase
          .from("document_embeddings")
          .insert({
            document_id: doc.id,
            content: chunk,
            chunk_index: i,
            embedding,
          });

        if (embeddingError) {
          console.error("Embedding insert error:", file.name, embeddingError);
          throw new Error(formatSupabaseError(embeddingError, supabaseUrl));
        }
      }

      results.push({
        id: doc.id,
        filename: file.name,
        size: `${(file.size / 1024 / 1024).toFixed(2)} MB`,
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
