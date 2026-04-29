"use client";

import React, {
  FormEvent,
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Image from "next/image";
import {
  ArrowDown,
  BookmarkPlus,
  Copy,
  Check,
  Download,
  FileText,
  ImagePlus,
  Loader2,
  MessageSquare,
  AlertCircle,
  Pin,
  Plus,
  SendHorizonal,
  Sparkles,
  Trash2,
  X,
  ZoomIn,
  RotateCcw,
  Edit3,
  ThumbsUp,
  ThumbsDown,
  Wifi,
  WifiOff,
} from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

import { ImageLightbox } from "./ImageLightbox";
import { useChatSessions } from "@/hooks/useChatSessions";
import { useGuestSession } from "@/hooks/useGuestSession";
import { GuestTrialBanner } from "./GuestTrialBanner";
import { GuestTrialPopup } from "@/components/GuestTrialPopup";
import type { StoredDocument } from "@/lib/documents";

type Citation = {
  index: number;
  snippet: string;
};

type HighlightColor = "rose" | "amber" | "emerald" | "sky" | "violet";

type ChatFile = {
  fileId: string;
  filename: string;
  mimeType: string;
  storageUrl: string;
  fileSize: number;
  extractedText?: string | null;
};

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  imageUrls?: string[];
  chatFiles?: ChatFile[];
  citations?: Citation[];
  highlightColor?: HighlightColor | null;
  selectionStart?: number | null;
  selectionEnd?: number | null;
  createdAt?: string | null;
  error?: string | null;
};

type SavedNote = {
  id: string;
  messageId: string;
  isPinned?: boolean;
};

type PersistedAnnotation = {
  id: string;
  message_id: string;
  highlight_color: string | null;
  selection_start: number | null;
  selection_end: number | null;
  is_pinned?: boolean;
};

type ChatWorkspaceProps = {
  documents: StoredDocument[];
  initialDocumentId: string | null;
  initialSessionId: string | null;
  initialMessages?: ChatMessage[];
  initialNotes?: SavedNote[];
};

// ─── Highlight colors ────────────────────────────────────────────
const HIGHLIGHT_COLORS: Array<{ color: HighlightColor; label: string }> = [
  { color: "rose", label: "Rose" },
  { color: "amber", label: "Amber" },
  { color: "emerald", label: "Emerald" },
  { color: "sky", label: "Sky" },
  { color: "violet", label: "Violet" },
];

// ─── Utilities ────────────────────────────────────────────────────
function createMessageId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

function formatRelativeTime(dateStr: string): string {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return "";

  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;

  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function RelativeTime({ dateStr }: { dateStr: string }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return <span suppressHydrationWarning>...</span>;
  return <span suppressHydrationWarning>{formatRelativeTime(dateStr)}</span>;
}

// ─── Highlight swatch ────────────────────────────────────────────
function HighlightSwatch({
  color,
  label,
  isActive,
  onClick,
}: {
  color: HighlightColor;
  label: string;
  isActive: boolean;
  onClick: () => void;
}) {
  const lightColors: Record<HighlightColor, string> = {
    rose: "#fda4af",
    amber: "#fde68a",
    emerald: "#6ee7b7",
    sky: "#bae6fd",
    violet: "#f3e8ff",
  };
  const darkColors: Record<HighlightColor, string> = {
    rose: "#9f1239",
    amber: "#78350f",
    emerald: "#064e3b",
    sky: "#0c4a6e",
    violet: "#4c1d95",
  };
  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-5 w-5 rounded-full border transition-all ${
        isActive
          ? "scale-110 border-stone-900 dark:border-white shadow-sm"
          : "border-white/70 dark:border-stone-600 hover:scale-105"
      }`}
      style={{
        background: `linear-gradient(135deg, ${lightColors[color]} 0%, ${darkColors[color]} 100%)`,
      }}
      title={label}
    />
  );
}

// ─── Highlighted text renderer ──────────────────────────────────
function HighlightedText({
  content,
  highlightColor,
  selectionStart,
  selectionEnd,
}: {
  content: string;
  highlightColor?: HighlightColor | null;
  selectionStart?: number | null;
  selectionEnd?: number | null;
}) {
  const hasInline =
    highlightColor && selectionStart != null && selectionEnd != null;

  if (!hasInline) {
    return <span>{content}</span>;
  }

  const before = content.slice(0, selectionStart);
  const highlighted = content.slice(selectionStart, selectionEnd);
  const after = content.slice(selectionEnd);

  return (
    <span>
      {before}
      <span
        style={{
          backgroundColor: `var(--highlight-${highlightColor})`,
          borderRadius: "2px",
          padding: "0 1px",
        }}
      >
        {highlighted}
      </span>
      {after}
    </span>
  );
}

// ─── Citation pill ────────────────────────────────────────────────
function CitationPill({
  citation,
  onClick,
}: {
  citation: Citation;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1 rounded-md border border-stone-200 bg-stone-50 px-2 py-1 text-[10px] transition-all hover:border-stone-300 hover:bg-stone-100 dark:border-stone-700 dark:bg-stone-800 dark:hover:border-stone-600 dark:hover:bg-stone-700"
      title={citation.snippet}
    >
      <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-stone-200 text-[8px] font-bold text-stone-600 dark:bg-stone-600 dark:text-stone-300">
        {citation.index}
      </span>
      <span className="max-w-[120px] truncate text-stone-500 dark:text-stone-400">
        {citation.snippet.slice(0, 30)}...
      </span>
    </button>
  );
}

// ─── Message actions ─────────────────────────────────────────────
interface MessageActionsProps {
  message: ChatMessage;
  highlightPickerOpen: boolean;
  onHighlightPickerToggle: (messageId: string | null) => void;
  onHighlight: (messageId: string, color: HighlightColor) => void;
  onCopy: (content: string, messageId: string) => void;
  onToggleNote: (messageId: string) => Promise<void>;
  onDeleteMessage: (messageId: string) => void;
  onRetryMessage: (messageId: string) => void;
  onFeedback: (messageId: string, vote: "up" | "down") => Promise<void>;
  copiedMessageId: string | null;
  isSaved: boolean;
  feedbackVote?: "up" | "down" | null;
}

const MessageActions = memo(function MessageActions({
  message,
  highlightPickerOpen,
  onHighlightPickerToggle,
  onHighlight,
  onCopy,
  onToggleNote,
  onDeleteMessage,
  onRetryMessage,
  onFeedback,
  copiedMessageId,
  isSaved,
  feedbackVote,
}: MessageActionsProps) {
  const isCopied = copiedMessageId === message.id;
  const hasError = !!message.error;
  const isAssistant = message.role === "assistant";

  return (
    <div className="mt-2 ml-1 flex flex-wrap items-center gap-1.5">
      <button
        onClick={() =>
          onHighlightPickerToggle(highlightPickerOpen ? null : message.id)
        }
        className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[10px] font-medium transition-all ${
          highlightPickerOpen
            ? "border-stone-400 bg-stone-100 text-stone-700 dark:border-stone-500 dark:bg-stone-700 dark:text-stone-200"
            : "border-stone-200 bg-white text-stone-500 hover:border-stone-300 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-400 dark:hover:border-stone-600"
        }`}
        title="Highlight selected text"
      >
        <div className="flex h-2.5 w-2.5 items-center justify-center">
          <div
            className={`h-1.5 w-1.5 rounded-full ${
              highlightPickerOpen
                ? "bg-stone-600 dark:bg-stone-300 animate-pulse"
                : "bg-stone-400"
            }`}
          />
        </div>
        {highlightPickerOpen ? "Done" : "Highlight"}
      </button>

      {highlightPickerOpen && (
        <div className="flex items-center gap-0.5 rounded-md border border-stone-200 bg-white p-1 dark:border-stone-700 dark:bg-stone-800">
          {HIGHLIGHT_COLORS.map((h) => (
            <HighlightSwatch
              key={h.color}
              color={h.color}
              label={h.label}
              isActive={message.highlightColor === h.color}
              onClick={() => onHighlight(message.id, h.color)}
            />
          ))}
        </div>
      )}

      <button
        onClick={() => onCopy(message.content ?? "", message.id)}
        className="inline-flex items-center gap-1 rounded-md border border-stone-200 bg-white px-2 py-1 text-[10px] font-medium text-stone-500 transition-all hover:border-stone-300 hover:text-stone-700 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-400 dark:hover:border-stone-600"
      >
        {isCopied ? (
          <>
            <Check className="h-3 w-3 text-emerald-600" />
            Copied!
          </>
        ) : (
          <>
            <Copy className="h-3 w-3" />
            Copy
          </>
        )}
      </button>

      {isAssistant && (
        <>
          <button
            type="button"
            onClick={() => onFeedback(message.id, "up")}
            className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[10px] font-medium transition-all ${
              feedbackVote === "up"
                ? "border-emerald-300 bg-emerald-50 text-emerald-600 dark:border-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                : "border-stone-200 bg-white text-stone-400 hover:border-emerald-300 hover:text-emerald-500 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-500 dark:hover:border-emerald-700 dark:hover:text-emerald-400"
            }`}
            title="This answer is helpful"
          >
            <ThumbsUp className="h-3 w-3" />
          </button>
          <button
            type="button"
            onClick={() => onFeedback(message.id, "down")}
            className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[10px] font-medium transition-all ${
              feedbackVote === "down"
                ? "border-red-300 bg-red-50 text-red-500 dark:border-red-700 dark:bg-red-900/30 dark:text-red-400"
                : "border-stone-200 bg-white text-stone-400 hover:border-red-300 hover:text-red-500 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-500 dark:hover:border-red-700 dark:hover:text-red-400"
            }`}
            title="This answer needs improvement"
          >
            <ThumbsDown className="h-3 w-3" />
          </button>
        </>
      )}

      <button
        data-testid="save-note-btn"
        type="button"
        onClick={() => onToggleNote(message.id)}
        className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[10px] font-medium transition-all ${
          isSaved
            ? "border-stone-400 bg-stone-100 text-stone-700 dark:border-stone-500 dark:bg-stone-700 dark:text-stone-200"
            : "border-stone-200 bg-white text-stone-500 hover:border-stone-300 hover:text-stone-700 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-400 dark:hover:border-stone-600"
        }`}
      >
        <BookmarkPlus className="h-3 w-3" />
        {isSaved ? "Saved" : "Save note"}
      </button>

      {hasError && (
        <button
          type="button"
          onClick={() => onRetryMessage(message.id)}
          className="inline-flex items-center gap-1 rounded-md border border-red-200 bg-red-50 px-2 py-1 text-[10px] font-medium text-red-600 transition-all hover:border-red-300 hover:bg-red-100 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/30"
          title="Retry this message"
        >
          <RotateCcw className="h-3 w-3" />
          Retry
        </button>
      )}

      <button
        type="button"
        onClick={() => onDeleteMessage(message.id)}
        className="inline-flex items-center gap-1 rounded-md border border-stone-200 bg-white px-2 py-1 text-[10px] font-medium text-stone-500 transition-all hover:border-stone-300 hover:text-stone-600 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-400 dark:hover:border-stone-600"
        title="Delete message"
      >
        <Trash2 className="h-3 w-3" />
        Delete
      </button>
    </div>
  );
});

// ─── Message bubble ────────────────────────────────────────────────
interface MessageBubbleProps {
  message: ChatMessage;
  isSaved: boolean;
  flashedMessageId: string | null;
  copiedMessageId: string | null;
  highlightPickerOpen: boolean;
  pendingSelection: { messageId: string; text: string; selectionStart: number; selectionEnd: number } | null;
  onHighlightPickerToggle: (messageId: string | null) => void;
  onHighlight: (messageId: string, color: HighlightColor) => void;
  onCopy: (content: string, messageId: string) => void;
  onToggleNote: (messageId: string) => Promise<void>;
  onDeleteMessage: (messageId: string) => void;
  onRetryMessage: (messageId: string) => void;
  onFlash: (messageId: string) => void;
  onPendingSelectionChange: (selection: { messageId: string; text: string; selectionStart: number; selectionEnd: number } | null) => void;
  onRef?: (el: HTMLDivElement | null) => void;
  onCitationClick?: (citationIndex: number) => void;
  onFeedback: (messageId: string, vote: "up" | "down") => Promise<void>;
  feedbackVote?: "up" | "down" | null;
}

const MessageBubble = memo(function MessageBubble({
  message,
  isSaved,
  flashedMessageId,
  copiedMessageId,
  highlightPickerOpen,
  pendingSelection,
  onHighlightPickerToggle,
  onHighlight,
  onCopy,
  onToggleNote,
  onDeleteMessage,
  onRetryMessage,
  onFlash,
  onPendingSelectionChange,
  onRef,
  onCitationClick,
  onFeedback,
  feedbackVote,
}: MessageBubbleProps) {
  const isUser = message.role === "user";
  const isFlashed = flashedMessageId === message.id;
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);

  const handleTextSelection = useCallback(() => {
    if (!highlightPickerOpen || isUser) return;
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) return;
    const selectedText = selection.toString();
    if (selectedText.length === 0) return;

    const range = selection.getRangeAt(0);
    const contentEl = document.getElementById(`msg-content-${message.id}`);
    if (!contentEl) return;

    const preRange = document.createRange();
    preRange.setStart(contentEl, 0);
    preRange.setEnd(range.startContainer, range.startOffset);
    const preFragment = preRange.cloneContents();
    const preDiv = document.createElement("div");
    preDiv.appendChild(preFragment);
    const charsBefore = preDiv.textContent?.length ?? 0;

    onPendingSelectionChange({
      messageId: message.id,
      text: selectedText,
      selectionStart: charsBefore,
      selectionEnd: charsBefore + selectedText.length,
    });
  }, [highlightPickerOpen, isUser, message.id, onPendingSelectionChange]);

  const renderContent = (content: string) => {
    const parts = content.split(/\[(\d+)\]/g);
    return parts.map((part, i) => {
      if (i % 2 === 1) {
        const idx = parseInt(part, 10);
        const citation = message.citations?.find(c => c.index === idx);
        if (citation && onCitationClick) {
          return (
            <button
              key={i}
              type="button"
              onClick={() => onCitationClick(idx)}
              className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-stone-200 text-[8px] font-bold text-stone-600 align-middle transition-colors hover:bg-stone-300 dark:bg-stone-700 dark:text-stone-300 dark:hover:bg-stone-600"
              title={citation.snippet}
            >
              {idx}
            </button>
          );
        }
        return (
          <sup key={i} className="text-[8px] font-bold text-stone-400">
            [{part}]
          </sup>
        );
      }
      return part;
    });
  };

  return (
    <div
      data-testid="chat-message"
      ref={(element) => {
        if (element && isFlashed) {
          onFlash(message.id);
        }
        if (onRef) {
          onRef(element);
        }
      }}
      className={`group animate-in slide-in-from-bottom-1 fade-in duration-300 ${
        isFlashed ? "scale-[1.01]" : ""
      }`}
    >
      <div className={`flex items-start gap-3 ${isUser ? "flex-row-reverse" : ""}`}>
        <div
          className={`shrink-0 flex h-8 w-8 items-center justify-center rounded-full transition-transform group-hover:scale-110 ${
            isUser
              ? "bg-stone-300 dark:bg-stone-600"
              : "bg-stone-200 dark:bg-stone-700"
          }`}
        >
          {isUser ? (
            <span className="text-xs font-semibold text-stone-700 dark:text-stone-200">Y</span>
          ) : (
            <Sparkles className="h-3.5 w-3.5 text-stone-500 dark:text-stone-400" />
          )}
        </div>

        <div className={`flex-1 min-w-0 ${isUser ? "items-end" : ""}`}>
          <div className="mb-1 flex items-center gap-2">
            <span className="text-sm font-medium text-stone-700 dark:text-stone-300">
              {isUser ? "You" : "SecondBrain"}
            </span>
            {message.imageUrls && message.imageUrls.length > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-stone-100 px-2 py-0.5 text-[10px] font-medium text-stone-500 dark:bg-stone-800 dark:text-stone-400">
                <ImagePlus className="h-3 w-3" />
                {message.imageUrls.length} image{message.imageUrls.length > 1 ? "s" : ""} attached
              </span>
            )}
            {message.highlightColor && (
              <span
                className="inline-block h-2 w-2 rounded-full"
                style={{ backgroundColor: `var(--highlight-${message.highlightColor})` }}
                title="Has highlight"
              />
            )}
            {message.createdAt && (
              <span className="text-[10px] text-stone-400 dark:text-stone-500">
                <RelativeTime dateStr={message.createdAt} />
              </span>
            )}
            {message.error && (
              <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-medium text-red-600 dark:bg-red-900/30 dark:text-red-400">
                <AlertCircle className="h-2.5 w-2.5" />
                Failed
              </span>
            )}
          </div>

          <div
            id={`msg-content-${message.id}`}
            className={`relative rounded-2xl px-4 py-3 ${
              isUser
                ? "bg-stone-800 text-stone-100 dark:bg-stone-700"
                : "border border-stone-200 bg-white dark:border-stone-700 dark:bg-stone-800"
            } ${highlightPickerOpen && !isUser ? "ring-2 ring-stone-400 dark:ring-stone-500" : ""}`}
            onMouseUp={handleTextSelection}
          >
            {message.imageUrls && message.imageUrls.length > 0 && (
              <div className="mb-2 flex gap-2 overflow-x-auto">
                {message.imageUrls.slice(0, 5).map((url, idx) => (
                  <div
                    key={idx}
                    onClick={() => setLightboxImage(url)}
                    className="relative group shrink-0 cursor-zoom-in"
                  >
                    <Image
                      src={url}
                      alt={`Attached ${idx + 1}`}
                      width={80}
                      height={80}
                      className="h-20 w-20 rounded-lg border border-stone-200 object-cover transition-all hover:opacity-90 dark:border-stone-700"
                    />
                    <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-black/0 transition-all group-hover:bg-black/20">
                      <ZoomIn className="h-4 w-4 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-lg" />
                    </div>
                    {message.imageUrls && message.imageUrls.length > 5 && idx === 4 && (
                      <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-black/60">
                        <span className="text-sm font-medium text-white">+{message.imageUrls.length - 5}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {message.chatFiles && message.chatFiles.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-2">
                {message.chatFiles.map((file, idx) => (
                  <div
                    key={idx}
                    className="group flex items-center gap-1.5 rounded-md border border-stone-200 bg-stone-100 px-2 py-1 dark:border-stone-600 dark:bg-stone-700"
                  >
                    <FileText className="h-3.5 w-3.5 shrink-0 text-stone-400" />
                    <span className="max-w-[120px] truncate text-xs text-stone-600 dark:text-stone-300">
                      {file.filename}
                    </span>
                    <span className="text-[10px] text-stone-400">
                      {formatFileSize(file.fileSize)}
                    </span>
                    <a
                      href={file.storageUrl}
                      download={file.filename}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0 rounded p-0.5 text-stone-400 opacity-0 transition-all hover:bg-stone-200 hover:text-stone-600 group-hover:opacity-100 dark:hover:bg-stone-600 dark:hover:text-stone-300"
                      title="Download file"
                    >
                      <Download className="h-3 w-3" />
                    </a>
                  </div>
                ))}
              </div>
            )}

            {message.error ? (
              <div className="flex items-start gap-2">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
                <p className="flex-1 text-sm text-red-600 dark:text-red-400">
                  {message.error}
                </p>
              </div>
            ) : (
              <p className="whitespace-pre-wrap text-sm leading-relaxed">
                <HighlightedText
                  content={message.content ?? ""}
                  highlightColor={message.highlightColor}
                  selectionStart={message.selectionStart}
                  selectionEnd={message.selectionEnd}
                />
              </p>
            )}
          </div>

          {!isUser && !message.error && Array.isArray(message.citations) && message.citations.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {message.citations.slice(0, 5).map((citation) => (
                <CitationPill
                  key={citation.index}
                  citation={citation}
                  onClick={onCitationClick ? () => onCitationClick(citation.index) : undefined}
                />
              ))}
              {message.citations.length > 5 && (
                <span className="text-[10px] text-stone-400">
                  +{message.citations.length - 5} more
                </span>
              )}
            </div>
          )}

          {!isUser ? (
            <MessageActions
              message={message}
              highlightPickerOpen={highlightPickerOpen}
              onHighlightPickerToggle={onHighlightPickerToggle}
              onHighlight={onHighlight}
              onCopy={onCopy}
              onToggleNote={onToggleNote}
              onDeleteMessage={onDeleteMessage}
              onRetryMessage={onRetryMessage}
              onFeedback={onFeedback}
              copiedMessageId={copiedMessageId}
              isSaved={isSaved}
              feedbackVote={feedbackVote}
            />
          ) : (
            <div className="mt-2 ml-1 flex items-center justify-end gap-1.5">
              <button
                onClick={() => onCopy(message.content ?? "", message.id)}
                className="inline-flex items-center gap-1 rounded-md border border-stone-200 bg-white px-2 py-1 text-[10px] font-medium text-stone-500 transition-all hover:border-stone-300 hover:text-stone-700 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-400 dark:hover:border-stone-600"
              >
                {copiedMessageId === message.id ? (
                  <>
                    <Check className="h-3 w-3 text-emerald-600" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="h-3 w-3" />
                    Copy
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={() => onDeleteMessage(message.id)}
                className="inline-flex items-center gap-1 rounded-md border border-stone-200 bg-white px-2 py-1 text-[10px] font-medium text-stone-500 transition-all hover:border-stone-300 hover:text-stone-600 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-400 dark:hover:border-stone-600"
                title="Delete message"
              >
                <Trash2 className="h-3 w-3" />
                Delete
              </button>
            </div>
          )}
        </div>
      </div>

      {lightboxImage && (
        <ImageLightbox
          imageUrl={lightboxImage}
          onClose={() => setLightboxImage(null)}
        />
      )}
    </div>
  );
});

// ─── Date separator ────────────────────────────────────────────────
function DateSeparator({ dateStr }: { dateStr: string }) {
  const label = (() => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    if (days === 0) return "Today";
    if (days === 1) return "Yesterday";
    if (days < 7) return date.toLocaleDateString("en-US", { weekday: "long" });
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  })();

  return (
    <div className="flex items-center gap-3 py-2">
      <div className="flex-1 border-t border-stone-200 dark:border-stone-700" />
      <span className="text-[10px] font-medium text-stone-400 dark:text-stone-500">{label}</span>
      <div className="flex-1 border-t border-stone-200 dark:border-stone-700" />
    </div>
  );
}

// ─── Typing indicator ─────────────────────────────────────────────
const TypingIndicator = memo(function TypingIndicator() {
  return (
    <div className="flex items-start gap-3 animate-in slide-in-from-bottom-1 fade-in duration-300">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-stone-200 dark:bg-stone-700">
        <Sparkles className="h-3.5 w-3.5 text-stone-500 dark:text-stone-400" />
      </div>
      <div className="rounded-2xl border border-stone-200 bg-white px-5 py-4 dark:border-stone-700 dark:bg-stone-800 shadow-sm">
        <div className="flex items-center gap-1.5">
          <div className="h-2 w-2 animate-bounce rounded-full bg-stone-400 [animation-delay:-0.3s] [animation-duration:0.6s]" />
          <div className="h-2 w-2 animate-bounce rounded-full bg-stone-400 [animation-delay:-0.15s] [animation-duration:0.6s]" />
          <div className="h-2 w-2 animate-bounce rounded-full bg-stone-400 [animation-duration:0.6s]" />
        </div>
      </div>
    </div>
  );
});

// ─── Main component ───────────────────────────────────────────────
function ChatWorkspaceInner({
  documents,
  initialDocumentId,
  initialSessionId,
  initialMessages,
  initialNotes,
}: ChatWorkspaceProps) {
  // ── State ────────────────────────────────────────────────────
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(
    initialSessionId,
  );

  const [messages, setMessages] = useState<ChatMessage[]>(
    () => initialMessages ?? [],
  );
  const [notes, setNotes] = useState<SavedNote[]>(
    () => initialNotes ?? [],
  );
  const [input, setInput] = useState("");
  const [selectedImages, setSelectedImages] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imageUploadError, setImageUploadError] = useState<string | null>(null);
  const [filePreviews, setFilePreviews] = useState<Array<ChatFile & { uploading?: boolean; uploadError?: string }>>([]);
  const [sending, setSending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [showJumpToLatest, setShowJumpToLatest] = useState(false);
  const [flashedMessageId, setFlashedMessageId] = useState<string | null>(null);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [highlightPickerMessageId, setHighlightPickerMessageId] = useState<string | null>(null);
  const [pendingSelection, setPendingSelection] = useState<{
    messageId: string;
    text: string;
    selectionStart: number;
    selectionEnd: number;
  } | null>(null);
  const [sidebarWidth, setSidebarWidth] = useState(256);
  const [renamingSession, setRenamingSession] = useState(false);
  const [sessionTitle, setSessionTitle] = useState<string>("");
  const [streamingMode, setStreamingMode] = useState(false);
  const [messageFeedback, setMessageFeedback] = useState<Record<string, "up" | "down" | null>>({});

  // ── Guest trial state ─────────────────────────────────────────
  const guest = useGuestSession();

  const pendingSelectionRef = useRef<{
    messageId: string;
    text: string;
    selectionStart: number;
    selectionEnd: number;
  } | null>(null);

  // ── Refs ─────────────────────────────────────────────────────
  const router = useRouter();
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const messageRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const flashTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isLoadingRef = useRef(false);
  const loadedSessionRef = useRef<string | null>(
    initialMessages && initialSessionId ? initialSessionId : null,
  );
  const inputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  // ── Derived ────────────────────────────────────────────────────
  const currentDocumentId = initialDocumentId;
  const { sessions: chatSessions, refreshSessions } = useChatSessions(
    currentDocumentId ?? undefined,
  );

  const pinnedSessions = useMemo(
    () => chatSessions.filter((s) => s.is_pinned),
    [chatSessions],
  );
  const unpinnedSessions = useMemo(
    () => chatSessions.filter((s) => !s.is_pinned),
    [chatSessions],
  );
  const sortedSessions = useMemo(
    () => [...pinnedSessions, ...unpinnedSessions].slice(0, 8),
    [pinnedSessions, unpinnedSessions],
  );

  const noteIdsMap = useMemo(
    () => new Set(notes.map((note) => note.messageId)),
    [notes],
  );

  const pinnedNotes = useMemo(
    () => notes.filter((n) => n.isPinned).slice(0, 3),
    [notes],
  );
  const pinnedCount = pinnedNotes.length;
  const pinnedIds = useMemo(
    () => new Set(pinnedNotes.map((n) => n.id)),
    [pinnedNotes],
  );
  const unpinnedNotes = useMemo(
    () => notes.filter((n) => !n.isPinned),
    [notes],
  );

  const sortedNotes = useMemo(() => {
    const unpinned = notes.filter((n) => !n.isPinned);
    return [...pinnedNotes, ...unpinned].slice(0, 5);
  }, [notes, pinnedNotes]);

  const selectedDocument = useMemo(
    () => documents.find((doc) => doc.id === currentDocumentId) ?? null,
    [documents, currentDocumentId],
  );

  // ── Effects ──────────────────────────────────────────────────
  useEffect(() => {
    if (loadedSessionRef.current !== initialSessionId) {
      isLoadingRef.current = false;
    }
  }, [initialSessionId]);

  useEffect(() => {
    return () => {
      if (flashTimeoutRef.current) clearTimeout(flashTimeoutRef.current);
      imagePreviews.forEach((preview) => URL.revokeObjectURL(preview));
    };
  }, [imagePreviews]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+Enter or Cmd+Enter to submit
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        if (formRef.current) {
          formRef.current.requestSubmit();
        }
      }

      // Escape to cancel highlight picker
      if (e.key === "Escape") {
        setHighlightPickerMessageId(null);
        setPendingSelection(null);
        pendingSelectionRef.current = null;
        setErrorMessage(null);
      }

      // "/" to focus input (when not in input/textarea)
      if (
        e.key === "/" &&
        document.activeElement?.tagName !== "INPUT" &&
        document.activeElement?.tagName !== "TEXTAREA"
      ) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  // ── Scroll helpers ────────────────────────────────────────────
  const updateScrollState = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const distanceFromBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight;
    setShowJumpToLatest(distanceFromBottom >= 120);
  }, []);

  const scrollToLatest = useCallback((behavior: ScrollBehavior = "smooth") => {
    const container = scrollContainerRef.current;
    if (!container) return;
    container.scrollTo({ top: container.scrollHeight, behavior });
  }, []);

  useEffect(() => {
    if (messages.length === 0) return;
    const container = scrollContainerRef.current;
    if (!container) return;
    const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
    if (distanceFromBottom < 150) {
      scrollToLatest("smooth");
    }
  }, [messages.length, messages.at(-1)?.id]);

  const scrollToMessage = useCallback((messageId: string) => {
    const element = messageRefs.current[messageId];
    if (!element) return;
    element.scrollIntoView({ behavior: "smooth", block: "center" });
  }, []);

  const handleFlash = useCallback((messageId: string) => {
    setFlashedMessageId(messageId);
    if (flashTimeoutRef.current) clearTimeout(flashTimeoutRef.current);
    flashTimeoutRef.current = setTimeout(() => setFlashedMessageId(null), 500);
  }, []);

  // ── Resize handlers ──────────────────────────────────────────
  const startSidebarResize = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      const startX = e.clientX;
      const startWidth = sidebarWidth;
      const onMove = (ev: MouseEvent) => {
        const delta = ev.clientX - startX;
        setSidebarWidth(Math.min(Math.max(startWidth + delta, 200), 400));
      };
      const onUp = () => {
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
      };
      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    },
    [sidebarWidth],
  );

  // ── Clipboard ────────────────────────────────────────────────
  const copyToClipboard = useCallback((content: string, messageId: string) => {
    navigator.clipboard
      .write([new ClipboardItem({ "text/plain": new Blob([content], { type: "text/plain" }) })])
      .catch(() => {
        navigator.clipboard.writeText(content);
      });
    setCopiedMessageId(messageId);
    setTimeout(() => setCopiedMessageId(null), 2000);
  }, []);

  // ── Delete message ──────────────────────────────────────────
  const handleDeleteMessage = useCallback(
    async (messageId: string) => {
      setMessages((prev) => prev.filter((m) => m.id !== messageId));
      setNotes((prev) => prev.filter((n) => n.messageId !== messageId));
      toast.success("Message deleted");
    },
    [],
  );

  // ── Retry message ────────────────────────────────────────────
  const handleRetryMessage = useCallback(
    (messageId: string) => {
      const msgIndex = messages.findIndex((m) => m.id === messageId);
      if (msgIndex === -1) return;

      const userMsg = messages[msgIndex - 1];
      const assistantMsg = messages[msgIndex];

      if (!userMsg || userMsg.role !== "user" || assistantMsg.role !== "assistant") {
        toast.error("Can only retry failed assistant messages");
        return;
      }

      setMessages((prev) =>
        prev.filter((m) => m.id !== messageId),
      );
      setErrorMessage(null);

      inputRef.current?.focus();
    },
    [messages],
  );

  // ── Save annotation ───────────────────────────────────────────
  const handleSaveAnnotation = useCallback(
    async (
      messageId: string,
      noteContent: string | null,
      highlightColor?: HighlightColor | null,
      selectionStart?: number | null,
      selectionEnd?: number | null,
    ) => {
      if (!currentSessionId) {
        console.error("[handleSaveAnnotation] No currentSessionId, skipping");
        return;
      }

      const res = await fetch("/api/annotations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messageId,
          sessionId: currentSessionId,
          noteContent,
          highlightColor: highlightColor ?? null,
          selectionStart: selectionStart ?? null,
          selectionEnd: selectionEnd ?? null,
        }),
      });
      const payload = (await res.json()) as
        | { success: true }
        | { success: false; error: string }
        | null;

      if (!res.ok || !payload || !payload.success) {
        const errorMsg = payload && "error" in payload ? payload.error : "Could not save annotation.";
        throw new Error(errorMsg);
      }
    },
    [currentSessionId],
  );

  // ── Toggle note ──────────────────────────────────────────────
  const handleToggleNote = useCallback(
    async (messageId: string) => {
      const existingNote = notes.find((n) => n.messageId === messageId);
      const msg = messages.find((m) => m.id === messageId);
      const noteContent = msg?.content ?? null;

      if (existingNote) {
        if (currentSessionId) {
          try {
            const res = await fetch("/api/annotations", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ messageId, sessionId: currentSessionId }),
            });
            if (!res.ok) throw new Error("Delete failed");
            setNotes((prev) => prev.filter((n) => n.messageId !== messageId));
            toast.success("Note removed");
          } catch {
            toast.error("Failed to remove note");
          }
        } else {
          setNotes((prev) => prev.filter((n) => n.messageId !== messageId));
          toast.error("Note removed locally — no active session to persist to");
        }
      } else {
        await handleSaveAnnotation(messageId, noteContent);
        const newNote: SavedNote = { id: createMessageId(), messageId };
        setNotes((prev) => [...prev, newNote]);
        handleFlash(messageId);
        requestAnimationFrame(() => scrollToLatest());
        toast.success("Note saved!");
      }
    },
    [notes, messages, currentSessionId, handleSaveAnnotation, handleFlash, scrollToLatest],
  );

  // ── Toggle pin ───────────────────────────────────────────────
  const handleTogglePin = useCallback(
    async (noteId: string) => {
      const note = notes.find((n) => n.id === noteId);
      if (!note) return;
      if (!currentSessionId) {
        toast.error("Cannot pin note: no active session");
        return;
      }

      const pinnedNow = !note.isPinned;
      if (pinnedNow && pinnedCount >= 3) {
        toast.error("Maximum 3 pinned notes allowed");
        return;
      }

      const msg = messages.find((m) => m.id === note.messageId);

      setNotes((prev) =>
        prev.map((n) => (n.id === noteId ? { ...n, isPinned: pinnedNow } : n)),
      );

      try {
        await fetch("/api/annotations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messageId: note.messageId,
            sessionId: currentSessionId,
            noteContent: msg?.content ?? null,
            highlightColor: null,
            isPinned: pinnedNow,
          }),
        });
      } catch {
        setNotes((prev) =>
          prev.map((n) =>
            n.id === noteId ? { ...n, isPinned: !pinnedNow } : n,
          ),
        );
        toast.error("Failed to update pin");
      }
    },
    [notes, messages, currentSessionId, pinnedCount],
  );

  // ── Feedback ─────────────────────────────────────────────────
  const handleFeedback = useCallback(
    async (messageId: string, vote: "up" | "down") => {
      const current = messageFeedback[messageId];

      if (current === vote) {
        // Toggle off: remove feedback
        try {
          const res = await fetch(`/api/feedback?messageId=${messageId}`, { method: "DELETE" });
          if (!res.ok) throw new Error("Failed to remove");
          setMessageFeedback((prev) => ({ ...prev, [messageId]: null }));
        } catch {
          toast.error("Failed to remove feedback");
        }
      } else {
        // Set new vote
        try {
          const res = await fetch("/api/feedback", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ messageId, vote }),
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(data.error ?? "Failed to submit feedback");
          setMessageFeedback((prev) => ({ ...prev, [messageId]: vote }));
          toast.success(vote === "up" ? "Thanks for the feedback!" : "Thanks, we'll do better.");
        } catch (err) {
          toast.error(err instanceof Error ? err.message : "Failed to submit feedback");
        }
      }
    },
    [messageFeedback],
  );
  // ── Apply highlight ────────────────────────────────────────────
  const handleHighlight = useCallback(
    async (messageId: string, color: HighlightColor) => {
      const sel = pendingSelectionRef.current?.messageId === messageId
        ? pendingSelectionRef.current
        : null;

      const selStart = sel?.selectionStart ?? null;
      const selEnd = sel?.selectionEnd ?? null;

      await handleSaveAnnotation(messageId, null, color, selStart, selEnd);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId
            ? { ...m, highlightColor: color, selectionStart: selStart, selectionEnd: selEnd }
            : m,
        ),
      );
      setHighlightPickerMessageId(null);
      setPendingSelection(null);
      pendingSelectionRef.current = null;
      toast.success("Highlight saved!");
    },
    [handleSaveAnnotation],
  );

  // ── Load session messages ──────────────────────────────────────
  useEffect(() => {
    if (initialMessages && initialMessages.length > 0) {
      if (currentSessionId) {
        loadedSessionRef.current = currentSessionId;
      }
      return;
    }

    if (!currentSessionId) {
      setMessages([]);
      setNotes([]);
      setLoadingHistory(false);
      return;
    }

    if (isLoadingRef.current) return;
    if (loadedSessionRef.current === currentSessionId) return;

    isLoadingRef.current = true;
    setLoadingHistory(true);

    fetch(`/api/sessions/${currentSessionId}/messages`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load");
        return res.json();
      })
      .then(
        (data: {
          messages: Array<{
            id: string;
            role: "user" | "assistant";
            content: string;
            image_url?: string | null;
            image_urls?: string[];
            chat_files?: Array<{
              fileId: string;
              filename: string;
              mimeType: string;
              storageUrl: string;
              fileSize: number;
            }>;
            citations: Array<{
              filename: string;
              chunk_index: number;
              content_preview: string;
            }>;
            created_at?: string;
          }>;
          annotations: PersistedAnnotation[];
        }) => {
          const annotationMap = new Map(
            (data.annotations ?? []).map((a) => [a.message_id, a]),
          );

          const newMessages: ChatMessage[] = data.messages.map((msg) => {
            const ann = annotationMap.get(msg.id);
            const urls = msg.image_urls ?? (msg.image_url ? [msg.image_url] : []);
            return {
              id: msg.id,
              role: msg.role,
              content: msg.content,
              imageUrls: urls.length > 0 ? urls : undefined,
              chatFiles: msg.chat_files ?? undefined,
              citations: msg.citations?.map((c, i) => ({
                index: i + 1,
                snippet: c.content_preview ?? "",
              })),
              highlightColor: (ann?.highlight_color as HighlightColor) ?? null,
              selectionStart: ann?.selection_start ?? null,
              selectionEnd: ann?.selection_end ?? null,
              createdAt: msg.created_at ?? null,
            };
          });

          const newNotes = data.annotations.map((a) => ({
            id: a.id,
            messageId: a.message_id,
            isPinned: a.is_pinned ?? false,
          }));

          setMessages(newMessages);
          setNotes(newNotes);
          loadedSessionRef.current = currentSessionId;

          requestAnimationFrame(() =>
            requestAnimationFrame(() => scrollToLatest("auto")),
          );
        },
      )
      .catch((error) => {
        console.error("Failed to load chat history:", error);
        toast.error("Failed to load chat history");
      })
      .finally(() => {
        setLoadingHistory(false);
        isLoadingRef.current = false;
      });
  }, [currentSessionId, initialMessages, scrollToLatest]);

  // ── Image handling ─────────────────────────────────────────────
  const handleImageSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files ?? []);
      if (files.length === 0) return;

      const newFiles = files.slice(0, 5 - selectedImages.length);
      const newPreviews = newFiles.map((file) => URL.createObjectURL(file));

      setSelectedImages((prev) => [...prev, ...newFiles].slice(0, 5));
      setImagePreviews((prev) => [...prev, ...newPreviews].slice(0, 5));
      setImageUploadError(null);
      e.target.value = "";
    },
    [selectedImages.length],
  );

  const removeSelectedImage = useCallback(
    (index: number) => {
      if (imagePreviews[index]) URL.revokeObjectURL(imagePreviews[index]);
      setSelectedImages((prev) => prev.filter((_, i) => i !== index));
      setImagePreviews((prev) => prev.filter((_, i) => i !== index));
      setImageUploadError(null);
    },
    [imagePreviews],
  );

  const clearAllImages = useCallback(() => {
    imagePreviews.forEach((preview) => URL.revokeObjectURL(preview));
    setSelectedImages([]);
    setImagePreviews([]);
    setImageUploadError(null);
  }, [imagePreviews]);

  // ── File handling ─────────────────────────────────────────────
  const handleFileSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files ?? []);
      if (files.length === 0) return;

      const allowed = [
        "application/pdf",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "text/plain",
        "text/markdown",
        "text/csv",
      ];
      const valid = files.filter((f) => allowed.includes(f.type));
      const remaining = 3 - filePreviews.length;
      const toUpload = valid.slice(0, remaining);

      if (toUpload.length === 0) {
        toast.error("Unsupported file type or limit reached (max 3).");
        e.target.value = "";
        return;
      }

      const tempPreviews = toUpload.map((file) => ({
        fileId: `temp-${Date.now()}-${Math.random()}`,
        filename: file.name,
        mimeType: file.type,
        storageUrl: "",
        fileSize: file.size,
        uploading: true,
        uploadError: undefined,
      }));

      setFilePreviews((prev) => [...prev, ...tempPreviews].slice(0, 3));
      setSending(true);

      for (let i = 0; i < toUpload.length; i++) {
        const file = toUpload[i];
        const tempId = tempPreviews[i].fileId;

        try {
          const formData = new FormData();
          formData.append("file", file);
          const res = await fetch("/api/chat-files", { method: "POST", body: formData });
          const data = await res.json();

          if (res.ok && data.fileId) {
            setFilePreviews((prev) =>
              prev.map((fp) =>
                fp.fileId === tempId
                  ? {
                      ...fp,
                      fileId: data.fileId ?? fp.fileId,
                      storageUrl: data.storageUrl ?? fp.storageUrl,
                      mimeType: data.mimeType ?? fp.mimeType,
                      fileSize: data.fileSize ?? fp.fileSize,
                      extractedText: data.extractedText ?? fp.extractedText,
                      uploading: false,
                      uploadError: undefined,
                    }
                  : fp,
              ),
            );
          } else {
            setFilePreviews((prev) =>
              prev.map((fp) =>
                fp.fileId === tempId
                  ? { ...fp, uploading: false, uploadError: data.error ?? "Upload failed" }
                  : fp,
              ),
            );
            toast.error(`Upload failed: ${data.error ?? file.name}`);
          }
        } catch {
          setFilePreviews((prev) =>
            prev.map((fp) =>
              fp.fileId === tempId
                ? { ...fp, uploading: false, uploadError: "Network error" }
                : fp,
            ),
          );
          toast.error(`Upload failed: ${file.name}`);
        }
      }

      setSending(false);
      e.target.value = "";
    },
    [filePreviews.length],
  );

  const removeSelectedFile = useCallback(
    (index: number) => {
      setFilePreviews((prev) => prev.filter((_, i) => i !== index));
    },
    [],
  );

  const clearAllFiles = useCallback(() => {
    setFilePreviews([]);
  }, []);

  // ── Drag and drop ─────────────────────────────────────────────
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
  }, []);

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDraggingOver(false);

      if (!currentDocumentId || sending) return;

      const files = Array.from(e.dataTransfer.files);
      const imageFiles = files.filter((file) => file.type.startsWith("image/"));

      if (imageFiles.length > 0) {
        const newFiles = imageFiles.slice(0, 5 - selectedImages.length);
        const newPreviews = newFiles.map((file) => URL.createObjectURL(file));

        setSelectedImages((prev) => [...prev, ...newFiles].slice(0, 5));
        setImagePreviews((prev) => [...prev, ...newPreviews].slice(0, 5));

        if (newFiles.length > 0) {
          toast.success(`Added ${newFiles.length} image${newFiles.length > 1 ? "s" : ""}`);
        }
      }

      const allowedDocTypes = [
        "application/pdf",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "text/plain",
        "text/markdown",
        "text/csv",
      ];
      const docFiles = files.filter((file) => allowedDocTypes.includes(file.type));

      if (docFiles.length > 0) {
        const remaining = 3 - filePreviews.length;
        const toUpload = docFiles.slice(0, remaining);

        if (toUpload.length === 0) {
          toast.error("File limit reached (max 3).");
          return;
        }

        const tempPreviews = toUpload.map((file) => ({
          fileId: `temp-${Date.now()}-${Math.random()}`,
          filename: file.name,
          mimeType: file.type,
          storageUrl: "",
          fileSize: file.size,
          uploading: true,
          uploadError: undefined,
        }));

        setFilePreviews((prev) => [...prev, ...tempPreviews].slice(0, 3));
        setSending(true);

        for (let i = 0; i < toUpload.length; i++) {
          const file = toUpload[i];
          const tempId = tempPreviews[i].fileId;

          try {
            const formData = new FormData();
            formData.append("file", file);
            const res = await fetch("/api/chat-files", {
              method: "POST",
              body: formData,
              headers: guest.isGuest ? { "x-anonymous-id": guest.session!.anonymousId } : {},
            });
            const data = await res.json();

            if (res.ok && data.fileId) {
              setFilePreviews((prev) =>
                prev.map((fp) =>
                  fp.fileId === tempId
                    ? {
                        ...fp,
                        fileId: data.fileId,
                        storageUrl: data.storageUrl,
                        uploading: false,
                        uploadError: undefined,
                      }
                    : fp,
                ),
              );
            } else {
              setFilePreviews((prev) =>
                prev.map((fp) =>
                  fp.fileId === tempId
                    ? { ...fp, uploading: false, uploadError: data.error ?? "Upload failed" }
                    : fp,
                ),
              );
            }
          } catch {
            setFilePreviews((prev) =>
              prev.map((fp) =>
                fp.fileId === tempId
                  ? { ...fp, uploading: false, uploadError: "Network error" }
                  : fp,
              ),
            );
          }
        }

        setSending(false);
        toast.success(`Added ${toUpload.length} file${toUpload.length > 1 ? "s" : ""}`);
      }
    },
    [currentDocumentId, sending, selectedImages.length, filePreviews.length],
  );

  // ── Submit ────────────────────────────────────────────────────
  const handleSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const trimmed = input.trim();
      if (!trimmed && selectedImages.length === 0 && filePreviews.length === 0) return;
      if (!currentDocumentId) return;

      const imageUrls: string[] = [];

      if (selectedImages.length > 0) {
        setUploadingImage(true);
        setImageUploadError(null);

        for (const file of selectedImages) {
          try {
            const formData = new FormData();
            formData.append("file", file);
            const res = await fetch("/api/chat-images", {
              method: "POST",
              body: formData,
              headers: guest.isGuest ? { "x-anonymous-id": guest.session!.anonymousId } : {},
            });
            const data = await res.json();
            if (!res.ok || !data.url) {
              throw new Error(data.error || "Upload failed");
            }
            imageUrls.push(data.url);
          } catch (error) {
            const msg = error instanceof Error ? error.message : "Upload failed";
            setImageUploadError(msg);
            toast.error(msg);
            setUploadingImage(false);
            return;
          } finally {
            setUploadingImage(false);
          }
        }
      }

      const uploadedFiles: ChatFile[] = filePreviews
        .filter((fp) => !fp.uploading && fp.storageUrl)
        .map((fp) => ({
          fileId: fp.fileId,
          filename: fp.filename,
          mimeType: fp.mimeType,
          storageUrl: fp.storageUrl,
          fileSize: fp.fileSize,
          extractedText: fp.extractedText,
        }));

      const userMessage: ChatMessage = {
        id: createMessageId(),
        role: "user",
        content: trimmed,
        imageUrls: imageUrls.length > 0 ? imageUrls : undefined,
        chatFiles: uploadedFiles.length > 0 ? uploadedFiles : undefined,
        createdAt: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, userMessage]);
      setInput("");
      clearAllImages();
      clearAllFiles();
      setSending(true);
      setHighlightPickerMessageId(null);
      setPendingSelection(null);
      setErrorMessage(null);

      requestAnimationFrame(() => scrollToLatest());

      try {
        const guestHeaders: HeadersInit = guest.isGuest
          ? { "Content-Type": "application/json", "x-anonymous-id": guest.session!.anonymousId }
          : { "Content-Type": "application/json" };

        if (streamingMode) {
          // ── Streaming mode ────────────────────────────────────────
          const clientMessageId = createMessageId();
          let serverMessageId: string | null = null;

          setMessages((prev) => [
            ...prev,
            {
              id: clientMessageId,
              role: "assistant",
              content: "",
              citations: [],
              highlightColor: null,
              selectionStart: null,
              selectionEnd: null,
              createdAt: new Date().toISOString(),
              error: null,
            },
          ]);

          const response = await fetch("/api/chat/stream", {
            method: "POST",
            headers: guestHeaders,
            body: JSON.stringify({
              documentId: currentDocumentId,
              message: trimmed,
              imageUrls: imageUrls.length > 0 ? imageUrls : undefined,
              chatFiles: uploadedFiles.length > 0 ? uploadedFiles : undefined,
              sessionId: currentSessionId,
            }),
          });

          if (!response.ok) {
            const err = await response.json().catch(() => ({ error: "Stream failed" }));
            throw new Error(err.error ?? "Could not get an answer.");
          }

          const reader = response.body?.getReader();
          if (!reader) throw new Error("No response stream.");

          const decoder = new TextDecoder();
          let buffer = "";

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() ?? "";

            for (const line of lines) {
              if (!line.startsWith("data: ")) continue;
              const data = line.slice(6).trim();
              if (data === "[DONE]") continue;

              try {
                const parsed = JSON.parse(data);
                if (parsed.type === "message_id" && parsed.messageId) {
                  serverMessageId = parsed.messageId;
                } else if (parsed.type === "session" && parsed.sessionId) {
                  setCurrentSessionId(parsed.sessionId);
                  router.replace(
                    `/chat?documentId=${currentDocumentId}&sessionId=${parsed.sessionId}`
                  );
                } else if (parsed.type === "text" && typeof parsed.content === "string") {
                  setMessages((prev) => {
                    const idx = prev.findIndex((m) => m.id === clientMessageId);
                    if (idx === -1) return prev;
                    const updated = [...prev];
                    updated[idx] = { ...updated[idx], content: (updated[idx].content ?? "") + parsed.content };
                    return updated;
                  });
                  requestAnimationFrame(() => scrollToLatest());
                }
              } catch {
                // Skip malformed lines
              }
            }
          }

          // Update the client message with the real server ID for feedback
          if (serverMessageId && serverMessageId !== clientMessageId) {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === clientMessageId ? { ...m, id: serverMessageId as string } : m
              )
            );
            setMessageFeedback((prev) => {
              const val = prev[clientMessageId];
              const updated = { ...prev };
              if (val != null) {
                updated[serverMessageId as string] = val;
                delete updated[clientMessageId];
              }
              return updated;
            });
          }

          // Touch session to update timestamp
          if (currentSessionId) {
            fetch(`/api/sessions/${currentSessionId}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({}),
            }).catch(() => {});
          }

          // Guest: increment message count after stream finishes
          if (guest.isGuest && guest.session) {
            void guest.incrementMessageCount(guest.session.anonymousId);
          }
        } else {
          // ── Non-streaming mode ─────────────────────────────────
          const response = await fetch("/api/chat", {
            method: "POST",
            headers: guestHeaders,
            body: JSON.stringify({
              documentId: currentDocumentId,
              message: trimmed,
              imageUrls: imageUrls.length > 0 ? imageUrls : undefined,
              chatFiles: uploadedFiles.length > 0 ? uploadedFiles : undefined,
              sessionId: currentSessionId,
            }),
          });

          const payload = (await response.json()) as
            | {
                answer?: string;
                citations?: Citation[];
                sessionId?: string;
                assistantMessageId?: string | null;
                reused?: boolean;
                error?: string;
              }
            | null;

          if (!response.ok || !payload?.answer) {
            throw new Error(payload?.error || "Could not get an answer.");
          }

          const answer = payload.answer;
          const citations = payload.citations ?? [];
          const assistantMessageId =
            payload.assistantMessageId ?? createMessageId();

          setMessages((prev) => [
            ...prev,
            {
              id: assistantMessageId,
              role: "assistant",
              content: answer,
              citations,
              highlightColor: null,
              selectionStart: null,
              selectionEnd: null,
              createdAt: new Date().toISOString(),
              error: null,
            },
          ]);

          if (
            payload.sessionId &&
            payload.sessionId !== currentSessionId
          ) {
            setCurrentSessionId(payload.sessionId);
            router.replace(
              `/chat?documentId=${currentDocumentId}&sessionId=${payload.sessionId}`,
            );
          }

          requestAnimationFrame(() => scrollToLatest());

          // Guest: increment message count on success
          if (guest.isGuest && guest.session) {
            void guest.incrementMessageCount(guest.session.anonymousId);
          }

          if (payload.reused) {
            toast.success("Reused a previous answer — instant response!");
          }
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error
            ? error.message
            : "Could not get an answer.";

        if (errorMessage.includes("Trial ended")) {
          toast.error("Trial ended. Sign up to continue.");
        }

        setErrorMessage(errorMessage);

        const assistantMessageId = createMessageId();
        setMessages((prev) => [
          ...prev,
          {
            id: assistantMessageId,
            role: "assistant",
            content: "",
            createdAt: new Date().toISOString(),
            error: errorMessage,
          },
        ]);

        requestAnimationFrame(() => scrollToLatest());
      } finally {
        setSending(false);
      }
    },
    [
      input,
      currentDocumentId,
      currentSessionId,
      selectedImages,
      clearAllImages,
      clearAllFiles,
      scrollToLatest,
      router,
      filePreviews,
      streamingMode,
      messages,
      guest,
    ],
  );

  // ── Navigation ────────────────────────────────────────────────
  const handleNewChat = useCallback(() => {
    if (currentDocumentId) {
      router.push(`/chat?documentId=${currentDocumentId}`);
    }
  }, [currentDocumentId, router]);

  const handleDocumentChange = useCallback(
    (newDocId: string) => {
      router.push(`/chat?documentId=${newDocId}`);
    },
    [router],
  );

  const handleExportChat = useCallback(() => {
    if (!currentSessionId) {
      toast.error("Start a conversation first before exporting.");
      return;
    }
    const url = `/api/sessions/${currentSessionId}/export`;
    const link = window.document.createElement("a");
    link.href = url;
    link.setAttribute("download", "");
    window.document.body.appendChild(link);
    link.click();
    window.document.body.removeChild(link);
    toast.success("Exporting chat...");
  }, [currentSessionId]);

  const handleHighlightPickerToggle = useCallback(
    (messageId: string | null) => {
      setHighlightPickerMessageId(messageId);
      if (messageId === null) {
        setPendingSelection(null);
        pendingSelectionRef.current = null;
      }
    },
    [],
  );

  // ── Render ───────────────────────────────────────────────────
  return (
    <div className="flex h-full min-h-0">
      {/* ── Sidebar ───────────────────────────────────────────── */}
      <aside
        style={{ width: sidebarWidth }}
        className="relative shrink-0 border-r border-stone-200 bg-stone-50 dark:border-stone-800 dark:bg-stone-900 max-md:hidden"
      >
        <div
          onMouseDown={startSidebarResize}
          className="absolute right-0 top-0 bottom-0 z-10 w-1 cursor-col-resize opacity-0 hover:opacity-100 transition-opacity hidden md:block"
        >
          <div className="ml-[-1px] h-full w-0.5 bg-stone-300 dark:bg-stone-600" />
        </div>

        <div className="flex h-full flex-col overflow-hidden">
          <div className="border-b border-stone-200 p-3 dark:border-stone-800">
            <button
              type="button"
              onClick={handleNewChat}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-stone-900 px-4 py-2.5 text-sm font-medium text-white transition-all hover:bg-stone-800 dark:bg-stone-700 dark:hover:bg-stone-600"
            >
              <Plus className="h-4 w-4" />
              New Chat
            </button>
          </div>

          <div className="flex-1 overflow-y-auto">
            {/* Documents */}
            <div className="p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-medium uppercase tracking-wider text-stone-500 dark:text-stone-400">
                  Documents
                </span>
                <span className="text-xs text-stone-400">{documents.length}</span>
              </div>
              <div className="space-y-1">
                {documents.map((doc) => (
                  <a
                    key={doc.id}
                    href={`/chat?documentId=${doc.id}`}
                    data-testid="document-item"
                    className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-all ${
                      doc.id === currentDocumentId
                        ? "bg-stone-200 font-medium text-stone-900 dark:bg-stone-800 dark:text-white"
                        : "text-stone-600 hover:bg-stone-100 dark:text-stone-400 dark:hover:bg-stone-800"
                    }`}
                  >
                    <FileText className="h-4 w-4 shrink-0" />
                    <span className="truncate">{doc.filename}</span>
                  </a>
                ))}
              </div>
            </div>

            {/* Pinned notes */}
            {pinnedNotes.length > 0 && (
              <div className="border-t border-stone-200 px-3 pt-2 dark:border-stone-800">
                <div className="mb-1 flex items-center gap-1">
                  <Pin className="h-3 w-3 fill-amber-400 text-amber-400" />
                  <span className="text-[10px] font-medium text-amber-600 dark:text-amber-400">
                    Pinned ({pinnedNotes.length}/3)
                  </span>
                </div>
                <div className="space-y-1 pb-2">
                  {pinnedNotes.map((note) => {
                    const message = messages.find((m) => m.id === note.messageId);
                    if (!message) return null;
                    return (
                      <div
                        key={note.id}
                        className="group flex items-center gap-1 rounded-lg bg-amber-50 px-2 py-1.5 transition-all hover:bg-amber-100 dark:bg-amber-900/20 dark:hover:bg-amber-900/30"
                      >
                        <button
                          type="button"
                          onClick={() => {
                            scrollToMessage(note.messageId);
                            handleFlash(note.messageId);
                          }}
                          className="flex flex-1 items-center gap-2 text-left text-xs"
                        >
                          <BookmarkPlus className="h-3.5 w-3.5 shrink-0 text-amber-500" />
                          <span className="min-w-0 flex-1 truncate text-amber-700 dark:text-amber-300">
                            {(message.content ?? "").slice(0, 40)}
                            {(message.content ?? "").length > 40 ? "..." : ""}
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleTogglePin(note.id)}
                          title="Unpin note"
                          className="shrink-0 rounded p-0.5 text-amber-400 opacity-0 transition-all hover:bg-amber-200 group-hover:opacity-100 dark:hover:bg-amber-800"
                        >
                          <Pin className="h-3 w-3 fill-amber-400 text-amber-400" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleToggleNote(note.messageId)}
                          title="Remove note"
                          className="shrink-0 rounded p-0.5 text-stone-400 opacity-0 transition-all hover:bg-stone-200 hover:text-stone-600 group-hover:opacity-100 dark:hover:bg-stone-700 dark:hover:text-stone-300"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Sessions */}
            {sortedSessions.length > 0 && (
              <div className="border-t border-stone-200 px-3 pt-2 dark:border-stone-800">
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-[10px] font-medium uppercase tracking-wider text-stone-500 dark:text-stone-400">
                    Recent Chats
                  </span>
                  <button
                    type="button"
                    onClick={refreshSessions}
                    className="rounded p-0.5 text-stone-400 hover:bg-stone-200 dark:hover:bg-stone-800"
                    title="Refresh"
                  >
                    <Loader2 className="h-3 w-3" />
                  </button>
                </div>
                <div className="space-y-0.5 pb-2">
                  {sortedSessions.map((session) => {
                    const isActive = currentSessionId === session.id;
                    const sessionUrl = `/chat?documentId=${session.document_id}&sessionId=${session.id}`;
                    return (
                      <div
                        key={session.id}
                        className="group relative flex items-center gap-1 rounded-md px-2 py-1.5 transition-colors hover:bg-stone-200/50 dark:hover:bg-stone-800/40"
                      >
                        <a
                          href={sessionUrl}
                          className={`absolute inset-0 rounded-md ${
                            isActive ? "bg-stone-200/70 dark:bg-stone-800" : ""
                          }`}
                        />
                        <Pin
                          className={`h-3 w-3 shrink-0 ${
                            session.is_pinned
                              ? "fill-amber-400 text-amber-400"
                              : "text-transparent"
                          }`}
                        />
                        <span className="min-w-0 flex-1 truncate text-xs text-stone-600 dark:text-stone-400">
                          {session.title}
                        </span>
                        <button
                          type="button"
                          onClick={async (e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            if (!confirm(`Pin "${session.title}"?`)) return;
                            try {
                              await fetch(`/api/sessions/${session.id}`, {
                                method: "PATCH",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ isPinned: !session.is_pinned }),
                              });
                              refreshSessions();
                            } catch {
                              toast.error("Failed to update pin");
                            }
                          }}
                          title={session.is_pinned ? "Unpin chat" : "Pin chat"}
                          className="shrink-0 rounded p-0.5 text-stone-400 opacity-0 transition-all hover:bg-stone-200 hover:text-stone-600 group-hover:opacity-100 dark:hover:bg-stone-700 dark:hover:text-stone-300"
                        >
                          <Pin className="h-3 w-3" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Unpinned notes */}
            {unpinnedNotes.length > 0 && (
              <div className="border-t border-stone-200 p-3 dark:border-stone-800">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-medium uppercase tracking-wider text-stone-500 dark:text-stone-400">
                    Saved Notes ({notes.length})
                  </span>
                </div>
                <div className="space-y-1">
                  {unpinnedNotes.map((note) => {
                    const message = messages.find((m) => m.id === note.messageId);
                    if (!message) return null;
                    return (
                      <div
                        key={note.id}
                        className="group flex items-center gap-1 rounded-lg bg-stone-100 px-2 py-1.5 transition-all hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-700"
                      >
                        <button
                          type="button"
                          onClick={() => {
                            scrollToMessage(note.messageId);
                            handleFlash(note.messageId);
                          }}
                          className="flex flex-1 items-center gap-2 text-left text-xs"
                        >
                          <BookmarkPlus className="h-3.5 w-3.5 shrink-0 text-stone-400" />
                          <span className="min-w-0 flex-1 truncate text-stone-600 dark:text-stone-300">
                            {(message.content ?? "").slice(0, 40)}
                            {(message.content ?? "").length > 40 ? "..." : ""}
                          </span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleTogglePin(note.id)}
                          disabled={!note.isPinned && pinnedCount >= 3}
                          title={
                            note.isPinned
                              ? "Unpin note"
                              : `Pin note (${pinnedCount}/3)`
                          }
                          className="shrink-0 rounded p-0.5 text-stone-400 opacity-0 transition-all hover:bg-stone-200 hover:text-stone-600 group-hover:opacity-100 disabled:cursor-not-allowed disabled:opacity-0 dark:hover:bg-stone-600 dark:hover:text-stone-300"
                        >
                          <Pin className="h-3 w-3" />
                        </button>

                        <button
                          type="button"
                          onClick={() => handleToggleNote(note.messageId)}
                          title="Remove note"
                          className="shrink-0 rounded p-0.5 text-stone-400 opacity-0 transition-all hover:bg-stone-200 hover:text-stone-600 group-hover:opacity-100 dark:hover:bg-stone-600 dark:hover:text-stone-300"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* ── Chat area ─────────────────────────────────────────── */}
      <main className="flex flex-1 flex-col min-w-0">
        {/* Header */}
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-stone-200 bg-stone-50/90 px-4 dark:border-stone-800 dark:bg-stone-900/90 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-stone-200 dark:bg-stone-700 shadow-sm">
              <MessageSquare className="h-4 w-4 text-stone-500 dark:text-stone-400" />
            </div>
            <div>
              <h1 className="text-sm font-medium text-stone-900 dark:text-white">
                {selectedDocument ? (
                  <span>Chatting with <span className="text-stone-600 dark:text-stone-300">{selectedDocument.filename}</span></span>
                ) : (
                  "No Document Selected"
                )}
              </h1>
              {currentSessionId && (
                <div className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-[10px] text-stone-400 dark:text-stone-500">
                    {messages.length} message{messages.length !== 1 ? "s" : ""}
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 max-sm:gap-1.5 overflow-x-auto">
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="text-xs text-stone-400 dark:text-stone-500 hidden sm:inline">Doc:</span>
              <select
                value={currentDocumentId ?? ""}
                onChange={(e) => handleDocumentChange(e.target.value)}
                className="appearance-none cursor-pointer rounded-lg border border-stone-200 bg-stone-50 px-2 py-1.5 pr-7 text-xs font-medium text-stone-600 transition-all hover:border-stone-300 focus:outline-none focus:ring-2 focus:ring-stone-200 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-400 dark:hover:border-stone-600 dark:focus:ring-stone-700 bg-[url('data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2212%22%20height%3D%2212%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%239CA3AF%22%20stroke-width%3D%222%22%3E%3Cpolyline%20points%3D%226%209%2012%2015%2018%209%22%3E%3C%2Fpolyline%3E%3C%2Fsvg%3E')] bg-[length:12px] bg-[right_6px_center] bg-no-repeat"
              >
                {documents.length === 0 && (
                  <option value="">No documents</option>
                )}
                {documents.map((doc) => (
                  <option key={doc.id} value={doc.id}>
                    {doc.filename}
                  </option>
                ))}
              </select>
            </div>

            {selectedDocument && (
              <button
                onClick={handleNewChat}
                title="Start new chat"
                className="flex items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-2.5 py-1.5 text-xs font-medium text-stone-600 transition-all hover:bg-stone-50 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-400 dark:hover:bg-stone-700"
              >
                <Plus className="h-3 w-3" />
                <span className="hidden sm:inline">New</span>
              </button>
            )}

            {currentSessionId && (
              <button
                onClick={handleExportChat}
                title="Export conversation as Markdown"
                className="flex items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-2.5 py-1.5 text-xs font-medium text-stone-600 transition-all hover:bg-stone-50 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-400 dark:hover:bg-stone-700"
              >
                <Download className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Export</span>
              </button>
            )}

            {currentSessionId && (
              <button
                onClick={() => setStreamingMode((v) => !v)}
                title={streamingMode ? "Disable streaming (responses appear at once)" : "Enable streaming (real-time responses)"}
                className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-all ${
                  streamingMode
                    ? "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400"
                    : "border-stone-200 bg-white text-stone-500 hover:bg-stone-50 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-500 dark:hover:bg-stone-700"
                }`}
              >
                {streamingMode ? (
                  <Wifi className="h-3.5 w-3.5" />
                ) : (
                  <WifiOff className="h-3.5 w-3.5" />
                )}
                <span className="hidden sm:inline">{streamingMode ? "Live" : "Batch"}</span>
              </button>
            )}
          </div>
        </header>

        {/* Error banner */}
        {errorMessage && (
          <div className="mx-4 md:mx-6 mt-4 flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 dark:border-red-900/40 dark:bg-red-900/20">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500 dark:text-red-400" />
            <div className="flex-1">
              <p className="text-sm font-medium text-red-800 dark:text-red-300">
                Something went wrong
              </p>
              <p className="text-xs text-red-600 dark:text-red-400">{errorMessage}</p>
            </div>
            <button
              onClick={() => setErrorMessage(null)}
              className="shrink-0 rounded p-0.5 text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40"
              aria-label="Dismiss error"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Messages */}
        <div
          ref={scrollContainerRef}
          onScroll={updateScrollState}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`flex-1 overflow-y-auto px-4 py-4 md:p-6 transition-all ${
            isDraggingOver ? "bg-stone-100/80 ring-2 ring-stone-400 ring-inset dark:bg-stone-800/80" : ""
          }`}
        >
          {isDraggingOver && (
            <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center rounded-lg bg-stone-100/90 dark:bg-stone-800/90">
              <ImagePlus className="h-12 w-12 text-stone-400" />
              <p className="mt-2 text-sm font-medium text-stone-500">Drop files or images here</p>
              <p className="text-xs text-stone-400">Max 5 images + 3 files</p>
            </div>
          )}
          {loadingHistory ? (
            <div className="flex h-full items-center justify-center">
              <div className="flex items-center gap-3 text-stone-500 dark:text-stone-400">
                <Loader2 className="h-6 w-6 animate-spin text-stone-400" />
                <span>Loading chat history...</span>
              </div>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-stone-200 dark:bg-stone-800">
                <MessageSquare className="h-7 w-7 text-stone-400 dark:text-stone-500" />
              </div>
              <h3 className="mb-1.5 text-base font-medium text-stone-700 dark:text-stone-100">
                Start a conversation
              </h3>
              <p className="mb-6 text-sm text-stone-500 dark:text-stone-400">
                Ask anything about{" "}
                <span className="font-medium text-stone-600 dark:text-stone-300">
                  {selectedDocument?.filename ?? "your document"}
                </span>
              </p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-2 max-w-sm">
                {[
                  { text: "Summarize key points", q: "Summarize the key points of this document" },
                  { text: "Explain simply", q: "Explain this in simple terms" },
                  { text: "Find details", q: "Find specific details about" },
                  { text: "Compare sections", q: "Compare different sections of this document" },
                ].map((suggestion) => (
                  <button
                    key={suggestion.text}
                    onClick={() => {
                      setInput(suggestion.q);
                      inputRef.current?.focus();
                    }}
                    className="group flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-left text-xs text-stone-600 transition-all duration-200 hover:border-stone-300 hover:bg-stone-50 hover:shadow-sm dark:border-stone-700 dark:bg-stone-800 dark:text-stone-400 dark:hover:border-stone-600 dark:hover:bg-stone-700 active:scale-[0.98]"
                  >
                    <span className="text-base leading-none">💬</span>
                    <span>{suggestion.text}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              {messages.map((message, index) => {
                const prevMessage = messages[index - 1];
                const showDateSep =
                  !prevMessage ||
                  !message.createdAt ||
                  !prevMessage.createdAt ||
                  new Date(message.createdAt).toDateString() !==
                    new Date(prevMessage.createdAt).toDateString();

                return (
                  <div key={message.id}>
                    {showDateSep && message.createdAt && (
                      <DateSeparator dateStr={message.createdAt} />
                    )}
                    <MessageBubble
                      message={message}
                      isSaved={noteIdsMap.has(message.id)}
                      flashedMessageId={flashedMessageId}
                      copiedMessageId={copiedMessageId}
                      highlightPickerOpen={highlightPickerMessageId === message.id}
                      pendingSelection={pendingSelection}
                      onHighlightPickerToggle={handleHighlightPickerToggle}
                      onHighlight={handleHighlight}
                      onCopy={copyToClipboard}
                      onToggleNote={handleToggleNote}
                      onDeleteMessage={handleDeleteMessage}
                      onRetryMessage={handleRetryMessage}
                      onFlash={handleFlash}
                      onPendingSelectionChange={setPendingSelection}
                      onRef={(el) => {
                        messageRefs.current[message.id] = el;
                      }}
                      onCitationClick={(idx) => {
                        const citation = message.citations?.find(c => c.index === idx);
                        if (citation) {
                          navigator.clipboard.writeText(citation.snippet);
                          toast.success("Citation copied to clipboard!");
                        }
                      }}
                      onFeedback={handleFeedback}
                      feedbackVote={messageFeedback[message.id]}
                    />
                  </div>
                );
              })}

              {sending && <TypingIndicator />}
            </div>
          )}
        </div>

        {/* Guest trial banner */}
        {guest.isGuest && !guest.isLoading && (
          <GuestTrialBanner
            messagesRemaining={guest.messagesRemaining}
            totalLimit={10}
            uploadUsed={!guest.canUpload}
            onSignUp={() => {
              void router.push("/sign-up");
            }}
          />
        )}

        {/* Guest trial popup */}
        <GuestTrialPopup
          isOpen={guest.showPopup}
          onDismiss={guest.dismissPopup}
          anonymousId={guest.session?.anonymousId}
        />

        {/* Jump to bottom */}
        {showJumpToLatest && (
          <button
            type="button"
            onClick={() => scrollToLatest("smooth")}
            className="absolute bottom-24 right-6 z-10 inline-flex items-center gap-1.5 rounded-full border border-stone-200 bg-white px-4 py-2 text-xs font-medium text-stone-600 shadow-sm transition-all hover:bg-stone-50 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-300 dark:hover:bg-stone-700"
          >
            <ArrowDown className="h-3 w-3" />
            Jump to latest
          </button>
        )}

        {/* Vertical resize handle - hidden on mobile */}
        <div
          onMouseDown={(e) => {
            e.preventDefault();
            const container = scrollContainerRef.current;
            if (!container) return;
            const startY = e.clientY;
            const startHeight = container.clientHeight;
            const onMove = (ev: MouseEvent) => {
              const delta = startY - ev.clientY;
              const newH = Math.min(
                Math.max(startHeight + delta, 200),
                window.innerHeight * 0.7,
              );
              container.style.height = `${newH}px`;
              updateScrollState();
            };
            const onUp = () => {
              document.removeEventListener("mousemove", onMove);
              document.removeEventListener("mouseup", onUp);
            };
            document.addEventListener("mousemove", onMove);
            document.addEventListener("mouseup", onUp);
          }}
          className="hidden md:flex group h-2 shrink-0 cursor-row-resize items-center justify-center bg-stone-100 hover:bg-stone-200 dark:bg-stone-900 dark:hover:bg-stone-800 transition-colors"
        >
          <div className="h-0.5 w-8 rounded-full bg-stone-300 dark:bg-stone-600 group-hover:bg-stone-400 dark:group-hover:bg-stone-500 transition-colors" />
        </div>

        {/* Input */}
        <div className="shrink-0 border-t border-stone-200 bg-stone-50/90 p-3 dark:border-stone-800 dark:bg-stone-900/90 backdrop-blur-sm">
          <form ref={formRef} onSubmit={handleSubmit} className="flex flex-col gap-2">
            {/* Image preview */}
            {imagePreviews.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 rounded-xl border border-stone-200 bg-white p-3 dark:border-stone-700 dark:bg-stone-800 shadow-sm">
                {imagePreviews.map((preview, idx) => (
                  <div key={idx} className="relative group/image">
                    <Image
                      src={preview}
                      alt={`Preview ${idx + 1}`}
                      width={56}
                      height={56}
                      className="h-14 w-14 rounded-lg border border-stone-200 object-cover transition-transform group-hover/image:scale-105 dark:border-stone-700"
                    />
                    {uploadingImage && idx === 0 && (
                      <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-black/50">
                        <Loader2 className="h-5 w-5 animate-spin text-white" />
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => removeSelectedImage(idx)}
                      disabled={uploadingImage}
                      className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-white opacity-0 transition-all hover:bg-red-600 group-hover/image:opacity-100 disabled:cursor-not-allowed disabled:opacity-50 shadow-sm"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-medium text-stone-500">
                    {imagePreviews.length}/5 images attached
                  </span>
                  {imageUploadError && (
                    <span className="text-[10px] text-red-500">{imageUploadError}</span>
                  )}
                  {uploadingImage && (
                    <span className="text-[10px] text-stone-400 animate-pulse">Uploading...</span>
                  )}
                  <button
                    type="button"
                    onClick={clearAllImages}
                    disabled={uploadingImage}
                    className="text-[10px] text-stone-400 hover:text-stone-600 dark:hover:text-stone-300 disabled:opacity-50"
                  >
                    Clear all
                  </button>
                </div>
              </div>
            )}

            {/* File preview */}
            {filePreviews.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 rounded-xl border border-stone-200 bg-white p-2.5 dark:border-stone-700 dark:bg-stone-800 shadow-sm">
                {filePreviews.map((fp, idx) => (
                  <div
                    key={fp.fileId}
                    className={`relative group/file flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 ${
                      fp.uploadError
                        ? "border-red-200 bg-red-50 dark:border-red-900/40 dark:bg-red-900/20"
                        : "border-stone-200 bg-stone-50 dark:border-stone-600 dark:bg-stone-700"
                    }`}
                  >
                    {fp.uploading ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-stone-400 shrink-0" />
                    ) : fp.uploadError ? (
                      <AlertCircle className="h-3.5 w-3.5 shrink-0 text-red-500" />
                    ) : (
                      <FileText className="h-3.5 w-3.5 shrink-0 text-stone-400" />
                    )}
                    <span className="max-w-[140px] truncate text-xs font-medium text-stone-600 dark:text-stone-300">
                      {fp.filename}
                    </span>
                    {fp.uploading && (
                      <span className="text-[10px] text-stone-400 animate-pulse">Uploading...</span>
                    )}
                    {fp.uploadError && (
                      <span className="text-[10px] text-red-500" title={fp.uploadError}>
                        Failed
                      </span>
                    )}
                    {!fp.uploading && (
                      <button
                        type="button"
                        onClick={() => removeSelectedFile(idx)}
                        className="flex h-4 w-4 shrink-0 items-center justify-center rounded text-stone-400 opacity-0 transition-all hover:text-red-500 group-hover/file:opacity-100"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                ))}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-stone-500">{filePreviews.length}/3 files</span>
                  <button
                    type="button"
                    onClick={clearAllFiles}
                    className="text-[10px] text-stone-400 hover:text-stone-600 dark:hover:text-stone-300"
                  >
                    Clear
                  </button>
                </div>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2 max-sm:gap-1.5">
              {/* Image attachment */}
              <div className="relative group/tooltip">
                <label
                  data-testid="image-upload-label"
                  className={`flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-lg border text-stone-400 transition-all ${
                    !selectedDocument || sending || imagePreviews.length >= 5 || guest.isBlocked || (guest.isGuest && !guest.canUpload)
                      ? "opacity-40 cursor-not-allowed border-stone-200 bg-stone-50 dark:border-stone-700 dark:bg-stone-800"
                      : "border-stone-200 bg-stone-50 hover:border-stone-300 hover:bg-stone-100 hover:text-stone-600 dark:border-stone-700 dark:bg-stone-800 dark:hover:border-stone-600 dark:hover:bg-stone-700"
                  }`}
                >
                  <input
                    data-testid="image-upload-input"
                    type="file"
                    accept="image/jpeg,image/png,image/gif,image/webp"
                    multiple
                    onChange={handleImageSelect}
                    disabled={!selectedDocument || sending || imagePreviews.length >= 5}
                    className="hidden"
                  />
                  <ImagePlus className="h-4 w-4" />
                </label>
                <div className="absolute bottom-full left-1/2 mb-2 -translate-x-1/2 whitespace-nowrap rounded-lg bg-stone-900 px-2 py-1 text-[10px] text-white opacity-0 pointer-events-none transition-opacity group-hover/tooltip:opacity-100 shadow-lg z-20">
                  Add image ({imagePreviews.length}/5)
                  <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-stone-900" />
                </div>
              </div>

              {/* File attachment */}
              <div className="relative group/tooltip">
                <label
                  className={`flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-lg border text-stone-400 transition-all ${
                    !selectedDocument || sending || filePreviews.length >= 3 || guest.isBlocked || (guest.isGuest && !guest.canUpload)
                      ? "opacity-40 cursor-not-allowed border-stone-200 bg-stone-50 dark:border-stone-700 dark:bg-stone-800"
                      : "border-stone-200 bg-stone-50 hover:border-stone-300 hover:bg-stone-100 hover:text-stone-600 dark:border-stone-700 dark:bg-stone-800 dark:hover:border-stone-600 dark:hover:bg-stone-700"
                  }`}
                >
                  <input
                    type="file"
                    accept="application/pdf,.pdf,.docx,.doc,.txt,.md,.csv"
                    multiple
                    onChange={handleFileSelect}
                    disabled={!selectedDocument || sending || filePreviews.length >= 3}
                    className="hidden"
                  />
                  <FileText className="h-4 w-4" />
                </label>
                <div className="absolute bottom-full left-1/2 mb-2 -translate-x-1/2 whitespace-nowrap rounded-lg bg-stone-900 px-2 py-1 text-[10px] text-white opacity-0 pointer-events-none transition-opacity group-hover/tooltip:opacity-100 shadow-lg z-20">
                  Add file ({filePreviews.length}/3)
                  <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-stone-900" />
                </div>
              </div>

              {/* Text input */}
              <input
                ref={inputRef}
                data-testid="chat-input"
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    formRef.current?.requestSubmit();
                  }
                }}
                placeholder={
                  selectedDocument
                    ? `Ask about ${selectedDocument.filename}...`
                    : "Select a document to start..."
                }
                disabled={(!selectedDocument || sending || guest.isBlocked)}
                className="flex-1 rounded-lg border border-stone-200 bg-white px-4 py-2 text-sm text-stone-900 placeholder:text-stone-400 focus:border-stone-400 focus:outline-none focus:ring-2 focus:ring-stone-200 disabled:cursor-not-allowed disabled:bg-stone-100 dark:border-stone-700 dark:bg-stone-800 dark:text-white dark:placeholder:text-stone-500 dark:focus:border-stone-600 dark:focus:ring-stone-700 transition-shadow"
              />

              {input.length > 0 && (
                <span className={`shrink-0 text-[10px] ${input.length > 900 ? "text-amber-500" : "text-stone-400"}`}>
                  {input.length}/1000
                </span>
              )}

              <button
                type="submit"
                disabled={
                  (!input.trim() && imagePreviews.length === 0 && filePreviews.length === 0) ||
                  !selectedDocument ||
                  sending ||
                  uploadingImage ||
                  (filePreviews.length > 0 && filePreviews.some(fp => fp.uploading)) ||
                  guest.isBlocked
                }
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-stone-900 text-white transition-all duration-200 hover:bg-stone-800 hover:scale-105 hover:shadow-md active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-primary dark:hover:bg-primary-hover"
              >
                {sending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <SendHorizonal className="h-4 w-4" />
                )}
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}

export const ChatWorkspace = memo(ChatWorkspaceInner, (prevProps, nextProps) => {
  // Custom comparison: only re-render if essential props change
  return (
    prevProps.documents === nextProps.documents &&
    prevProps.initialDocumentId === nextProps.initialDocumentId &&
    prevProps.initialSessionId === nextProps.initialSessionId &&
    prevProps.initialMessages === nextProps.initialMessages &&
    prevProps.initialNotes === nextProps.initialNotes
  );
});
