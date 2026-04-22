"use client";

import {
  FormEvent,
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
  content: string;
  highlightColor?: HighlightColor | null;
  selectionStart?: number | null;
  selectionEnd?: number | null;
};

type PersistedAnnotation = {
  id: string;
  message_id: string;
  note_content: string | null;
  highlight_color: HighlightColor | null;
  selection_start: number | null;
  selection_end: number | null;
};

type SelectedExcerpt = {
  messageId: string;
  text: string;
  start: number;
  end: number;
};

type ChatWorkspaceProps = {
  documents: StoredDocument[];
  initialDocumentId: string | null;
  initialSessionId: string | null;
};

const HIGHLIGHT_COLORS: Array<{ color: HighlightColor; bg: string; border: string }> = [
  { color: "rose", bg: "bg-rose-100 dark:bg-rose-500/20", border: "border-rose-300 dark:border-rose-400/30" },
  { color: "amber", bg: "bg-amber-100 dark:bg-amber-500/20", border: "border-amber-300 dark:border-amber-400/30" },
  { color: "emerald", bg: "bg-emerald-100 dark:bg-emerald-500/20", border: "border-emerald-300 dark:border-emerald-400/30" },
  { color: "sky", bg: "bg-sky-100 dark:bg-sky-500/20", border: "border-sky-300 dark:border-sky-400/30" },
  { color: "violet", bg: "bg-violet-100 dark:bg-violet-500/20", border: "border-violet-300 dark:border-violet-400/30" },
];

function createMessageId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `msg-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function getHighlightClasses(color?: HighlightColor | null, isUser = false) {
  if (isUser) {
    return "bg-gradient-to-r from-violet-600 to-violet-700 text-white border-transparent";
  }
  
  switch (color) {
    case "rose":
      return "bg-rose-50/80 dark:bg-rose-500/10 border-rose-200 dark:border-rose-400/30";
    case "amber":
      return "bg-amber-50/80 dark:bg-amber-500/10 border-amber-200 dark:border-amber-400/30";
    case "emerald":
      return "bg-emerald-50/80 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-400/30";
    case "sky":
      return "bg-sky-50/80 dark:bg-sky-500/10 border-sky-200 dark:border-sky-400/30";
    case "violet":
      return "bg-violet-50/80 dark:bg-violet-500/10 border-violet-200 dark:border-violet-400/30";
    default:
      return "bg-white/90 dark:bg-[#1e2130] border-gray-200/60 dark:border-gray-700/50";
  }
}

function buildNotesFromAnnotations(annotations: PersistedAnnotation[]) {
  return annotations
    .filter((annotation) => annotation.note_content)
    .map((annotation) => ({
      id: annotation.id,
      messageId: annotation.message_id,
      content: annotation.note_content ?? "",
      highlightColor: annotation.highlight_color,
      selectionStart: annotation.selection_start,
      selectionEnd: annotation.selection_end,
    }));
}

function renderMessageContent(message: ChatMessage) {
  const start = message.selectionStart ?? null;
  const end = message.selectionEnd ?? null;

  if (
    start === null ||
    end === null ||
    start < 0 ||
    end <= start ||
    end > message.content.length
  ) {
    return message.content;
  }

  const before = message.content.slice(0, start);
  const selected = message.content.slice(start, end);
  const after = message.content.slice(end);

  return (
    <>
      {before}
      <mark className="rounded bg-yellow-200/70 px-0.5 text-inherit dark:bg-yellow-500/30">
        {selected}
      </mark>
      {after}
    </>
  );
}

export function ChatWorkspace({
  documents,
  initialDocumentId,
  initialSessionId,
}: ChatWorkspaceProps) {
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
  const [selectedExcerpt, setSelectedExcerpt] = useState<SelectedExcerpt | null>(null);
  const [flashedMessageId, setFlashedMessageId] = useState<string | null>(null);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [highlightMode, setHighlightMode] = useState(false);

  // Refs for refs and flags
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const messageRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const contentRefs = useRef<Record<string, HTMLParagraphElement | null>>({});
  const flashTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isLoadingRef = useRef(false);
  const prevSessionRef = useRef<string | null>(null);

  // Use props directly as source of truth - no local state for doc/session
  const currentDocumentId = initialDocumentId;
  const currentSessionId = initialSessionId;

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

  const clearBrowserSelection = useCallback(() => {
    if (typeof window === "undefined") return;
    const selection = window.getSelection();
    if (selection) selection.removeAllRanges();
  }, []);

  const jumpToMessage = useCallback((messageId: string) => {
    const element = messageRefs.current[messageId];
    if (!element) return;

    element.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });

    setFlashedMessageId(messageId);
    if (flashTimeoutRef.current) clearTimeout(flashTimeoutRef.current);
    flashTimeoutRef.current = setTimeout(() => {
      setFlashedMessageId(null);
    }, 1800);
  }, []);

  const copyToClipboard = useCallback(async (text: string, messageId: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedMessageId(messageId);
      toast.success("Copied to clipboard");
      setTimeout(() => setCopiedMessageId(null), 2000);
    } catch {
      toast.error("Failed to copy");
    }
  }, []);

  const handleImageSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      toast.error("Unsupported format. Please use JPEG, PNG, GIF, or WebP.");
      event.target.value = "";
      return;
    }

    // Validate file size (10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast.error("File too large. Maximum size is 10MB.");
      event.target.value = "";
      return;
    }

    // Validate minimum size (detect corrupt files)
    if (file.size < 1000) {
      toast.error("This image appears to be invalid or corrupted.");
      event.target.value = "";
      return;
    }

    // Check for duplicate (compare by name and size)
    if (selectedImage && selectedImage.name === file.name && selectedImage.size === file.size) {
      toast.info("This image is already selected.");
      event.target.value = "";
      return;
    }

    // Clear previous image preview if exists
    if (imagePreview) {
      URL.revokeObjectURL(imagePreview);
    }

    setSelectedImage(file);
    setImagePreview(URL.createObjectURL(file));
    event.target.value = ""; // Reset input
  }, [selectedImage, imagePreview]);

  const removeSelectedImage = useCallback(() => {
    if (imagePreview) {
      URL.revokeObjectURL(imagePreview);
    }
    setSelectedImage(null);
    setImagePreview(null);
  }, [imagePreview]);

  const captureSelectedText = useCallback((messageId: string) => {
    if (!highlightMode) return;
    if (typeof window === "undefined") return;

    const selection = window.getSelection();
    const contentElement = contentRefs.current[messageId];
    const text = selection?.toString().trim() ?? "";

    if (!contentElement || !selection || selection.rangeCount === 0 || !text) {
      setSelectedExcerpt(null);
      return;
    }

    const range = selection.getRangeAt(0);
    const commonNode = range.commonAncestorContainer;

    if (!contentElement.contains(commonNode)) return;

    const prefixRange = range.cloneRange();
    prefixRange.selectNodeContents(contentElement);
    prefixRange.setEnd(range.startContainer, range.startOffset);

    const start = prefixRange.toString().length;
    const end = start + selection.toString().length;

    if (end <= start) {
      setSelectedExcerpt(null);
      return;
    }

    setSelectedExcerpt({ messageId, text, start, end });
  }, [highlightMode]);

  const persistAnnotation = useCallback(async (input: {
    messageId: string;
    noteContent: string | null;
    highlightColor: HighlightColor | null;
    selectionStart: number | null;
    selectionEnd: number | null;
  }) => {
    if (!currentSessionId) {
      toast.error("Session is not ready yet.");
      return;
    }

    const res = await fetch("/api/annotations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: currentSessionId,
        messageId: input.messageId,
        noteContent: input.noteContent,
        highlightColor: input.highlightColor,
        selectionStart: input.selectionStart,
        selectionEnd: input.selectionEnd,
      }),
    });

    const payload = (await res.json()) as {
      success?: boolean;
      error?: string;
    } | null;

    if (!res.ok || !payload?.success) {
      throw new Error(payload?.error || "Could not save annotation.");
    }
  }, [currentSessionId]);

  // Load session messages when session changes
  useEffect(() => {
    // Skip if this is the same session we already loaded
    if (prevSessionRef.current === currentSessionId) {
      return;
    }
    
    // Clear state when switching sessions or documents
    setMessages([]);
    setNotes([]);
    prevSessionRef.current = currentSessionId;
    
    // No session = no messages to load
    if (!currentSessionId) {
      setLoadingHistory(false);
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
            imageUrl: (message as { image_url?: string | null }).image_url ?? null,
            citations: message.citations?.map((citation, index) => ({
              index: index + 1,
              snippet: citation.content_preview,
            })),
            highlightColor: annotation?.highlight_color ?? null,
            selectionStart: annotation?.selection_start ?? null,
            selectionEnd: annotation?.selection_end ?? null,
          };
        });

        setMessages(newMessages);
        setNotes(buildNotesFromAnnotations(data.annotations ?? []));

        requestAnimationFrame(() => {
          scrollToLatest("auto");
        });
      })
      .catch((error) => {
        console.error("Failed to load chat history:", error);
      })
      .finally(() => {
        setLoadingHistory(false);
        isLoadingRef.current = false;
      });
  }, [currentSessionId, scrollToLatest]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (flashTimeoutRef.current) clearTimeout(flashTimeoutRef.current);
      if (imagePreview) URL.revokeObjectURL(imagePreview);
    };
  }, [imagePreview]);

  const handleSubmit = useCallback(async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = input.trim();
    if (!trimmed && !selectedImage) return;
    if (!currentDocumentId) return;

    let imageUrl: string | undefined;

    // Upload image if selected
    if (selectedImage) {
      setUploadingImage(true);
      try {
        const uploadFormData = new FormData();
        uploadFormData.append("file", selectedImage);

        const uploadRes = await fetch("/api/chat-images", {
          method: "POST",
          body: uploadFormData,
        });

        if (!uploadRes.ok) {
          const error = await uploadRes.json();
          throw new Error(error.error || "Failed to upload image");
        }

        const uploadData = await uploadRes.json();
        imageUrl = uploadData.url;
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to upload image");
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
  }, [input, currentDocumentId, currentSessionId, scrollToLatest]);

  const handleHighlightMessage = useCallback(async (
    messageId: string,
    highlightColor: HighlightColor,
  ) => {
    const targetMessage = messages.find((message) => message.id === messageId);
    if (!targetMessage || targetMessage.role !== "assistant") return;

    const nextHighlightColor =
      targetMessage.highlightColor === highlightColor ? null : highlightColor;

    // Optimistic update
    setMessages((prev) =>
      prev.map((message) =>
        message.id === messageId
          ? { ...message, highlightColor: nextHighlightColor }
          : message,
      ),
    );

    setNotes((prev) =>
      prev.map((note) =>
        note.messageId === messageId
          ? { ...note, highlightColor: nextHighlightColor }
          : note,
      ),
    );

    const existingNote = notes.find((note) => note.messageId === messageId);

    try {
      await persistAnnotation({
        messageId,
        noteContent: existingNote?.content ?? null,
        highlightColor: nextHighlightColor,
        selectionStart: existingNote?.selectionStart ?? null,
        selectionEnd: existingNote?.selectionEnd ?? null,
      });
    } catch (error) {
      // Revert on error
      setMessages((prev) =>
        prev.map((message) =>
          message.id === messageId
            ? { ...message, highlightColor: targetMessage.highlightColor }
            : message,
        ),
      );
      toast.error(error instanceof Error ? error.message : "Could not save highlight.");
    }
  }, [messages, notes, persistAnnotation]);

  const handleToggleNote = useCallback(async (messageId: string) => {
    const message = messages.find((entry) => entry.id === messageId);
    if (!message || message.role !== "assistant") return;

    const existingNote = notes.find((note) => note.messageId === messageId);
    const selected =
      selectedExcerpt?.messageId === messageId ? selectedExcerpt : null;
    const noteToSave = selected?.text || message.content;
    const nextNoteContent = existingNote ? null : noteToSave;
    const nextSelectionStart = existingNote ? null : selected?.start ?? null;
    const nextSelectionEnd = existingNote ? null : selected?.end ?? null;

    if (existingNote) {
      setNotes((prev) => prev.filter((note) => note.messageId !== messageId));
      setMessages((prev) =>
        prev.map((item) =>
          item.id === messageId
            ? { ...item, selectionStart: null, selectionEnd: null }
            : item,
        ),
      );
    } else {
      setNotes((prev) => [
        {
          id: createMessageId(),
          messageId,
          content: noteToSave,
          highlightColor: message.highlightColor ?? null,
          selectionStart: nextSelectionStart,
          selectionEnd: nextSelectionEnd,
        },
        ...prev,
      ]);
      setMessages((prev) =>
        prev.map((item) =>
          item.id === messageId
            ? { ...item, selectionStart: nextSelectionStart, selectionEnd: nextSelectionEnd }
            : item,
        ),
      );
    }

    try {
      await persistAnnotation({
        messageId,
        noteContent: nextNoteContent,
        highlightColor: message.highlightColor ?? null,
        selectionStart: nextSelectionStart,
        selectionEnd: nextSelectionEnd,
      });
      if (!existingNote) {
        toast.success(selected ? "Selected text saved." : "Note saved.");
      }
      setSelectedExcerpt(null);
      clearBrowserSelection();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save note.");
    }
  }, [messages, notes, selectedExcerpt, persistAnnotation, clearBrowserSelection]);

  const handleDeleteNote = useCallback(async (noteId: string) => {
    const note = notes.find((item) => item.id === noteId);
    if (!note) return;

    const message = messages.find((item) => item.id === note.messageId);
    setNotes((prev) => prev.filter((item) => item.id !== noteId));
    setMessages((prev) =>
      prev.map((item) =>
        item.id === note.messageId
          ? { ...item, selectionStart: null, selectionEnd: null }
          : item,
      ),
    );

    try {
      await persistAnnotation({
        messageId: note.messageId,
        noteContent: null,
        highlightColor: message?.highlightColor ?? null,
        selectionStart: null,
        selectionEnd: null,
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not delete note.");
    }
  }, [notes, messages, persistAnnotation]);

  if (documents.length === 0) {
    return (
      <div className="flex h-full items-center justify-center bg-gradient-to-br from-gray-50 to-violet-50 dark:from-[#0f1117] dark:to-[#1a1625]">
        <div className="text-center">
          <div className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-violet-100 to-fuchsia-100 dark:from-violet-500/20 dark:to-fuchsia-500/20">
            <FileText className="h-12 w-12 text-violet-600 dark:text-violet-400" />
          </div>
          <h3 className="mb-2 text-2xl font-bold text-gray-900 dark:text-white">
            No documents yet
          </h3>
          <p className="text-gray-500 dark:text-gray-400">
            Upload a document to start chatting with it.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-gradient-to-br from-gray-50 to-violet-50 dark:from-[#0f1117] dark:to-[#1a1625]">
      {/* Top Bar */}
      <header className="shrink-0 border-b border-gray-200/50 bg-white/80 backdrop-blur-xl dark:border-violet-900/30 dark:bg-[#1a1c24]/80">
        <div className="flex h-16 items-center justify-between px-6">
          {/* Logo & Doc selector */}
          <div className="flex items-center gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 to-fuchsia-600 shadow-lg shadow-violet-500/30">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <h1 className="text-lg font-bold text-gray-900 dark:text-white">
              SecondBrain
            </h1>
            
            {/* Document selector - full page navigation */}
            <div className="ml-4 flex items-center gap-2">
              <span className="text-sm text-gray-500 dark:text-gray-400">Chatting with:</span>
              <select
                value={currentDocumentId ?? ""}
                onChange={(e) => {
                  const newDocId = e.target.value;
                  if (newDocId) {
                    window.location.href = `/chat?documentId=${newDocId}`;
                  }
                }}
                className="appearance-none rounded-lg border border-gray-200/50 bg-gray-50 px-3 py-1.5 text-sm font-medium text-gray-700 dark:border-violet-900/50 dark:bg-[#252530] dark:text-gray-200 cursor-pointer"
              >
                {documents.map((doc) => (
                  <option key={doc.id} value={doc.id}>
                    {doc.filename}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                // Start new chat for current document
                if (currentDocumentId) {
                  window.location.href = `/chat?documentId=${currentDocumentId}`;
                } else {
                  window.location.href = "/chat";
                }
              }}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 px-4 py-2 text-sm font-medium text-white shadow-lg shadow-violet-500/30 transition-all hover:shadow-xl hover:shadow-violet-500/40 hover:scale-105"
            >
              <Plus className="h-4 w-4" />
              New Chat
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex flex-1 min-h-0">
        {/* Sidebar - Notes */}
        <aside className="w-72 shrink-0 border-r border-gray-200/50 bg-white/50 p-4 backdrop-blur-xl dark:border-violet-900/30 dark:bg-[#1a1c24]/50 overflow-y-auto">
          <div className="mb-4 flex items-center gap-2">
            <BookmarkPlus className="h-5 w-5 text-violet-600 dark:text-violet-400" />
            <h2 className="font-semibold text-gray-900 dark:text-white">Saved Notes</h2>
            {notes.length > 0 && (
              <span className="ml-auto rounded-full bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-600 dark:bg-violet-500/20 dark:text-violet-400">
                {notes.length}
              </span>
            )}
          </div>

          <div className="space-y-2">
            {notes.length === 0 ? (
              <div className="rounded-xl border border-dashed border-gray-200 dark:border-violet-900/50 bg-gray-50/50 dark:bg-[#252530] p-4 text-center">
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Save AI responses by clicking the bookmark icon
                </p>
              </div>
            ) : (
              notes.map((note) => {
                const highlightClass = HIGHLIGHT_COLORS.find(
                  (h) => h.color === note.highlightColor
                );
                return (
                  <div
                    key={note.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => jumpToMessage(note.messageId)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        jumpToMessage(note.messageId);
                      }
                    }}
                    className={`group cursor-pointer rounded-xl border p-3 transition-all hover:scale-[1.02] hover:shadow-md focus:outline-none focus:ring-2 focus:ring-violet-400 ${
                      highlightClass
                        ? `${highlightClass.bg} ${highlightClass.border}`
                        : "border-gray-200/50 bg-white dark:border-violet-900/50 dark:bg-[#252530]"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="flex-1 line-clamp-4 whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-200">
                        {note.content}
                      </p>
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          void handleDeleteNote(note.id);
                        }}
                        className="shrink-0 rounded-lg p-1.5 text-gray-400 opacity-0 transition-all hover:bg-red-50 hover:text-red-500 group-hover:opacity-100 dark:hover:bg-red-500/10"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </aside>

        {/* Chat Area */}
        <main className="flex flex-1 flex-col min-w-0">
          {/* Messages */}
          <div
            ref={scrollContainerRef}
            onScroll={updateScrollState}
            className="flex-1 overflow-y-auto p-6"
          >
            {loadingHistory ? (
              <div className="flex h-full items-center justify-center">
                <div className="flex items-center gap-3 text-gray-500 dark:text-gray-400">
                  <Loader2 className="h-6 w-6 animate-spin text-violet-600" />
                  <span>Loading chat history...</span>
                </div>
              </div>
            ) : messages.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center text-center">
                <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-violet-100 to-fuchsia-100 dark:from-violet-500/20 dark:to-fuchsia-500/20">
                  <MessageSquare className="h-10 w-10 text-violet-600 dark:text-violet-400" />
                </div>
                <h3 className="mb-2 text-xl font-bold text-gray-900 dark:text-white">
                  Start a conversation
                </h3>
                <p className="mb-6 max-w-md text-gray-500 dark:text-gray-400">
                  Ask anything about <span className="font-medium text-violet-600 dark:text-violet-400">{selectedDocument?.filename ?? "your document"}</span>
                </p>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    "Summarize this document",
                    "What are the key points?",
                    "Explain in simple terms",
                    "Find specific details",
                  ].map((suggestion) => (
                    <button
                      key={suggestion}
                      onClick={() => setInput(suggestion)}
                      className="rounded-xl border border-gray-200/50 bg-white px-4 py-2.5 text-left text-sm text-gray-600 transition-all hover:border-violet-300 hover:bg-violet-50 dark:border-violet-900/50 dark:bg-[#252530] dark:text-gray-300 dark:hover:border-violet-500/50 dark:hover:bg-violet-500/10"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                {messages.map((message) => {
                  const isUser = message.role === "user";
                  const hasSelectedExcerpt =
                    selectedExcerpt?.messageId === message.id &&
                    selectedExcerpt.text.length > 0;
                  const isCopied = copiedMessageId === message.id;

                  return (
                    <div
                      key={message.id}
                      ref={(element) => {
                        messageRefs.current[message.id] = element;
                      }}
                      className={`group transition-all duration-300 ${
                        flashedMessageId === message.id ? "scale-[1.01]" : ""
                      }`}
                    >
                      {/* Message bubble */}
                      <div className="flex items-start gap-3">
                        {/* Avatar */}
                        <div
                          className={`shrink-0 flex h-8 w-8 items-center justify-center rounded-full ${
                            isUser
                              ? "bg-gradient-to-br from-violet-600 to-fuchsia-600"
                              : "bg-gradient-to-br from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-800"
                          }`}
                        >
                          {isUser ? (
                            <span className="text-xs font-bold text-white">Y</span>
                          ) : (
                            <Sparkles className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                          )}
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="mb-1 flex items-center gap-2">
                            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                              {isUser ? "You" : "SecondBrain"}
                            </span>
                            {message.imageUrl && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-medium text-violet-600 dark:bg-violet-500/20 dark:text-violet-400">
                                <ImagePlus className="h-3 w-3" />
                                Image attached
                              </span>
                            )}
                            {isUser && (
                              <button
                                onClick={() => copyToClipboard(message.content, message.id)}
                                className="rounded-lg p-1.5 text-gray-400 transition-all hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300"
                                title="Copy"
                              >
                                {isCopied ? (
                                  <Check className="h-4 w-4 text-emerald-500" />
                                ) : (
                                  <Copy className="h-4 w-4" />
                                )}
                              </button>
                            )}
                          </div>

                          <div
                            className={`rounded-2xl border px-5 py-4 ${getHighlightClasses(message.highlightColor, isUser)}`}
                          >
                            {/* Image preview */}
                            {message.imageUrl && (
                              <div className="mb-3">
                                <img
                                  src={message.imageUrl}
                                  alt="Attached image"
                                  className="max-h-64 max-w-full rounded-lg border border-gray-200/50 object-contain dark:border-gray-700/50"
                                />
                              </div>
                            )}

                            <p
                              ref={(element) => {
                                contentRefs.current[message.id] = element;
                              }}
                              className="whitespace-pre-wrap text-sm leading-relaxed text-gray-800 dark:text-gray-200"
                              onMouseUp={() => captureSelectedText(message.id)}
                            >
                              {renderMessageContent(message)}
                            </p>
                          </div>

                          {/* Sources */}
                          {!isUser && message.citations?.length ? (
                            <div className="mt-3 ml-1 space-y-2">
                              <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-600">
                                Sources
                              </p>
                              <div className="flex flex-wrap gap-2">
                                {message.citations.map((citation) => (
                                  <div
                                    key={citation.index}
                                    className="max-w-xs rounded-lg border border-gray-200/50 bg-white/80 p-2.5 backdrop-blur-sm dark:border-violet-900/50 dark:bg-[#1a1c24]/80"
                                  >
                                    <div className="mb-1 flex items-center gap-1.5">
                                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-violet-100 text-[10px] font-bold text-violet-600 dark:bg-violet-500/20 dark:text-violet-400">
                                        {citation.index}
                                      </span>
                                      <span className="text-xs text-gray-500 dark:text-gray-500">
                                        Chunk {citation.snippet.slice(0, 50)}...
                                      </span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ) : null}

                          {/* Action buttons */}
                          {!isUser && (
                            <div className="mt-2 ml-1 flex items-center gap-2">
                              {/* Highlight mode toggle */}
                              <button
                                onClick={() => setHighlightMode(!highlightMode)}
                                className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-all ${
                                  highlightMode
                                    ? "border-violet-500 bg-violet-100 text-violet-700 dark:border-violet-400 dark:bg-violet-500/20 dark:text-violet-300"
                                    : "border-gray-200 bg-white text-gray-500 hover:border-violet-300 hover:text-violet-600 dark:border-violet-900/50 dark:bg-[#1a1c24]/80 dark:text-gray-400 dark:hover:border-violet-500/50"
                                }`}
                                title="Highlight mode"
                              >
                                <div className="flex h-3 w-3 items-center justify-center">
                                  <div className={`h-2 w-2 rounded-full ${highlightMode ? "bg-violet-600 animate-pulse" : "bg-gray-400"}`} />
                                </div>
                                {highlightMode ? "Selecting..." : "Highlight"}
                              </button>

                              {/* Highlight colors */}
                              {highlightMode && (
                                <div className="flex items-center gap-1 rounded-lg border border-gray-200 bg-white p-1.5 dark:border-violet-900/50 dark:bg-[#1a1c24]">
                                  {HIGHLIGHT_COLORS.map((h) => {
                                    const isActive = message.highlightColor === h.color;
                                    return (
                                      <button
                                        key={h.color}
                                        type="button"
                                        onClick={() =>
                                          void handleHighlightMessage(message.id, h.color)
                                        }
                                        className={`h-6 w-6 rounded-full border-2 transition-all ${
                                          isActive
                                            ? "scale-125 border-gray-900 dark:border-white shadow-md"
                                            : "border-white/70 hover:scale-110"
                                        }`}
                                        style={{
                                          backgroundColor:
                                            h.color === "rose"
                                              ? "#fda4af"
                                              : h.color === "amber"
                                                ? "#fcd34d"
                                                : h.color === "emerald"
                                                  ? "#6ee7b7"
                                                  : h.color === "sky"
                                                    ? "#7dd3fc"
                                                    : "#c4b5fd",
                                        }}
                                        title={h.color}
                                      />
                                    );
                                  })}
                                </div>
                              )}

                              {/* Copy button */}
                              <button
                                onClick={() => copyToClipboard(message.content, message.id)}
                                className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-500 transition-all hover:border-violet-300 hover:text-violet-600 dark:border-violet-900/50 dark:bg-[#1a1c24]/80 dark:text-gray-400 dark:hover:border-violet-500/50"
                              >
                                {isCopied ? (
                                  <>
                                    <Check className="h-3 w-3 text-emerald-500" />
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
                                onClick={() => void handleToggleNote(message.id)}
                                className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-all ${
                                  notes.some((note) => note.messageId === message.id)
                                    ? "border-violet-500 bg-violet-100 text-violet-700 dark:border-violet-400 dark:bg-violet-500/20 dark:text-violet-300"
                                    : "border-gray-200 bg-white text-gray-500 hover:border-violet-300 hover:text-violet-600 dark:border-violet-900/50 dark:bg-[#1a1c24]/80 dark:text-gray-400 dark:hover:border-violet-500/50"
                                }`}
                              >
                                <BookmarkPlus className="h-3 w-3" />
                                {notes.some((note) => note.messageId === message.id)
                                  ? "Saved"
                                  : hasSelectedExcerpt
                                    ? "Save selection"
                                    : "Save note"}
                              </button>

                              {hasSelectedExcerpt && (
                                <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[10px] font-medium text-amber-700 dark:bg-amber-500/20 dark:text-amber-300">
                                  Selection ready
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}

                {/* Typing indicator */}
                {sending && (
                  <div className="flex items-start gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-800">
                      <Sparkles className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                    </div>
                    <div className="rounded-2xl border border-gray-200/60 bg-white/90 px-5 py-4 dark:border-violet-900/50 dark:bg-[#1e2130]">
                      <div className="flex items-center gap-1.5">
                        <div className="h-2 w-2 animate-bounce rounded-full bg-violet-600 [animation-delay:-0.3s]" />
                        <div className="h-2 w-2 animate-bounce rounded-full bg-violet-600 [animation-delay:-0.15s]" />
                        <div className="h-2 w-2 animate-bounce rounded-full bg-violet-600" />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Jump to bottom */}
          {showJumpToLatest && (
            <button
              type="button"
              onClick={() => scrollToLatest("smooth")}
              className="absolute bottom-24 right-6 z-10 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-violet-600 to-fuchsia-600 px-5 py-3 text-sm font-medium text-white shadow-xl shadow-violet-500/30 transition-all hover:shadow-2xl hover:shadow-violet-500/40"
            >
              <ArrowDown className="h-4 w-4" />
              Jump to latest
            </button>
          )}

          {/* Input */}
          <div className="shrink-0 border-t border-gray-200/50 bg-white/80 p-4 backdrop-blur-xl dark:border-violet-900/30 dark:bg-[#1a1c24]/80">
            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
              {/* Image preview */}
              {imagePreview && (
                <div className="flex items-center gap-3 rounded-xl border border-violet-200/50 bg-violet-50/50 p-3 dark:border-violet-900/30 dark:bg-violet-500/5">
                  <div className="relative shrink-0">
                    <img
                      src={imagePreview}
                      alt="Preview"
                      className="h-16 w-16 rounded-lg border border-gray-200/50 object-cover dark:border-gray-700/50"
                    />
                    {uploadingImage && (
                      <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-black/50">
                        <Loader2 className="h-5 w-5 animate-spin text-white" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-gray-700 dark:text-gray-200">
                      {selectedImage?.name}
                    </p>
                    <p className="text-xs text-gray-500">
                      {selectedImage && (selectedImage.size / 1024).toFixed(1)} KB
                      {uploadingImage && " • Uploading..."}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={removeSelectedImage}
                    disabled={uploadingImage}
                    className="shrink-0 rounded-lg p-2 text-gray-400 transition-all hover:bg-gray-100 hover:text-gray-600 disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-gray-800"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              )}

              <div className="flex items-center gap-3">
                {/* Image attachment button */}
                <label
                  className={`flex h-12 w-12 shrink-0 cursor-pointer items-center justify-center rounded-xl border border-gray-200/50 bg-gray-50/50 text-gray-500 transition-all hover:border-violet-300 hover:bg-violet-50 hover:text-violet-600 dark:border-violet-900/50 dark:bg-[#252530] dark:text-gray-400 dark:hover:border-violet-500/50 dark:hover:bg-violet-500/10 dark:hover:text-violet-400 ${(!selectedDocument || sending) ? "opacity-50 cursor-not-allowed" : ""}`}
                >
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/gif,image/webp"
                    onChange={handleImageSelect}
                    disabled={!selectedDocument || sending}
                    className="hidden"
                  />
                  <ImagePlus className="h-5 w-5" />
                </label>

                <div className="relative flex-1">
                  <input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder={
                      selectedDocument
                        ? `Ask about ${selectedDocument.filename}...`
                        : "Select a document to start..."
                    }
                    disabled={!selectedDocument || sending}
                    className="w-full rounded-xl border border-gray-200/50 bg-gray-50/50 px-4 py-3.5 pr-12 text-sm outline-none transition-all placeholder:text-gray-400 focus:border-violet-500/50 focus:bg-white focus:shadow-lg focus:shadow-violet-500/10 dark:border-violet-900/50 dark:bg-[#252530] dark:text-white dark:placeholder:text-gray-600 dark:focus:border-violet-500/50 dark:focus:bg-[#1a1c24] disabled:cursor-not-allowed disabled:opacity-50"
                  />
                  {input && (
                    <button
                      type="button"
                      onClick={() => setInput("")}
                      className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-gray-400 transition-all hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
                <button
                  type="submit"
                  disabled={!selectedDocument || sending || (!input.trim() && !selectedImage) || uploadingImage}
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 to-fuchsia-600 text-white shadow-lg shadow-violet-500/30 transition-all hover:shadow-xl hover:shadow-violet-500/40 hover:scale-105 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100"
                >
                  <SendHorizonal className="h-5 w-5" />
                </button>
              </div>
            </form>
          </div>
        </main>
      </div>
    </div>
  );
}
