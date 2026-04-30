// components/GuestTrialModal.tsx
"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Upload,
  FileText,
  X,
  Loader2,
  CheckCircle2,
  AlertCircle,
  File,
  FileArchive,
} from "lucide-react";
import { toast } from "sonner";

type UploadResponse = {
  success?: boolean;
  error?: string;
  documents?: Array<{
    id: string;
    filename: string;
    expiresAt: string;
  }>;
  failures?: Array<{ filename: string; error: string }>;
};

type GuestTrialModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

function formatFileSize(bytes: number): string {
  if (bytes === 0) return "Unknown size";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function getFileIcon(filename: string) {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "pdf") return FileArchive;
  return FileText;
}

export function GuestTrialModal({ isOpen, onClose }: GuestTrialModalProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setUploadError(null);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) {
      setSelectedFile(file);
      setUploadError(null);
    }
  }, []);

  const handleUpload = useCallback(async () => {
    if (!selectedFile) return;

    setUploading(true);
    setUploadError(null);

    const formData = new FormData();
    formData.append("files", selectedFile);

    try {
      const res = await fetch("/api/trial/upload", {
        method: "POST",
        body: formData,
      });

      const data: UploadResponse = await res.json();

      if (!res.ok || !data.success || !data.documents?.[0]) {
        const errorMsg = data.failures?.[0]?.error || data.error || "Upload failed";
        setUploadError(errorMsg);
        toast.error(errorMsg);
        return;
      }

      const { id: documentId, filename } = data.documents[0];

      toast.success(
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          <span>Ready to chat about {filename}!</span>
        </div>,
      );

      // Navigate to chat with the trial document
      router.push(`/chat?documentId=${documentId}&trial=true`);
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Upload failed";
      setUploadError(message);
      toast.error(message);
    } finally {
      setUploading(false);
    }
  }, [selectedFile, router, onClose]);

  if (!isOpen) return null;

  const FileIcon = selectedFile ? getFileIcon(selectedFile.name) : Upload;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget && !uploading) onClose();
      }}
    >
      <div className="w-full max-w-md animate-in fade-in zoom-in-95 duration-200">
        <div className="relative overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-2xl dark:border-stone-700 dark:bg-stone-900">
          {/* Decorative top bar */}
          <div className="h-1.5 w-full bg-gradient-to-r from-amber-400 to-orange-500" />

          <div className="flex flex-col gap-5 p-8">
            {/* Header */}
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 dark:bg-amber-900/30">
                  <FileText className="h-5 w-5 text-amber-500" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-stone-900 dark:text-stone-100">
                    Try for free
                  </h2>
                  <p className="text-sm text-stone-500 dark:text-stone-400">
                    Upload 1 file to start chatting
                  </p>
                </div>
              </div>
              {!uploading && (
                <button
                  onClick={onClose}
                  className="rounded-lg p-1.5 text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-600 dark:hover:bg-stone-800 dark:hover:text-stone-200"
                >
                  <X className="h-5 w-5" />
                </button>
              )}
            </div>

            {/* File drop zone */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                e.currentTarget.classList.add("border-primary", "bg-primary/5");
              }}
              onDragLeave={(e) => {
                e.currentTarget.classList.remove("border-primary", "bg-primary/5");
              }}
              onDrop={(e) => {
                e.currentTarget.classList.remove("border-primary", "bg-primary/5");
                handleDrop(e);
              }}
              onClick={() => !uploading && fileInputRef.current?.click()}
              className={`relative cursor-pointer overflow-hidden rounded-xl border-2 border-dashed transition-all ${
                selectedFile
                  ? "border-emerald-300 bg-emerald-50 dark:border-emerald-700 dark:bg-emerald-900/20"
                  : "border-stone-200 bg-stone-50 hover:border-stone-300 dark:border-stone-700 dark:bg-stone-800/50 dark:hover:border-stone-600"
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.docx,.doc,.txt,.md,.csv"
                onChange={handleFileSelect}
                disabled={uploading}
                className="hidden"
              />

              <div className="flex flex-col items-center gap-3 p-6">
                {selectedFile ? (
                  <>
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-100 dark:bg-emerald-900/30">
                      <FileIcon className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-medium text-stone-800 dark:text-stone-100">
                        {selectedFile.name}
                      </p>
                      <p className="mt-0.5 text-xs text-stone-500 dark:text-stone-400">
                        {formatFileSize(selectedFile.size)}
                      </p>
                    </div>
                    {!uploading && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedFile(null);
                        }}
                        className="text-xs text-stone-400 transition-colors hover:text-stone-600 dark:hover:text-stone-200"
                      >
                        Choose different file
                      </button>
                    )}
                  </>
                ) : (
                  <>
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-stone-100 dark:bg-stone-800">
                      <Upload className="h-5 w-5 text-stone-400" />
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-medium text-stone-700 dark:text-stone-200">
                        Drag and drop your file here
                      </p>
                      <p className="mt-0.5 text-xs text-stone-400 dark:text-stone-500">
                        or click to browse
                      </p>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Supported formats */}
            <div className="flex items-center justify-center gap-4 text-[11px] text-stone-400 dark:text-stone-600">
              {["PDF", "DOCX", "TXT", "MD", "CSV"].map((ext) => (
                <span key={ext} className="flex items-center gap-1">
                  <File className="h-3 w-3" /> {ext}
                </span>
              ))}
            </div>

            {/* Error message */}
            {uploadError && (
              <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 dark:border-red-900/40 dark:bg-red-900/20">
                <AlertCircle className="h-4 w-4 shrink-0 text-red-500 dark:text-red-400" />
                <p className="text-sm text-red-600 dark:text-red-400">{uploadError}</p>
              </div>
            )}

            {/* Actions */}
            <div className="flex flex-col gap-2">
              <button
                onClick={handleUpload}
                disabled={!selectedFile || uploading}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-stone-900 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-stone-100 dark:text-stone-900 dark:hover:bg-stone-200"
              >
                {uploading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Processing your file...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4" />
                    Start chatting
                  </>
                )}
              </button>

              <p className="text-center text-xs text-stone-400 dark:text-stone-500">
                File expires in 30 minutes. 10 free messages.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
