"use client";

import React, {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ArrowDown,
  BookmarkPlus,
  Copy,
  Check,
  FileText,
  ImagePlus,
  Loader2,
  MessageSquare,
  Pin,
  Plus,
  SendHorizonal,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

import { useChatSessions } from "@/hooks/useChatSessions";
import type { StoredDocument } from "@/lib/documents";

type Citation = {
  index: number;
  snippet: string;
};

type HighlightColor = "rose" | "amber" | "emerald" | "sky" | "violet";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  imageUrl?: string | null;
  citations?: Citation[];
  highlightColor?: HighlightColor | null;
  selectionStart?: number | null;
  selectionEnd?: number | null;
  createdAt?: string;
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

// ─── Highlight color config ─────────────────────────────────────
const HIGHLIGHT_COLORS: Array<{ color: HighlightColor; label: string }> = [
  { color: "rose", label: "Rose" },
  { color: "amber", label: "Amber" },
  { color: "emerald", label: "Emerald" },
  { color: "sky", label: "Sky" },
  { color: "violet", label: "Violet" },
];

// ─── Utility ────────────────────────────────────────────────────
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

// ─── Highlight color swatch button ──────────────────────────────
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

// ─── Inline highlighted text renderer ───────────────────────────
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

// ─── Message actions (AI messages only) ─────────────────────────
interface MessageActionsProps {
  message: ChatMessage;
  highlightPickerOpen: boolean;
  onHighlightPickerToggle: (messageId: string | null) => void;
  onHighlight: (messageId: string, color: HighlightColor) => void;
  onCopy: (content: string, messageId: string) => void;
  onToggleNote: (messageId: string) => Promise<void>;
  onDeleteMessage: (messageId: string) => void;
  copiedMessageId: string | null;
  isSaved: boolean;
}

const MessageActions = memo(function MessageActions({
  message,
  highlightPickerOpen,
  onHighlightPickerToggle,
  onHighlight,
  onCopy,
  onToggleNote,
  onDeleteMessage,
  copiedMessageId,
  isSaved,
}: MessageActionsProps) {
  const isCopied = copiedMessageId === message.id;

  return (
    <div className="mt-2 ml-1 flex flex-wrap items-center gap-1.5">
      {/* Highlight toggle — per-message */}
      <button
        onClick={() =>
          onHighlightPickerToggle(
            highlightPickerOpen ? null : message.id,
          )
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

      {/* Color picker — only when picker is open for this message */}
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

      {/* Copy */}
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

      {/* Save note */}
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

      {/* Delete */}
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

// ─── Message bubble ──────────────────────────────────────────────
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
  onFlash: (messageId: string) => void;
  onRef?: (el: HTMLDivElement | null) => void;
}

const MessageBubble = memo(function MessageBubble({
  message,
  isSaved,
  flashedMessageId,
  copiedMessageId,
  highlightPickerOpen,
  onHighlightPickerToggle,
  onHighlight,
  onCopy,
  onToggleNote,
  onDeleteMessage,
  onFlash,
  onRef,
}: MessageBubbleProps) {
  const isUser = message.role === "user";
  const isFlashed = flashedMessageId === message.id;
  const isCopied = copiedMessageId === message.id;

  // Capture text selection when highlight picker is open for this message
  const handleTextSelection = useCallback(() => {
    if (!highlightPickerOpen || isUser) return;
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) return;
    const selectedText = selection.toString();
    if (selectedText.length === 0) return;

    const range = selection.getRangeAt(0);
    const contentEl = document.getElementById(`msg-content-${message.id}`);
    if (!contentEl) return;

    // Clone everything before the selection start, then count plain text characters
    const preRange = document.createRange();
    preRange.setStart(contentEl, 0);
    preRange.setEnd(range.startContainer, range.startOffset);
    const preFragment = preRange.cloneContents();
    const preDiv = document.createElement("div");
    preDiv.appendChild(preFragment);
    const charsBefore = preDiv.textContent?.length ?? 0;

    setPendingSelection({
      messageId: message.id,
      text: selectedText,
      selectionStart: charsBefore,
      selectionEnd: charsBefore + selectedText.length,
    });
    pendingSelectionRef.current = {
      messageId: message.id,
      text: selectedText,
      selectionStart: charsBefore,
      selectionEnd: charsBefore + selectedText.length,
    };
  }, [highlightPickerOpen, isUser, message.id]);

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
      className={`group transition-all duration-300 ${
        isFlashed ? "scale-[1.01]" : ""
      }`}
    >
      <div className={`flex items-start gap-3 ${isUser ? "flex-row-reverse" : ""}`}>
        {/* Avatar */}
        <div
          className={`shrink-0 flex h-7 w-7 items-center justify-center rounded-full ${
            isUser
              ? "bg-stone-300 dark:bg-stone-600"
              : "bg-stone-200 dark:bg-stone-700"
          }`}
        >
          {isUser ? (
            <span className="text-[10px] font-medium text-stone-700 dark:text-stone-200">Y</span>
          ) : (
            <Sparkles className="h-3.5 w-3.5 text-stone-500 dark:text-stone-400" />
          )}
        </div>

        {/* Content */}
        <div className={`flex-1 min-w-0 ${isUser ? "items-end" : ""}`}>
          <div className="mb-1 flex items-center gap-2">
            <span className="text-sm font-medium text-stone-700 dark:text-stone-300">
              {isUser ? "You" : "SecondBrain"}
            </span>
            {message.imageUrl && (
              <span className="inline-flex items-center gap-1 rounded-full bg-stone-100 px-2 py-0.5 text-[10px] font-medium text-stone-500 dark:bg-stone-800 dark:text-stone-400">
                <ImagePlus className="h-3 w-3" />
                Image attached
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
                {formatRelativeTime(message.createdAt)}
              </span>
            )}
          </div>

          {/* Message content */}
          <div
            id={`msg-content-${message.id}`}
            className={`relative rounded-2xl px-4 py-3 ${
              isUser
                ? "bg-stone-800 text-stone-100 dark:bg-stone-700"
                : "border border-stone-200 bg-white dark:border-stone-700 dark:bg-stone-800"
            } ${highlightPickerOpen && !isUser ? "ring-2 ring-stone-400 dark:ring-stone-500" : ""}`}
            onMouseUp={handleTextSelection}
          >
            {message.imageUrl && (
              <img
                src={message.imageUrl}
                alt="Attached"
                className="mb-2 max-h-48 rounded-lg border border-stone-200 object-contain dark:border-stone-700"
              />
            )}
            <p className="whitespace-pre-wrap text-sm leading-relaxed">
              <HighlightedText
                content={message.content ?? ""}
                highlightColor={message.highlightColor}
                selectionStart={message.selectionStart}
                selectionEnd={message.selectionEnd}
              />
            </p>
          </div>

          {/* Citations */}
          {!isUser && Array.isArray(message.citations) && message.citations.length > 0 && (
            <div className="mt-1.5">
              <div className="rounded-lg border border-stone-200 bg-stone-50 p-2 dark:border-stone-700 dark:bg-stone-800/50">
                {message.citations.slice(0, 3).map((citation) => (
                  <div
                    key={citation.index}
                    className="mb-0.5 flex items-center gap-1.5"
                  >
                    <span className="flex h-4 w-4 items-center justify-center rounded-full bg-stone-200 text-[9px] font-bold text-stone-600 dark:bg-stone-700 dark:text-stone-300">
                      {citation.index}
                    </span>
                    <span className="text-[10px] text-stone-500 dark:text-stone-500">
                      {(citation.snippet ?? "").slice(0, 40)}...
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Action buttons */}
          {!isUser ? (
            <MessageActions
              message={message}
              highlightPickerOpen={highlightPickerOpen}
              onHighlightPickerToggle={onHighlightPickerToggle}
              onHighlight={onHighlight}
              onCopy={onCopy}
              onToggleNote={onToggleNote}
              onDeleteMessage={onDeleteMessage}
              copiedMessageId={copiedMessageId}
              isSaved={isSaved}
            />
          ) : (
            /* User message actions: Copy + Delete */
            <div className="mt-2 ml-1 flex items-center justify-end gap-1.5">
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
    </div>
  );
});

// ─── Typing indicator ───────────────────────────────────────────
const TypingIndicator = memo(function TypingIndicator() {
  return (
    <div className="flex items-start gap-3">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-stone-200 dark:bg-stone-700">
        <Sparkles className="h-3.5 w-3.5 text-stone-500 dark:text-stone-400" />
      </div>
      <div className="rounded-2xl border border-stone-200 bg-white px-5 py-4 dark:border-stone-700 dark:bg-stone-800">
        <div className="flex items-center gap-1.5">
          <div className="h-2 w-2 animate-bounce rounded-full bg-stone-400 [animation-delay:-0.3s]" />
          <div className="h-2 w-2 animate-bounce rounded-full bg-stone-400 [animation-delay:-0.15s]" />
          <div className="h-2 w-2 animate-bounce rounded-full bg-stone-400" />
        </div>
      </div>
    </div>
  );
});

// ─── Main component ─────────────────────────────────────────────
export function ChatWorkspace({
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
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [sending, setSending] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [showJumpToLatest, setShowJumpToLatest] = useState(false);
  const [flashedMessageId, setFlashedMessageId] = useState<string | null>(
    null,
  );
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);

  // Per-message highlight: which message has its color picker open
  const [highlightPickerMessageId, setHighlightPickerMessageId] =
    useState<string | null>(null);

  // Pending text selection waiting for a color to be picked
  const pendingSelectionRef = useRef<{
    messageId: string;
    text: string;
    selectionStart: number;
    selectionEnd: number;
  } | null>(null);
  const [pendingSelection, setPendingSelection] = useState<{
    messageId: string;
    text: string;
    selectionStart: number;
    selectionEnd: number;
  } | null>(null);

  // Resizable layout state
  const [sidebarWidth, setSidebarWidth] = useState(256);
  const [inputAreaHeight, setInputAreaHeight] = useState<number | null>(null);

  // ── Refs ─────────────────────────────────────────────────────
  const router = useRouter();
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const messageRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const flashTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isLoadingRef = useRef(false);
  const loadedSessionRef = useRef<string | null>(
    initialMessages && initialSessionId ? initialSessionId : null,
  );

  // ── Derived state ────────────────────────────────────────────
  const currentDocumentId = initialDocumentId;

  // ── Sessions (for pinned chat feature) ──────────────────────────
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
      if (imagePreview) URL.revokeObjectURL(imagePreview);
    };
  }, [imagePreview]);

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

  const scrollToMessage = useCallback((messageId: string) => {
    const container = scrollContainerRef.current;
    const element = messageRefs.current[messageId];
    if (!container || !element) return;
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

  const startInputResize = useCallback((e: React.MouseEvent) => {
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
  }, [updateScrollState]);

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

  // ── Delete message ────────────────────────────────────────────
  const handleDeleteMessage = useCallback(
    async (messageId: string) => {
      setMessages((prev) => prev.filter((m) => m.id !== messageId));
      setNotes((prev) => prev.filter((n) => n.messageId !== messageId));
      toast.success("Message deleted");
    },
    [],
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

      if (!res.ok || !payload?.success) {
        throw new Error(payload?.error || "Could not save annotation.");
      }
    },
    [currentSessionId],
  );

  // ── Toggle note ───────────────────────────────────────────────
  const handleToggleNote = useCallback(
    async (messageId: string) => {
      const existingNote = notes.find((n) => n.messageId === messageId);
      const msg = messages.find((m) => m.id === messageId);
      const noteContent = msg?.content ?? null;

      if (existingNote) {
        if (currentSessionId) {
          try {
            await fetch("/api/annotations", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ messageId, sessionId: currentSessionId }),
            });
          } catch {
            // best-effort
          }
        }
        setNotes((prev) => prev.filter((n) => n.messageId !== messageId));
        toast.success("Note removed");
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
      if (!note || !currentSessionId) return;

      const pinnedNow = !note.isPinned;
      if (pinnedNow && pinnedCount >= 3) {
        toast.error("Maximum 3 pinned notes allowed");
        return;
      }

      const msg = messages.find((m) => m.id === note.messageId);

      // Optimistic update
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
        // Revert on failure
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

  // ── Apply highlight with text selection ───────────────────────
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

  // ── Build notes from annotations ──────────────────────────────
  const buildNotesFromAnnotations = useCallback(
    (annotations: PersistedAnnotation[]): SavedNote[] =>
      annotations.map((a) => ({
        id: a.id,
        messageId: a.message_id,
        isPinned: a.is_pinned ?? false,
      })),
    [],
  );

  // ── Load session messages ─────────────────────────────────────
  useEffect(() => {
    if (initialMessages && initialMessages.length > 0) {
      // SSR already loaded — track it so we don't re-fetch
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
            return {
              id: msg.id,
              role: msg.role,
              content: msg.content,
              imageUrl: msg.image_url ?? null,
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

          const newNotes = buildNotesFromAnnotations(data.annotations ?? []);

          setMessages(newMessages);
          setNotes(newNotes);
          loadedSessionRef.current = currentSessionId;

          requestAnimationFrame(() => scrollToLatest("auto"));
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
  }, [currentSessionId, buildNotesFromAnnotations, scrollToLatest]);

  // ── Image handling ─────────────────────────────────────────────
  const handleImageSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      setSelectedImage(file);
      setImagePreview(URL.createObjectURL(file));
      e.target.value = "";
    },
    [],
  );

  const removeSelectedImage = useCallback(() => {
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setSelectedImage(null);
    setImagePreview(null);
  }, [imagePreview]);

  // ── Submit ────────────────────────────────────────────────────
  const handleSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const trimmed = input.trim();
      if (!trimmed && !selectedImage) return;
      if (!currentDocumentId) return;

      let imageUrl: string | undefined;

      if (selectedImage) {
        setUploadingImage(true);
        try {
          const formData = new FormData();
          formData.append("file", selectedImage);
          const res = await fetch("/api/chat-images", {
            method: "POST",
            body: formData,
          });
          const data = await res.json();
          if (!res.ok || !data.url) {
            throw new Error(data.error || "Upload failed");
          }
          imageUrl = data.url;
        } catch (error) {
          toast.error(
            error instanceof Error ? error.message : "Upload failed",
          );
          setUploadingImage(false);
          return;
        } finally {
          setUploadingImage(false);
        }
      }

      const userMessage: ChatMessage = {
        id: createMessageId(),
        role: "user",
        content: trimmed,
        imageUrl: imageUrl ?? null,
        createdAt: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, userMessage]);
      setInput("");
      setSelectedImage(null);
      if (imagePreview) URL.revokeObjectURL(imagePreview);
      setImagePreview(null);
      setSending(true);
      setHighlightPickerMessageId(null);
      setPendingSelection(null);

      requestAnimationFrame(() => scrollToLatest());

      try {
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            documentId: currentDocumentId,
            message: trimmed,
            imageUrl,
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

        if (payload.reused) {
          toast.success("Reused a previous exact answer.");
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error
            ? error.message
            : "Could not get an answer.";
        setMessages((prev) => [
          ...prev,
          {
            id: createMessageId(),
            role: "assistant",
            content: errorMessage,
            highlightColor: null,
            selectionStart: null,
            selectionEnd: null,
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
      selectedImage,
      imagePreview,
      scrollToLatest,
      router,
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

  // ── Highlight picker toggle ────────────────────────────────────
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

  // ── Render ────────────────────────────────────────────────────
  return (
    <div className="flex h-full min-h-0">
      {/* ── Sidebar ───────────────────────────────────────────── */}
      <aside
        style={{ width: sidebarWidth }}
        className="relative shrink-0 border-r border-stone-200 bg-stone-50 dark:border-stone-800 dark:bg-stone-900"
      >
        {/* Horizontal resize handle */}
        <div
          onMouseDown={startSidebarResize}
          className="absolute right-0 top-0 bottom-0 z-10 w-1 cursor-col-resize opacity-0 hover:opacity-100 transition-opacity"
        >
          <div className="ml-[-1px] h-full w-0.5 bg-stone-300 dark:bg-stone-600" />
        </div>

        <div className="flex h-full flex-col overflow-hidden">
          {/* New chat */}
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

          {/* Scrollable content */}
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

            {/* Pinned notes — BELOW documents, above sessions */}
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

            {/* Sessions — pinned first */}
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

            {/* Notes section — unpinned only (pinned shown above) */}
            {unpinnedNotes.length > 0 && (
              <div className="border-t border-stone-200 p-3 dark:border-stone-800">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-medium uppercase tracking-wider text-stone-500 dark:text-stone-400">
                    Saved Notes ({notes.length})
                  </span>
                </div>
                <div className="space-y-1">
                  {unpinnedNotes.map((note) => {
                    const message = messages.find(
                      (m) => m.id === note.messageId,
                    );
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
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-stone-200 bg-stone-50 px-4 dark:border-stone-800 dark:bg-stone-900">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-stone-200 dark:bg-stone-700">
              <MessageSquare className="h-4 w-4 text-stone-500 dark:text-stone-400" />
            </div>
            <div>
              <h1 className="text-sm font-medium text-stone-900 dark:text-white">
                {selectedDocument ? "Chat" : "No Document Selected"}
              </h1>
              {selectedDocument && (
                <p className="text-xs text-stone-500 dark:text-stone-400">
                  {selectedDocument.filename}
                </p>
              )}
            </div>
          </div>

          <div className="ml-3 flex items-center gap-1.5">
            <span className="text-xs text-stone-400 dark:text-stone-500">
              Chatting with:
            </span>
            <select
              value={currentDocumentId ?? ""}
              onChange={(e) => handleDocumentChange(e.target.value)}
              className="appearance-none cursor-pointer rounded-md border border-stone-200 bg-stone-50 px-2 py-1 text-xs font-medium text-stone-600 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-400"
            >
              {documents.map((doc) => (
                <option key={doc.id} value={doc.id}>
                  {doc.filename}
                </option>
              ))}
            </select>
          </div>
        </header>

        {/* Messages */}
        <div
          ref={scrollContainerRef}
          onScroll={updateScrollState}
          className="flex-1 overflow-y-auto p-6"
        >
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
              <p className="mb-4 max-w-md text-sm text-stone-500 dark:text-stone-400">
                Ask anything about{" "}
                <span className="font-medium text-stone-600 dark:text-stone-300">
                  {selectedDocument?.filename ?? "your document"}
                </span>
              </p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  "Summarize this document",
                  "What are the key points?",
                  "Explain in simple terms",
                  "Find specific details",
                ].map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => setInput(suggestion)}
                    className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-left text-xs text-stone-600 transition-all hover:border-stone-300 hover:bg-stone-100 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-400 dark:hover:border-stone-600 dark:hover:bg-stone-700"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              {messages.map((message) => (
                <MessageBubble
                  key={message.id}
                  message={message}
                  isSaved={noteIdsMap.has(message.id)}
                  flashedMessageId={flashedMessageId}
                  copiedMessageId={copiedMessageId}
                  highlightPickerOpen={
                    highlightPickerMessageId === message.id
                  }
                  onHighlightPickerToggle={handleHighlightPickerToggle}
                  onHighlight={handleHighlight}
                  onCopy={copyToClipboard}
                  onToggleNote={handleToggleNote}
                  onDeleteMessage={handleDeleteMessage}
                  onFlash={handleFlash}
                  onRef={(el) => {
                    messageRefs.current[message.id] = el;
                  }}
                />
              ))}

              {sending && <TypingIndicator />}
            </div>
          )}
        </div>

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

        {/* Vertical resize handle between messages and input */}
        <div
          onMouseDown={startInputResize}
          className="group h-2 shrink-0 cursor-row-resize flex items-center justify-center bg-stone-100 hover:bg-stone-200 dark:bg-stone-900 dark:hover:bg-stone-800 transition-colors"
        >
          <div className="h-0.5 w-8 rounded-full bg-stone-300 dark:bg-stone-600 group-hover:bg-stone-400 dark:group-hover:bg-stone-500 transition-colors" />
        </div>

        {/* Input */}
        <div
          style={
            inputAreaHeight
              ? { height: `${inputAreaHeight}px`, flexShrink: 0 }
              : undefined
          }
          className="shrink-0 border-t border-stone-200 bg-stone-100/80 p-3 dark:border-stone-800 dark:bg-stone-900/80"
        >
          <form onSubmit={handleSubmit} className="flex flex-col gap-2">
            {/* Image preview */}
            {imagePreview && (
              <div className="flex items-center gap-2.5 rounded-lg border border-stone-200 bg-stone-50 p-2 dark:border-stone-700 dark:bg-stone-800">
                <div className="relative shrink-0">
                  <img
                    src={imagePreview}
                    alt="Preview"
                    className="h-10 w-10 rounded-md border border-stone-200 object-cover dark:border-stone-700"
                  />
                  {uploadingImage && (
                    <div className="absolute inset-0 flex items-center justify-center rounded-md bg-black/50">
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-white" />
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium text-stone-600 dark:text-stone-200">
                    {selectedImage?.name}
                  </p>
                  <p className="text-[10px] text-stone-400">
                    {selectedImage &&
                      (selectedImage.size / 1024).toFixed(1)}{" "}
                    KB
                    {uploadingImage && " • Uploading..."}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={removeSelectedImage}
                  disabled={uploadingImage}
                  className="shrink-0 rounded p-1 text-stone-400 transition-all hover:bg-stone-100 hover:text-stone-600 disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-stone-700"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )}

            <div className="flex items-center gap-2">
              {/* Image attachment */}
              <label
                data-testid="image-upload-label"
                className={`flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-stone-200 bg-stone-50 text-stone-400 transition-all hover:border-stone-300 hover:bg-stone-100 hover:text-stone-600 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-400 dark:hover:border-stone-600 dark:hover:bg-stone-700 ${
                  !selectedDocument || sending
                    ? "opacity-50 cursor-not-allowed"
                    : ""
                }`}
              >
                <input
                  data-testid="image-upload-input"
                  type="file"
                  accept="image/jpeg,image/png,image/gif,image/webp"
                  onChange={handleImageSelect}
                  disabled={!selectedDocument || sending}
                  className="hidden"
                />
                <ImagePlus className="h-4 w-4" />
              </label>

              {/* Text input */}
              <input
                data-testid="chat-input"
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={
                  selectedDocument
                    ? `Ask about ${selectedDocument.filename}...`
                    : "Select a document to start..."
                }
                disabled={!selectedDocument || sending}
                className="flex-1 rounded-lg border border-stone-200 bg-white px-4 py-2 text-sm text-stone-900 placeholder:text-stone-400 focus:border-stone-400 focus:outline-none focus:ring-2 focus:ring-stone-200 disabled:cursor-not-allowed disabled:bg-stone-100 dark:border-stone-700 dark:bg-stone-800 dark:text-white dark:placeholder:text-stone-500 dark:focus:border-stone-600 dark:focus:ring-stone-700"
              />

              {/* Send */}
              <button
                type="submit"
                disabled={
                  (!input.trim() && !selectedImage) ||
                  !selectedDocument ||
                  sending
                }
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-stone-900 text-white transition-all hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-stone-700 dark:hover:bg-stone-600"
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
