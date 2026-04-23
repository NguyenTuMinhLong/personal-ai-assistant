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
  Plus,
  SendHorizonal,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

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
};

type SavedNote = {
  id: string;
  messageId: string;
};

type PersistedAnnotation = {
  id: string;
  message_id: string;
  highlight_color: string | null;
  selection_start: number | null;
  selection_end: number | null;
};

type ChatWorkspaceProps = {
  documents: StoredDocument[];
  initialDocumentId: string | null;
  initialSessionId: string | null;
};

const HIGHLIGHT_COLORS: Array<{ color: HighlightColor; label: string }> = [
  { color: "rose", label: "Rose" },
  { color: "amber", label: "Amber" },
  { color: "emerald", label: "Emerald" },
  { color: "sky", label: "Sky" },
  { color: "violet", label: "Violet" },
];

function createMessageId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

// Extract message action buttons to prevent re-renders
interface MessageActionsProps {
  message: ChatMessage;
  highlightMode: boolean;
  onHighlightModeChange: (value: boolean) => void;
  onHighlight: (messageId: string, color: HighlightColor) => Promise<void>;
  onCopy: (content: string, messageId: string) => void;
  onToggleNote: (messageId: string) => Promise<void>;
  copiedMessageId: string | null;
  isSaved: boolean;
  hasSelectedExcerpt: boolean;
}

const MessageActions = memo(function MessageActions({
  message,
  highlightMode,
  onHighlightModeChange,
  onHighlight,
  onCopy,
  onToggleNote,
  copiedMessageId,
  isSaved,
  hasSelectedExcerpt,
}: MessageActionsProps) {
  const isCopied = copiedMessageId === message.id;

  return (
    <>
      {/* Highlight mode toggle */}
      <button
        onClick={() => onHighlightModeChange(!highlightMode)}
        className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[10px] font-medium transition-all ${
          highlightMode
            ? "border-stone-400 bg-stone-100 text-stone-700 dark:border-stone-500 dark:bg-stone-700 dark:text-stone-200"
            : "border-stone-200 bg-white text-stone-500 hover:border-stone-300 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-400 dark:hover:border-stone-600"
        }`}
        title="Highlight mode"
      >
        <div className="flex h-2.5 w-2.5 items-center justify-center">
          <div className={`h-1.5 w-1.5 rounded-full ${highlightMode ? "bg-stone-600 dark:bg-stone-300 animate-pulse" : "bg-stone-400"}`} />
        </div>
        {highlightMode ? "Selecting..." : "Highlight"}
      </button>

      {/* Highlight colors */}
      {highlightMode && (
        <div className="flex items-center gap-0.5 rounded-md border border-stone-200 bg-white p-1 dark:border-stone-700 dark:bg-stone-800">
          {HIGHLIGHT_COLORS.map((h) => {
            const isActive = message.highlightColor === h.color;
            return (
              <button
                key={h.color}
                type="button"
                onClick={() => onHighlight(message.id, h.color)}
                className={`h-5 w-5 rounded-full border transition-all ${
                  isActive
                    ? "scale-110 border-stone-900 dark:border-white shadow-sm"
                    : "border-white/70 hover:scale-105"
                }`}
                style={{
                  backgroundColor:
                    h.color === "rose"
                      ? "#fda4af"
                      : h.color === "amber"
                        ? "#d6d3d1"
                        : h.color === "emerald"
                          ? "#6ee7b7"
                          : h.color === "sky"
                            ? "#7dd3fc"
                            : "#e9d5ff",
                }}
                title={h.label}
              />
            );
          })}
        </div>
      )}

      {/* Copy button */}
      <button
        onClick={() => onCopy(message.content, message.id)}
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
        type="button"
        onClick={() => onToggleNote(message.id)}
        className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[10px] font-medium transition-all ${
          isSaved
            ? "border-stone-400 bg-stone-100 text-stone-700 dark:border-stone-500 dark:bg-stone-700 dark:text-stone-200"
            : "border-stone-200 bg-white text-stone-500 hover:border-stone-300 hover:text-stone-700 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-400 dark:hover:border-stone-600"
        }`}
      >
        <BookmarkPlus className="h-3 w-3" />
        {isSaved ? "Saved" : hasSelectedExcerpt ? "Save selection" : "Save note"}
      </button>

      {hasSelectedExcerpt && (
        <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[10px] font-medium text-stone-500 dark:bg-stone-800 dark:text-stone-400">
          Selection ready
        </span>
      )}
    </>
  );
});

// Single message component - memoized to prevent re-renders
interface MessageBubbleProps {
  message: ChatMessage;
  flashedMessageId: string | null;
  copiedMessageId: string | null;
  highlightMode: boolean;
  selectedExcerpt: { messageId: string; text: string } | null;
  onHighlightModeChange: (value: boolean) => void;
  onHighlight: (messageId: string, color: HighlightColor) => Promise<void>;
  onCopy: (content: string, messageId: string) => void;
  onToggleNote: (messageId: string) => Promise<void>;
  onSelectExcerpt: (messageId: string, text: string) => void;
  onDeleteMessage: (messageId: string) => void;
  onFlash: (messageId: string) => void;
}

const MessageBubble = memo(function MessageBubble({
  message,
  flashedMessageId,
  copiedMessageId,
  highlightMode,
  selectedExcerpt,
  onHighlightModeChange,
  onHighlight,
  onCopy,
  onToggleNote,
  onSelectExcerpt,
  onDeleteMessage,
  onFlash,
}: MessageBubbleProps) {
  const isUser = message.role === "user";
  const isFlashed = flashedMessageId === message.id;
  const hasSelectedExcerpt =
    selectedExcerpt?.messageId === message.id &&
    selectedExcerpt.text.length > 0;

  const handleTextSelection = useCallback(() => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || isUser) return;
    
    const selectedText = selection.toString().trim();
    if (selectedText.length > 0) {
      onSelectExcerpt(message.id, selectedText);
    }
  }, [message.id, isUser, onSelectExcerpt]);

  return (
    <div
      ref={(element) => {
        if (element && isFlashed) {
          onFlash(message.id);
        }
      }}
      className={`group transition-all duration-300 ${
        isFlashed ? "scale-[1.01]" : ""
      }`}
    >
      {/* Message bubble - user on right, assistant on left */}
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
            {isUser && !isUser && (
              <button
                type="button"
                onClick={() => onDeleteMessage(message.id)}
                className="ml-auto rounded p-0.5 text-stone-400 opacity-0 transition-all hover:bg-stone-100 hover:text-stone-600 group-hover:opacity-100 dark:hover:bg-stone-700"
                title="Delete message"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            )}
          </div>

          {/* Message content */}
          <div
            className={`relative rounded-2xl px-4 py-3 ${
              isUser
                ? "bg-stone-800 text-stone-100 dark:bg-stone-700"
                : "border border-stone-200 bg-white dark:border-stone-700 dark:bg-stone-800"
            } ${highlightMode && !isUser ? "cursor-text" : ""}`}
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
              {message.content}
            </p>
          </div>

          {/* Citations */}
          {!isUser && message.citations && message.citations.length > 0 && (
            <div className="mt-1.5">
              <div className="rounded-lg border border-stone-200 bg-stone-50 p-2 dark:border-stone-700 dark:bg-stone-800/50">
                {(() => {
                  const safe = Array.isArray(message.citations) ? message.citations.slice(0, 3) : [];
                  if (process.env.NODE_ENV === "development") {
                    console.log("[citations debug]", { citations: message.citations, isArray: Array.isArray(message.citations), safe });
                  }
                  return safe.map((citation, _ci) => {
                    if (process.env.NODE_ENV === "development") {
                      console.log("[citation debug]", { citation, type: typeof citation, snippetVal: citation?.snippet });
                    }
                    return (
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
                    );
                  });
                })()}
              </div>
            </div>
          )}

          {/* Action buttons */}
          {!isUser && (
            <div className="mt-2 ml-1 flex items-center gap-1.5">
              <MessageActions
                message={message}
                highlightMode={highlightMode}
                onHighlightModeChange={onHighlightModeChange}
                onHighlight={onHighlight}
                onCopy={onCopy}
                onToggleNote={onToggleNote}
                copiedMessageId={copiedMessageId}
                isSaved={false}
                hasSelectedExcerpt={hasSelectedExcerpt}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

// Typing indicator component
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

export function ChatWorkspace({
  documents,
  initialDocumentId,
  initialSessionId,
}: ChatWorkspaceProps) {
  // Track current session ID - starts from props but can be updated
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(initialSessionId);
  
  // Only keep messages and notes in local state - use props as source of truth
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [notes, setNotes] = useState<SavedNote[]>([]);
  const [input, setInput] = useState("");
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [sending, setSending] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [showJumpToLatest, setShowJumpToLatest] = useState(false);
  const [selectedExcerpt, setSelectedExcerpt] = useState<{ messageId: string; text: string } | null>(null);
  const [flashedMessageId, setFlashedMessageId] = useState<string | null>(null);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [highlightMode, setHighlightMode] = useState(false);
  const [noteIds, setNoteIds] = useState<Set<string>>(new Set());

  const router = useRouter();
  
  // Refs for refs and flags
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const messageRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const contentRefs = useRef<Record<string, HTMLParagraphElement | null>>({});
  const flashTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isLoadingRef = useRef(false);
  const loadedSessionRef = useRef<string | null>(null);

  // Sync with URL params when they change
  useEffect(() => {
    // When URL session changes, reset loading state so load effect can trigger
    if (loadedSessionRef.current !== initialSessionId) {
      isLoadingRef.current = false;
    }
  }, [initialSessionId]);

  // Use props directly as source of truth for document
  const currentDocumentId = initialDocumentId;

  // Memoize notes lookup map for O(1) access
  const noteIdsMap = useMemo(() => {
    return new Set(notes.map((note) => note.messageId));
  }, [notes]);

  const selectedDocument = useMemo(
    () => documents.find((doc) => doc.id === currentDocumentId) ?? null,
    [documents, currentDocumentId],
  );

  const updateScrollState = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const distanceFromBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight;
    const nearBottom = distanceFromBottom < 120;

    setShowJumpToLatest(!nearBottom);
  }, []);

  const scrollToLatest = useCallback((behavior: ScrollBehavior = "smooth") => {
    const container = scrollContainerRef.current;
    if (!container) return;

    container.scrollTo({
      top: container.scrollHeight,
      behavior,
    });
  }, []);

  // Handle text selection for excerpts
  const handleSelectExcerpt = useCallback((messageId: string, text: string) => {
    setSelectedExcerpt({ messageId, text });
    toast.info("Selection saved! Click 'Save selection' to save as a note.");
  }, []);

  // Flash animation for new messages
  const handleFlash = useCallback((messageId: string) => {
    setFlashedMessageId(messageId);
    if (flashTimeoutRef.current) {
      clearTimeout(flashTimeoutRef.current);
    }
    flashTimeoutRef.current = setTimeout(() => {
      setFlashedMessageId(null);
    }, 500);
  }, []);

  // Copy to clipboard
  const copyToClipboard = useCallback((content: string, messageId: string) => {
    navigator.clipboard.writeText(content);
    setCopiedMessageId(messageId);
    setTimeout(() => setCopiedMessageId(null), 2000);
  }, []);

  // Delete message
  const handleDeleteMessage = useCallback(async (messageId: string) => {
    setMessages((prev) => prev.filter((m) => m.id !== messageId));
    setNotes((prev) => prev.filter((n) => n.messageId !== messageId));
    toast.success("Message deleted");
  }, []);

  // Save annotation
  const handleSaveAnnotation = useCallback(
    async (messageId: string, highlightColor: HighlightColor | null) => {
      const res = await fetch("/api/annotations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messageId,
          sessionId: initialSessionId,
          highlightColor,
          selectionStart: selectedExcerpt?.messageId === messageId ? 0 : null,
          selectionEnd: selectedExcerpt?.messageId === messageId ? 100 : null,
        }),
      });
      const payload = (await res.json()) as
        | { success: true }
        | { success: false; error: string } | null;

      if (!res.ok || !payload?.success) {
        throw new Error(payload?.error || "Could not save annotation.");
      }
    },
    [initialSessionId, selectedExcerpt],
  );

  // Handle highlight message
  const handleHighlightMessage = useCallback(
    async (messageId: string, highlightColor: HighlightColor) => {
      await handleSaveAnnotation(messageId, highlightColor);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId ? { ...m, highlightColor } : m,
        ),
      );
      setHighlightMode(false);
      toast.success("Highlight saved!");
    },
    [handleSaveAnnotation],
  );

  // Toggle note
  const handleToggleNote = useCallback(
    async (messageId: string) => {
      const message = messages.find((m) => m.id === messageId);
      if (!message) return;

      const existingNote = notes.find((n) => n.messageId === messageId);
      if (existingNote) {
        setNotes((prev) => prev.filter((n) => n.messageId !== messageId));
        toast.success("Note removed");
      } else {
        await handleSaveAnnotation(messageId, null);
        const newNote: SavedNote = { id: createMessageId(), messageId };
        setNotes((prev) => [...prev, newNote]);
        handleFlash(messageId);
        toast.success("Note saved!");
      }
    },
    [messages, notes, handleSaveAnnotation, handleFlash],
  );

  // Build notes from annotations
  const buildNotesFromAnnotations = useCallback((annotations: PersistedAnnotation[]): SavedNote[] => {
    return annotations.map((a) => ({
      id: a.id,
      messageId: a.message_id,
    }));
  }, []);

  // Load session messages when session changes
  useEffect(() => {
    // No session = no messages to load
    if (!currentSessionId) {
      setMessages([]);
      setNotes([]);
      setLoadingHistory(false);
      return;
    }

    // Skip if already loading this session
    if (isLoadingRef.current) {
      return;
    }

    // Skip if we've already loaded messages for this session
    if (loadedSessionRef.current === currentSessionId) {
      return;
    }

    isLoadingRef.current = true;
    setLoadingHistory(true);

    fetch(`/api/sessions/${currentSessionId}/messages`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load");
        return res.json();
      })
      .then((data: {
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
        }>;
        annotations: PersistedAnnotation[];
      }) => {
        const annotationMap = new Map(
          (data.annotations ?? []).map((annotation) => [
            annotation.message_id,
            annotation,
          ]),
        );

        const newMessages: ChatMessage[] = data.messages.map((message) => {
          const annotation = annotationMap.get(message.id);
          return {
            id: message.id,
            role: message.role,
            content: message.content,
            imageUrl: message.image_url ?? null,
            citations: message.citations?.map((citation, index) => ({
              index: index + 1,
              snippet: citation.content_preview ?? "",
            })),
            highlightColor: annotation?.highlight_color as HighlightColor ?? null,
            selectionStart: annotation?.selection_start ?? null,
            selectionEnd: annotation?.selection_end ?? null,
          };
        });

        setMessages(newMessages);
        setNotes(buildNotesFromAnnotations(data.annotations ?? []));
        loadedSessionRef.current = currentSessionId;

        // Use setTimeout to ensure DOM has rendered
        setTimeout(() => scrollToLatest("auto"), 100);
      })
      .catch((error) => {
        console.error("Failed to load chat history:", error);
        toast.error("Failed to load chat history");
      })
      .finally(() => {
        setLoadingHistory(false);
        isLoadingRef.current = false;
      });
  }, [currentSessionId, buildNotesFromAnnotations, scrollToLatest]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (flashTimeoutRef.current) clearTimeout(flashTimeoutRef.current);
      if (imagePreview) URL.revokeObjectURL(imagePreview);
    };
  }, [imagePreview]);

  // Handle image selection
  const handleImageSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedImage(file);
    setImagePreview(URL.createObjectURL(file));
    e.target.value = "";
  }, []);

  // Remove selected image
  const removeSelectedImage = useCallback(() => {
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setSelectedImage(null);
    setImagePreview(null);
  }, [imagePreview]);

  // Handle submit
  const handleSubmit = useCallback(async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = input.trim();
    if (!trimmed && !selectedImage) return;
    if (!currentDocumentId) return;

    let imageUrl: string | undefined;

    // Upload image if present
    if (selectedImage) {
      setUploadingImage(true);
      try {
        const formData = new FormData();
        formData.append("file", selectedImage);
        const res = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        });
        const data = await res.json();
        if (!res.ok || !data.url) {
          throw new Error(data.error || "Upload failed");
        }
        imageUrl = data.url;
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Upload failed");
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
    };

    // Clear input and image
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setSelectedImage(null);
    if (imagePreview) {
      URL.revokeObjectURL(imagePreview);
    }
    setImagePreview(null);
    setSending(true);
    setHighlightMode(false);
    setSelectedExcerpt(null);

    // Scroll to bottom
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
      const assistantMessageId = payload.assistantMessageId ?? createMessageId();

      // Add messages together to prevent double render
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
        },
      ]);

      // Update URL with session ID if new
      if (payload.sessionId && payload.sessionId !== currentSessionId) {
        setCurrentSessionId(payload.sessionId);
        router.replace(`/chat?documentId=${currentDocumentId}&sessionId=${payload.sessionId}`);
      }

      // Scroll after message appears
      requestAnimationFrame(() => scrollToLatest());

      if (payload.reused) {
        toast.success("Reused a previous exact answer.");
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Could not get an answer.";
      setMessages((prev) => [
        ...prev,
        { id: createMessageId(), role: "assistant", content: errorMessage },
      ]);
      requestAnimationFrame(() => scrollToLatest());
    } finally {
      setSending(false);
    }
  }, [input, currentDocumentId, currentSessionId, selectedImage, imagePreview, scrollToLatest, router]);

  // Handle new chat
  const handleNewChat = useCallback(() => {
    if (currentDocumentId) {
      router.push(`/chat?documentId=${currentDocumentId}`);
    }
  }, [currentDocumentId, router]);

  // Handle document change
  const handleDocumentChange = useCallback((newDocId: string) => {
    router.push(`/chat?documentId=${newDocId}`);
  }, [router]);

  return (
    <div className="flex h-full min-h-0">
      {/* Sidebar - Sessions */}
      <aside className="w-64 shrink-0 border-r border-stone-200 bg-stone-50 dark:border-stone-800 dark:bg-stone-900">
        <div className="flex h-full flex-col">
          {/* New chat button */}
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

          {/* Document list */}
          <div className="flex-1 overflow-y-auto p-3">
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

          {/* Notes section */}
          {notes.length > 0 && (
            <div className="border-t border-stone-200 p-3 dark:border-stone-800">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-medium uppercase tracking-wider text-stone-500 dark:text-stone-400">
                  Saved Notes ({notes.length})
                </span>
              </div>
              <div className="space-y-1">
                {notes.slice(0, 5).map((note) => {
                  const message = messages.find((m) => m.id === note.messageId);
                  if (!message) return null;
                  return (
                    <button
                      key={note.id}
                      type="button"
                      onClick={() => {
                        const element = messageRefs.current[note.messageId];
                        if (element) {
                          element.scrollIntoView({ behavior: "smooth", block: "center" });
                          handleFlash(note.messageId);
                        }
                      }}
                      className="flex w-full items-center gap-2 rounded-lg bg-stone-100 px-3 py-2 text-left text-xs transition-all hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-700"
                    >
                      <BookmarkPlus className="h-3.5 w-3.5 shrink-0 text-stone-400" />
                      <span className="truncate text-stone-600 dark:text-stone-300">
                        {message.content.slice(0, 40)}...
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </aside>

      {/* Chat Area */}
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
          
          {/* Document selector */}
          <div className="ml-3 flex items-center gap-1.5">
            <span className="text-xs text-stone-400 dark:text-stone-500">Chatting with:</span>
            <select
              value={currentDocumentId ?? ""}
              onChange={(e) => handleDocumentChange(e.target.value)}
              className="appearance-none rounded-md border border-stone-200 bg-stone-50 px-2 py-1 text-xs font-medium text-stone-600 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-400 cursor-pointer"
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
                Ask anything about <span className="font-medium text-stone-600 dark:text-stone-300">{selectedDocument?.filename ?? "your document"}</span>
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
                  flashedMessageId={flashedMessageId}
                  copiedMessageId={copiedMessageId}
                  highlightMode={highlightMode}
                  selectedExcerpt={selectedExcerpt}
                  onHighlightModeChange={setHighlightMode}
                  onHighlight={handleHighlightMessage}
                  onCopy={copyToClipboard}
                  onToggleNote={handleToggleNote}
                  onSelectExcerpt={handleSelectExcerpt}
                  onDeleteMessage={handleDeleteMessage}
                  onFlash={handleFlash}
                />
              ))}

              {/* Typing indicator */}
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

        {/* Input */}
        <div className="shrink-0 border-t border-stone-200 bg-stone-100/80 p-3 dark:border-stone-800 dark:bg-stone-900/80">
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
                    {selectedImage && (selectedImage.size / 1024).toFixed(1)} KB
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
              {/* Image attachment button */}
              <label
                className={`flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-stone-200 bg-stone-50 text-stone-400 transition-all hover:border-stone-300 hover:bg-stone-100 hover:text-stone-600 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-400 dark:hover:border-stone-600 dark:hover:bg-stone-700 ${(!selectedDocument || sending) ? "opacity-50 cursor-not-allowed" : ""}`}
              >
                <input
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

              {/* Send button */}
              <button
                type="submit"
                disabled={(!input.trim() && !selectedImage) || !selectedDocument || sending}
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
