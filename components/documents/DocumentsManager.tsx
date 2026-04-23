"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
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

type PendingDeletion = {
  documentId: string;
  filename: string;
  deletedAt: number;
};

const PENDING_DELETIONS_KEY = "pendingDocumentDeletions";
const UNDO_TIMEOUT_MS = 30000;

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
      ).filter((d) => d.documentId !== documentId);
      localStorage.setItem(PENDING_DELETIONS_KEY, JSON.stringify(updatedPending));
    } catch (error) {
      // Remove from pending on failure
      const updatedPending: PendingDeletion[] = JSON.parse(
        localStorage.getItem(PENDING_DELETIONS_KEY) || "[]"
      ).filter((d) => d.documentId !== documentId);
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
        ).filter((d) => d.documentId !== documentId);
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
    <div className="mx-auto max-w-6xl">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-stone-900 dark:text-stone-100">
            Your Documents
          </h1>
          <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
            {documents.length > 0
              ? `${documents.length} document${documents.length !== 1 ? "s" : ""} in your library`
              : "Upload your first document to get started"}
          </p>
        </div>

        <button
          disabled={uploading}
          onClick={() => document.getElementById("file-upload")?.click()}
          className="group inline-flex items-center gap-2 rounded-lg border border-stone-200 bg-stone-100 px-3.5 py-2 text-sm font-medium text-stone-600 shadow-sm transition-all hover:bg-stone-200 hover:border-stone-300 disabled:cursor-not-allowed disabled:opacity-50 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-400 dark:hover:bg-stone-700"
        >
          <Upload className="h-4 w-4 transition-transform group-hover:scale-110" />
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
        className={`relative mb-8 overflow-hidden rounded-xl border-2 border-dashed p-6 text-center transition-all duration-200 ${
          isDragging
            ? "scale-[1.01] border-stone-400 bg-stone-200/50 dark:border-stone-500 dark:bg-stone-800/50"
            : "border-stone-200 bg-stone-50 dark:border-stone-700 dark:bg-stone-900"
        }`}
      >

        <div className="relative">
          <div
            className={`mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-lg transition-all duration-200 ${
              isDragging
                ? "bg-stone-300 dark:bg-stone-700"
                : "bg-stone-200 dark:bg-stone-800"
            }`}
          >
            <Upload
              className={`h-5 w-5 transition-colors duration-200 ${
                isDragging ? "text-stone-600 dark:text-stone-300" : "text-stone-400 dark:text-stone-500"
              }`}
            />
          </div>

          <p
            className={`mb-1 text-sm font-medium transition-colors duration-200 ${
              isDragging
                ? "text-stone-700 dark:text-stone-300"
                : "text-stone-600 dark:text-stone-400"
            }`}
          >
            {isDragging ? "Drop files here" : "Drag and drop files here"}
          </p>

          <p className="mb-3 text-xs text-stone-400 dark:text-stone-500">
            or click the button above to browse
          </p>

          <div className="flex items-center justify-center gap-4 text-[10px] text-stone-400 dark:text-stone-600">
            <span className="flex items-center gap-1">
              <FileArchive className="h-3 w-3" /> PDF
            </span>
            <span className="flex items-center gap-1">
              <FileText className="h-3 w-3" /> DOCX
            </span>
            <span className="flex items-center gap-1">
              <FileText className="h-3 w-3" /> TXT
            </span>
            <span className="flex items-center gap-1">
              <FileText className="h-3 w-3" /> MD
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
        <div className="rounded-xl border border-stone-200 bg-stone-50 py-14 text-center dark:border-stone-700 dark:bg-stone-900">
          <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-lg bg-stone-200 dark:bg-stone-800">
            <FileText className="h-5 w-5 text-stone-400 dark:text-stone-500" />
          </div>
          <h3 className="mb-1 text-sm font-medium text-stone-700 dark:text-stone-100">
            No documents yet
          </h3>
          <p className="text-xs text-stone-500 dark:text-stone-400">
            Upload your first file to start chatting with your documents.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          {documents.map((doc) => (
            <div
              key={doc.id}
              className="group relative overflow-hidden rounded-xl border border-stone-200 bg-stone-50 p-4 transition-all duration-200 hover:border-stone-300 hover:shadow-sm dark:border-stone-700 dark:bg-stone-900 dark:hover:border-stone-600"
            >

              <div className="relative">
                {/* File icon and info */}
                <div className="mb-2.5 flex items-start gap-2.5">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-stone-200 transition-colors group-hover:bg-stone-300 dark:bg-stone-800 dark:group-hover:bg-stone-700">
                    <FileText className="h-4 w-4 text-stone-500 dark:text-stone-400" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-stone-800 dark:text-stone-100">
                      {doc.filename}
                    </p>
                    <p className="mt-0.5 text-[10px] text-stone-400 dark:text-stone-500">
                      {doc.size ?? "Ready to chat"}
                    </p>
                  </div>
                </div>

                {/* Summary */}
                <div className="mb-2.5 rounded-lg border border-stone-100 bg-white p-2.5 dark:border-stone-800 dark:bg-stone-800/50">
                  <div className="mb-1 flex items-center gap-1">
                    <Sparkles className="h-2.5 w-2.5 text-stone-400" />
                    <p className="text-[10px] font-medium uppercase tracking-wide text-stone-500 dark:text-stone-400">
                      AI Summary
                    </p>
                  </div>

                  {doc.summary ? (
                    <p className="line-clamp-3 text-xs leading-relaxed text-stone-600 dark:text-stone-400">
                      {doc.summary}
                    </p>
                  ) : (
                    <p className="text-xs italic text-stone-400 dark:text-stone-600">
                      No summary yet.
                    </p>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1.5">
                  <Link
                    href={`/chat?documentId=${doc.id}`}
                    className="group/btn flex flex-1 items-center justify-center gap-1 rounded-lg border border-stone-200 bg-white py-1.5 text-xs font-medium text-stone-600 transition-all hover:bg-stone-50 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-300 dark:hover:bg-stone-700"
                  >
                    <MessageSquare className="h-3 w-3" />
                    Chat
                  </Link>

                  <button
                    type="button"
                    disabled={deletingId === doc.id}
                    onClick={() => void handleDeleteDocument(doc.id)}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-stone-200 text-stone-400 transition-all hover:border-red-200/50 hover:bg-red-50 hover:text-red-600 dark:border-stone-700 dark:hover:border-red-500/30 dark:hover:bg-red-900/10 dark:hover:text-red-400 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {deletingId === doc.id ? (
                      <div className="h-3 w-3 animate-spin rounded-full border-2 border-stone-300 border-t-red-500" />
                    ) : (
                      <Trash2 className="h-3 w-3" />
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
