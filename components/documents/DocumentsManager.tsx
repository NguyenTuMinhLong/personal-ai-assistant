"use client";

import Link from "next/link";
import { useState } from "react";
import { Upload, FileText, Trash2, MessageSquare } from "lucide-react";
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
  const [documents, setDocuments] = useState<UploadedDocument[]>(initialDocuments);
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);

  const handleFileUpload = async (files: FileList) => {
    setUploading(true);
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

      toast.success(`${data.documents.length} file(s) processed successfully.`);

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
        toast.error(`${data.failures.length} file(s) could not be processed.`);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Upload failed";
      toast.error(message);
      console.warn("Upload failed:", err);
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    void handleFileUpload(e.dataTransfer.files);
  };

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-4xl font-bold text-gray-800 dark:text-white">
          Documents
        </h1>
        <button
          disabled={uploading}
          onClick={() => document.getElementById("file-upload")?.click()}
          className="flex items-center gap-2 rounded-2xl bg-violet-600 px-6 py-3 font-medium text-white transition hover:bg-violet-700 disabled:opacity-50"
        >
          <Upload className="h-5 w-5" />
          {uploading ? "Processing..." : "Upload Files"}
        </button>
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={`mb-10 rounded-3xl border-2 border-dashed p-12 text-center transition-all ${isDragging ? "border-violet-500 bg-violet-50 dark:bg-violet-950/30" : "border-gray-300 dark:border-gray-700"}`}
      >
        <Upload className="mx-auto mb-4 h-12 w-12 text-gray-400" />
        <p className="text-xl font-medium text-gray-600 dark:text-gray-300">
          Drag and drop PDF, DOCX, TXT, or MD files here.
        </p>
        <input
          id="file-upload"
          type="file"
          multiple
          accept=".pdf,.docx,.txt,.md"
          className="hidden"
          onChange={(e) => e.target.files && void handleFileUpload(e.target.files)}
        />
      </div>

      {documents.length === 0 ? (
        <div className="py-16 text-center text-gray-400">
          No documents yet.
          <br />
          Upload your first file to get started.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {documents.map((doc) => (
            <div
              key={doc.id}
              className="rounded-3xl border border-gray-200 bg-white p-6 transition hover:shadow-xl dark:border-gray-700 dark:bg-gray-900"
            >
              <div className="flex items-start gap-4">
                <FileText className="h-10 w-10 text-violet-500" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{doc.filename}</p>
                  <p className="text-sm text-gray-400">
                    {doc.size ?? "Ready to chat"}
                  </p>
                </div>
              </div>
              <div className="mt-6 flex gap-2">
                <Link
                  href={`/chat?documentId=${doc.id}`}
                  className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-gray-100 py-3 text-sm hover:bg-violet-100 dark:bg-gray-800"
                >
                  <MessageSquare className="h-4 w-4" />
                  Ask about this
                </Link>
                <button
                  type="button"
                  className="rounded-2xl px-4 text-red-500 hover:bg-red-50"
                >
                  <Trash2 className="h-5 w-5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
