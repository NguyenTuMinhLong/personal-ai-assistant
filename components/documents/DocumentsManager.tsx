"use client";

import Link from "next/link";
import { useState } from "react";
import {
  FileText,
  MessageSquare,
  Trash2,
  Upload,
  Sparkles,
  FileArchive,
  X,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";

import type { StoredDocument } from "@/lib/documents";

type UploadedDocument = StoredDocument & {
  size?: string;
};

type UploadResponse = {
  success?: boolean;
  error?: string;
  documents?: UploadedDocument[];
  failures?: Array<{ filename: string; error: string }>;
};

type DocumentsManagerProps = {
  initialDocuments: StoredDocument[];
};

export function DocumentsManager({
  initialDocuments,
}: DocumentsManagerProps) {
  const [documents, setDocuments] =
    useState<UploadedDocument[]>(initialDocuments);
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<{
    current: number;
    total: number;
  } | null>(null);

  const handleFileUpload = async (files: FileList) => {
    setUploading(true);
    setUploadProgress({ current: 0, total: files.length });

    const formData = new FormData();

    Array.from(files).forEach((file) => formData.append("files", file));

    try {
      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const raw = await res.text();
      const data: UploadResponse | null = raw ? JSON.parse(raw) : null;

      if (!res.ok || !data?.success || !data.documents) {
        const message =
          data?.error || data?.failures?.[0]?.error || "Upload failed";
        throw new Error(message);
      }

      toast.success(
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          <span>
            {data.documents.length} file
            {data.documents.length !== 1 ? "s" : ""} processed successfully
          </span>
        </div>,
      );

      setDocuments((prev) => {
        const incoming = data.documents ?? [];
        const next = [...incoming, ...prev];
        const seen = new Set<string>();

        return next.filter((doc) => {
          if (seen.has(doc.id)) {
            return false;
          }

          seen.add(doc.id);
          return true;
        });
      });

      if (data.failures?.length) {
        data.failures.forEach((failure) => {
          toast.error(
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-red-500" />
              <span>
                {failure.filename}: {failure.error}
              </span>
            </div>,
          );
        });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Upload failed";
      toast.error(
        <div className="flex items-center gap-2">
          <AlertCircle className="h-4 w-4 text-red-500" />
          <span>{message}</span>
        </div>,
      );
      console.warn("Upload failed:", err);
    } finally {
      setUploading(false);
      setUploadProgress(null);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    void handleFileUpload(e.dataTransfer.files);
  };

  const handleDeleteDocument = async (documentId: string) => {
    setDeletingId(documentId);

    try {
      const response = await fetch(`/api/documents/${documentId}`, {
        method: "DELETE",
      });

      const payload =
        (await response.json()) as { success?: boolean; error?: string } | null;

      if (!response.ok || !payload?.success) {
        throw new Error(payload?.error || "Could not delete document.");
      }

      setDocuments((prev) => prev.filter((doc) => doc.id !== documentId));
      toast.success("Document deleted.");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Could not delete document.";
      toast.error(message);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="mx-auto max-w-6xl">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
            Your Documents
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {documents.length > 0
              ? `${documents.length} document${documents.length !== 1 ? "s" : ""} in your library`
              : "Upload your first document to get started"}
          </p>
        </div>

        <button
          disabled={uploading}
          onClick={() => document.getElementById("file-upload")?.click()}
          className="group inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 px-5 py-3 font-medium text-white shadow-lg shadow-violet-500/25 transition-all duration-200 hover:shadow-xl hover:shadow-violet-500/30 hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100"
        >
          <Upload className="h-5 w-5 transition-transform group-hover:scale-110" />
          {uploading ? "Processing..." : "Upload Files"}
        </button>
      </div>

      {/* Drop zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={`relative mb-10 overflow-hidden rounded-2xl border-2 border-dashed p-10 text-center transition-all duration-300 ${
          isDragging
            ? "scale-[1.02] border-violet-500 bg-gradient-to-br from-violet-50 to-fuchsia-50 dark:from-violet-500/10 dark:to-fuchsia-500/10"
            : "border-gray-200 bg-gradient-to-br from-white to-gray-50 dark:border-violet-900/30 dark:from-[#1a1c24] dark:to-[#1a1c24]"
        }`}
      >
        {/* Background decoration */}
        <div className="absolute inset-0 opacity-50">
          <div className="absolute top-4 left-4 h-32 w-32 rounded-full bg-violet-500/10 blur-3xl" />
          <div className="absolute bottom-4 right-4 h-40 w-40 rounded-full bg-fuchsia-500/10 blur-3xl" />
        </div>

        <div className="relative">
          <div
            className={`mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl transition-all duration-300 ${
              isDragging
                ? "scale-110 bg-gradient-to-br from-violet-500 to-fuchsia-500 shadow-lg shadow-violet-500/30"
                : "bg-gradient-to-br from-violet-100 to-fuchsia-100 dark:from-violet-500/20 dark:to-fuchsia-500/20"
            }`}
          >
            <Upload
              className={`h-8 w-8 transition-colors duration-300 ${
                isDragging ? "text-white" : "text-violet-600 dark:text-violet-400"
              }`}
            />
          </div>

          <p
            className={`mb-2 text-lg font-medium transition-colors duration-300 ${
              isDragging
                ? "text-violet-600 dark:text-violet-400"
                : "text-gray-700 dark:text-gray-300"
            }`}
          >
            {isDragging ? "Drop files here!" : "Drag and drop files here"}
          </p>

          <p className="mb-5 text-sm text-gray-500 dark:text-gray-400">
            or click the button above to browse
          </p>

          <div className="flex items-center justify-center gap-6 text-xs text-gray-400 dark:text-gray-600">
            <span className="flex items-center gap-1.5">
              <FileArchive className="h-4 w-4" /> PDF
            </span>
            <span className="flex items-center gap-1.5">
              <FileText className="h-4 w-4" /> DOCX
            </span>
            <span className="flex items-center gap-1.5">
              <FileText className="h-4 w-4" /> TXT
            </span>
            <span className="flex items-center gap-1.5">
              <FileText className="h-4 w-4" /> MD
            </span>
          </div>
        </div>

        <input
          id="file-upload"
          type="file"
          multiple
          accept=".pdf,.docx,.txt,.md"
          className="hidden"
          onChange={(e) =>
            e.target.files && void handleFileUpload(e.target.files)
          }
        />
      </div>

      {/* Documents grid */}
      {documents.length === 0 ? (
        <div className="rounded-2xl border border-gray-200/50 bg-white/50 py-20 text-center backdrop-blur-sm dark:border-violet-900/30 dark:bg-[#1a1c24]/50">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-100 to-fuchsia-100 dark:from-violet-500/20 dark:to-fuchsia-500/20">
            <FileText className="h-8 w-8 text-violet-600 dark:text-violet-400" />
          </div>
          <h3 className="mb-2 text-lg font-semibold text-gray-900 dark:text-white">
            No documents yet
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Upload your first file to start chatting with your documents.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
          {documents.map((doc) => (
            <div
              key={doc.id}
              className="group relative overflow-hidden rounded-2xl border border-gray-200/50 bg-white/80 p-5 backdrop-blur-xl transition-all duration-300 hover:border-violet-300/50 hover:shadow-xl hover:shadow-violet-500/5 dark:border-violet-900/30 dark:bg-[#1a1c24]/80"
            >
              {/* Background decoration */}
              <div className="absolute -right-4 -top-4 h-24 w-24 rounded-full bg-gradient-to-br from-violet-500/5 to-fuchsia-500/5 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

              <div className="relative">
                {/* File icon and info */}
                <div className="mb-4 flex items-start gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-100 to-fuchsia-100 transition-colors group-hover:from-violet-200 group-hover:to-fuchsia-200 dark:from-violet-500/20 dark:to-fuchsia-500/20">
                    <FileText className="h-6 w-6 text-violet-600 dark:text-violet-400" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-gray-900 dark:text-white">
                      {doc.filename}
                    </p>
                    <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-500">
                      {doc.size ?? "Ready to chat"}
                    </p>
                  </div>
                </div>

                {/* Summary */}
                <div className="mb-5 rounded-xl border border-gray-100 bg-gray-50/80 p-4 dark:border-violet-900/20 dark:bg-[#252530]">
                  <div className="mb-2 flex items-center gap-2">
                    <Sparkles className="h-3.5 w-3.5 text-violet-600 dark:text-violet-400" />
                    <p className="text-xs font-semibold uppercase tracking-wide text-violet-600 dark:text-violet-400">
                      AI Summary
                    </p>
                  </div>

                  {doc.summary ? (
                    <p className="line-clamp-4 text-sm leading-relaxed text-gray-600 dark:text-gray-400">
                      {doc.summary}
                    </p>
                  ) : (
                    <p className="text-sm italic text-gray-400 dark:text-gray-600">
                      No summary yet.
                    </p>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                  <Link
                    href={`/chat?documentId=${doc.id}`}
                    className="group/btn flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 py-2.5 text-sm font-medium text-white shadow-lg shadow-violet-500/20 transition-all duration-200 hover:shadow-xl hover:shadow-violet-500/30"
                  >
                    <MessageSquare className="h-4 w-4" />
                    Chat
                  </Link>

                  <button
                    type="button"
                    disabled={deletingId === doc.id}
                    onClick={() => void handleDeleteDocument(doc.id)}
                    className="flex h-10 w-10 items-center justify-center rounded-xl border border-gray-200/50 text-gray-400 transition-all duration-200 hover:border-red-200/50 hover:bg-red-50 hover:text-red-500 dark:border-violet-900/30 dark:hover:border-red-500/30 dark:hover:bg-red-500/10 dark:hover:text-red-400 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {deletingId === doc.id ? (
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-red-500" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
