"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useEffect, useCallback } from "react";
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
  Loader2,
  File,
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

type PendingDeletion = {
  documentId: string;
  filename: string;
  deletedAt: number;
};

type FileType = "pdf" | "docx" | "txt" | "md" | "csv" | "unknown";

function getFileType(filename: string): FileType {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "pdf") return "pdf";
  if (ext === "docx" || ext === "doc") return "docx";
  if (ext === "txt") return "txt";
  if (ext === "md") return "md";
  if (ext === "csv") return "csv";
  return "unknown";
}

const FILE_TYPE_CONFIG: Record<FileType, { icon: typeof FileText; color: string; bg: string; label: string }> = {
  pdf: { icon: FileArchive, color: "text-red-500", bg: "bg-red-50 dark:bg-red-500/10", label: "PDF" },
  docx: { icon: FileText, color: "text-blue-500", bg: "bg-blue-50 dark:bg-blue-500/10", label: "DOCX" },
  txt: { icon: File, color: "text-stone-500", bg: "bg-stone-50 dark:bg-stone-500/10", label: "TXT" },
  md: { icon: FileText, color: "text-emerald-500", bg: "bg-emerald-50 dark:bg-emerald-500/10", label: "MD" },
  csv: { icon: FileText, color: "text-amber-500", bg: "bg-amber-50 dark:bg-amber-500/10", label: "CSV" },
  unknown: { icon: File, color: "text-stone-400", bg: "bg-stone-50 dark:bg-stone-500/10", label: "FILE" },
};

const PENDING_DELETIONS_KEY = "pendingDocumentDeletions";
const UNDO_TIMEOUT_MS = 30000;

function formatFileSize(bytes: number): string {
  if (bytes === 0) return "Unknown size";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "Unknown date";
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function DocumentsManager({
  initialDocuments,
}: DocumentsManagerProps) {
  const router = useRouter();
  const [documents, setDocuments] =
    useState<UploadedDocument[]>(initialDocuments);
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<{
    current: number;
    total: number;
  } | null>(null);

  // Check for pending deletions on mount
  useEffect(() => {
    const pending = JSON.parse(
      localStorage.getItem(PENDING_DELETIONS_KEY) || "[]"
    ) as PendingDeletion[];

    const validPending = pending.filter(
      (d) => Date.now() - d.deletedAt < UNDO_TIMEOUT_MS
    );

    validPending.forEach((deletion) => {
      toast.success(
        <div className="flex items-center gap-3">
          <span>"{deletion.filename}" deleted</span>
          <button
            onClick={() => handleRestore(deletion.documentId)}
            className="rounded-md bg-white/20 px-2 py-1 text-sm font-medium text-white hover:bg-white/30"
          >
            Undo
          </button>
        </div>,
        { duration: UNDO_TIMEOUT_MS - (Date.now() - deletion.deletedAt) }
      );
    });

    if (validPending.length > 0) {
      localStorage.setItem(PENDING_DELETIONS_KEY, JSON.stringify(validPending));
    }
  }, []);

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
    const docToDelete = documents.find((d) => d.id === documentId);
    const filename = docToDelete?.filename ?? "Document";
    const deletedAt = Date.now();

    setDocuments((prev) => prev.filter((doc) => doc.id !== documentId));
    setDeletingId(documentId);

    // Persist to localStorage for undo across refreshes
    const pending: PendingDeletion[] = JSON.parse(
      localStorage.getItem(PENDING_DELETIONS_KEY) || "[]"
    );
    pending.push({ documentId, filename, deletedAt });
    localStorage.setItem(PENDING_DELETIONS_KEY, JSON.stringify(pending));

    toast.success(
      <div className="flex items-center gap-3">
        <span>"{filename}" deleted</span>
        <button
          onClick={() => handleRestore(documentId, true)}
          className="rounded-md bg-white/20 px-2 py-1 text-sm font-medium text-white hover:bg-white/30"
        >
          Undo
        </button>
      </div>,
      { duration: UNDO_TIMEOUT_MS }
    );

    try {
      const response = await fetch(`/api/documents/${documentId}`, {
        method: "DELETE",
      });

      const payload =
        (await response.json()) as { success?: boolean; error?: string } | null;

      if (!response.ok || !payload?.success) {
        throw new Error(payload?.error || "Could not delete document.");
      }

      // Remove from pending after successful deletion
      const updatedPending: PendingDeletion[] = JSON.parse(
        localStorage.getItem(PENDING_DELETIONS_KEY) || "[]"
      ).filter((d: PendingDeletion) => d.documentId !== documentId);
      localStorage.setItem(PENDING_DELETIONS_KEY, JSON.stringify(updatedPending));
    } catch (error) {
      // Remove from pending on failure
      const updatedPending: PendingDeletion[] = JSON.parse(
        localStorage.getItem(PENDING_DELETIONS_KEY) || "[]"
      ).filter((d: PendingDeletion) => d.documentId !== documentId);
      localStorage.setItem(PENDING_DELETIONS_KEY, JSON.stringify(updatedPending));

      // Restore the document in UI
      setDocuments((prev) =>
        docToDelete ? [docToDelete, ...prev] : prev
      );

      const message =
        error instanceof Error ? error.message : "Could not delete document.";
      toast.error(message);
    } finally {
      setDeletingId(null);
    }
  };

  const handleRestore = async (documentId: string, fromToast = false) => {
    try {
      const response = await fetch(`/api/documents/${documentId}/restore`, {
        method: "POST",
      });

      if (response.ok) {
        toast.success("Document restored");
        // Remove from pending
        const updatedPending: PendingDeletion[] = JSON.parse(
          localStorage.getItem(PENDING_DELETIONS_KEY) || "[]"
        ).filter((d: PendingDeletion) => d.documentId !== documentId);
        localStorage.setItem(PENDING_DELETIONS_KEY, JSON.stringify(updatedPending));
        router.refresh();
      } else {
        throw new Error();
      }
    } catch {
      toast.error("Could not restore document");
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-4 md:px-6">
      {/* Header */}
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-stone-900 dark:text-stone-100">
            Your Documents
          </h1>
          <p className="mt-1.5 text-sm text-stone-500 dark:text-stone-400">
            {documents.length > 0
              ? `${documents.length} document${documents.length !== 1 ? "s" : ""} in your library`
              : "Upload your first document to get started"}
          </p>
        </div>

        <button
          disabled={uploading}
          onClick={() => document.getElementById("file-upload")?.click()}
          className="group inline-flex items-center justify-center gap-2 rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-sm font-semibold text-stone-700 shadow-sm transition-all duration-200 hover:border-stone-300 hover:bg-stone-50 hover:shadow-md active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-300 dark:hover:bg-stone-700 shrink-0"
        >
          {uploading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Processing...
            </>
          ) : (
            <>
              <Upload className="h-4 w-4 transition-transform group-hover:scale-110" />
              Upload Files
            </>
          )}
        </button>
      </div>

      {/* Upload progress indicator */}
      {uploading && (
        <div className="mb-6 flex items-center gap-3 rounded-xl border border-stone-200 bg-white px-4 py-3 shadow-sm dark:border-stone-700 dark:bg-stone-800">
          <Loader2 className="h-4 w-4 animate-spin text-stone-400" />
          <span className="text-sm text-stone-600 dark:text-stone-400">
            Processing your files...
          </span>
          <div className="ml-auto flex items-center gap-1.5">
            <div className="h-1.5 w-32 overflow-hidden rounded-full bg-stone-100 dark:bg-stone-700">
              <div className="h-full w-1/3 animate-pulse rounded-full bg-stone-400" />
            </div>
          </div>
        </div>
      )}

      {/* Drop zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={`relative mb-10 overflow-hidden rounded-2xl border-2 border-dashed p-8 text-center transition-all duration-300 ${
          isDragging
            ? "scale-[1.02] border-primary bg-primary/5 dark:border-primary-hover dark:bg-primary/10 shadow-md"
            : "border-stone-200 bg-stone-50 dark:border-stone-700 dark:bg-stone-900/50"
        }`}
      >
        {/* Animated border gradient when dragging */}
        {isDragging && (
          <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-primary/10 via-transparent to-primary/10 animate-pulse pointer-events-none" />
        )}

        <div className="relative">
          <div
            className={`mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl transition-all duration-300 ${
              isDragging
                ? "bg-primary/20 dark:bg-primary/30 scale-110"
                : "bg-stone-200 dark:bg-stone-800"
            }`}
          >
            <Upload
              className={`h-6 w-6 transition-all duration-300 ${
                isDragging ? "text-primary dark:text-primary-hover scale-110" : "text-stone-400 dark:text-stone-500"
              }`}
            />
          </div>

          <p
            className={`mb-2 text-base font-semibold transition-colors duration-300 ${
              isDragging
                ? "text-primary dark:text-primary-hover"
                : "text-stone-700 dark:text-stone-300"
            }`}
          >
            {isDragging ? "Release to upload" : "Drag and drop your files here"}
          </p>

          <p className="mb-5 text-sm text-stone-400 dark:text-stone-500">
            or click the button above to browse
          </p>

          <div className="flex items-center justify-center gap-5 text-[11px] text-stone-400 dark:text-stone-600">
            {[
              { ext: "PDF", icon: FileArchive, color: "text-red-400" },
              { ext: "DOCX", icon: FileText, color: "text-blue-400" },
              { ext: "TXT", icon: File, color: "text-stone-400" },
              { ext: "MD", icon: FileText, color: "text-emerald-400" },
              { ext: "CSV", icon: File, color: "text-amber-400" },
            ].map(({ ext, icon: Icon, color }) => (
              <span key={ext} className={`flex items-center gap-1 ${color}`}>
                <Icon className="h-3.5 w-3.5" /> {ext}
              </span>
            ))}
          </div>
        </div>

        <input
          id="file-upload"
          type="file"
          multiple
          accept=".pdf,.docx,.doc,.txt,.md,.csv"
          className="hidden"
          onChange={(e) =>
            e.target.files && void handleFileUpload(e.target.files)
          }
        />
      </div>

      {/* Documents grid */}
      {documents.length === 0 ? (
        <div className="rounded-2xl border border-stone-200 bg-stone-50 py-16 text-center dark:border-stone-700 dark:bg-stone-900">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-stone-200 dark:bg-stone-800">
            <FileText className="h-7 w-7 text-stone-400 dark:text-stone-500" />
          </div>
          <h3 className="mb-2 text-base font-medium text-stone-700 dark:text-stone-100">
            No documents yet
          </h3>
          <p className="text-sm text-stone-500 dark:text-stone-400">
            Upload your first file above to start chatting with your documents.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {documents.map((doc) => {
            const fileType = getFileType(doc.filename);
            const typeConfig = FILE_TYPE_CONFIG[fileType];
            const FileIcon = typeConfig.icon;

            return (
              <div
                key={doc.id}
                className="group relative overflow-hidden rounded-2xl border border-stone-200 bg-white p-5 transition-all duration-200 hover:border-stone-300 hover:shadow-lg hover:shadow-stone-200/50 dark:border-stone-700 dark:bg-stone-900 dark:hover:border-stone-600 dark:hover:shadow-black/20"
              >
                {/* File type badge */}
                <div className={`absolute right-4 top-4 inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${typeConfig.bg} ${typeConfig.color}`}>
                  <FileIcon className="h-3 w-3" />
                  {typeConfig.label}
                </div>

                <div className="relative">
                  {/* File icon and info */}
                  <div className="mb-4 flex items-start gap-3 pr-16">
                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${typeConfig.bg} transition-colors group-hover:scale-105`}>
                      <FileIcon className={`h-5 w-5 ${typeConfig.color}`} />
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-stone-800 dark:text-stone-100" title={doc.filename}>
                        {doc.filename}
                      </p>
                      <p className="mt-0.5 text-[11px] text-stone-400 dark:text-stone-500">
                        {doc.size ?? "Ready to chat"}
                      </p>
                    </div>
                  </div>

                  {/* Summary */}
                  <div className="mb-4 rounded-xl border border-stone-100 bg-stone-50 p-3 dark:border-stone-800 dark:bg-stone-800/50">
                    <div className="mb-2 flex items-center gap-1.5">
                      <Sparkles className="h-3 w-3 text-amber-500" />
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-stone-500 dark:text-stone-400">
                        AI Summary
                      </p>
                    </div>

                    {doc.summary ? (
                      <p className="line-clamp-3 text-xs leading-relaxed text-stone-600 dark:text-stone-400">
                        {doc.summary}
                      </p>
                    ) : (
                      <p className="text-xs italic text-stone-400 dark:text-stone-600">
                        Summary will appear after processing...
                      </p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/chat?documentId=${doc.id}`}
                      className="group/btn flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-stone-200 bg-stone-50 py-2.5 text-xs font-semibold text-stone-600 transition-all hover:bg-stone-100 hover:border-stone-300 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-300 dark:hover:bg-stone-700 active:scale-[0.98]"
                    >
                      <MessageSquare className="h-3.5 w-3.5 transition-transform group-hover/btn:scale-110" />
                      Chat with this doc
                    </Link>

                    <button
                      type="button"
                      disabled={deletingId === doc.id}
                      onClick={() => void handleDeleteDocument(doc.id)}
                      className="flex h-9 w-9 items-center justify-center rounded-xl border border-stone-200 text-stone-400 transition-all hover:border-red-200/50 hover:bg-red-50 hover:text-red-600 dark:border-stone-700 dark:hover:border-red-500/30 dark:hover:bg-red-900/10 dark:hover:text-red-400 disabled:cursor-not-allowed disabled:opacity-50 active:scale-95"
                    >
                      {deletingId === doc.id ? (
                        <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-stone-300 border-t-red-500" />
                      ) : (
                        <Trash2 className="h-3.5 w-3.5" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Total count footer */}
      {documents.length > 0 && (
        <div className="mt-6 flex items-center justify-between rounded-xl border border-stone-200 bg-stone-50 px-4 py-2.5 text-xs text-stone-400 dark:border-stone-700 dark:bg-stone-900">
          <span>{documents.length} document{documents.length !== 1 ? "s" : ""} loaded</span>
          <span>Processed by SecondBrain AI</span>
        </div>
      )}
    </div>
  );
}
