"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowDown,
  BookmarkPlus,
  Highlighter,
  Loader2,
  MessageSquare,
  SendHorizonal,
  Trash2,
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

const HIGHLIGHT_OPTIONS: Array<{ color: HighlightColor; swatch: string }> = [
  { color: "rose", swatch: "#fda4af" },
  { color: "amber", swatch: "#fcd34d" },
  { color: "emerald", swatch: "#6ee7b7" },
  { color: "sky", swatch: "#7dd3fc" },
  { color: "violet", swatch: "#c4b5fd" },
];

function createMessageId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `msg-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function getHighlightClasses(color?: HighlightColor | null) {
  switch (color) {
    case "rose":
      return "border-rose-300 bg-rose-50 text-rose-950 dark:border-[#684754] dark:bg-[#463740] dark:text-rose-50";
    case "amber":
      return "border-amber-300 bg-amber-50 text-amber-950 dark:border-[#66523b] dark:bg-[#463d31] dark:text-amber-50";
    case "emerald":
      return "border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-[#3f5b53] dark:bg-[#31433d] dark:text-emerald-50";
    case "sky":
      return "border-sky-300 bg-sky-50 text-sky-950 dark:border-[#415764] dark:bg-[#303e48] dark:text-sky-50";
    case "violet":
      return "border-violet-300 bg-violet-50 text-violet-950 dark:border-[#4e4a69] dark:bg-[#37334a] dark:text-violet-50";
    default:
      return "border-gray-200 bg-gray-50 text-gray-800 dark:border-[#3b414a] dark:bg-[#323840] dark:text-[#eef1f7]";
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
      <mark className="rounded bg-violet-300/50 px-1 text-inherit dark:bg-violet-400/30">
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
  const router = useRouter();

  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(
    initialDocumentId,
  );
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(
    initialSessionId,
  );
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [notes, setNotes] = useState<SavedNote[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [showJumpToLatest, setShowJumpToLatest] = useState(false);
  const [selectedExcerpt, setSelectedExcerpt] = useState<SelectedExcerpt | null>(
    null,
  );
  const [flashedMessageId, setFlashedMessageId] = useState<string | null>(null);

  const selectedDocument = useMemo(
    () => documents.find((doc) => doc.id === selectedDocumentId) ?? null,
    [documents, selectedDocumentId],
  );

  const loadedSessionRef = useRef<string | null>(null);
  const shouldStickToBottomRef = useRef(true);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const messageRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const contentRefs = useRef<Record<string, HTMLParagraphElement | null>>({});
  const flashTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const updateScrollState = () => {
    const container = scrollContainerRef.current;

    if (!container) {
      return;
    }

    const distanceFromBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight;
    const nearBottom = distanceFromBottom < 120;

    shouldStickToBottomRef.current = nearBottom;
    setShowJumpToLatest(!nearBottom);
  };

  const scrollToLatest = (behavior: ScrollBehavior = "smooth") => {
    const container = scrollContainerRef.current;

    if (!container) {
      return;
    }

    container.scrollTo({
      top: container.scrollHeight,
      behavior,
    });
  };

  const clearBrowserSelection = () => {
    if (typeof window === "undefined") {
      return;
    }

    const selection = window.getSelection();

    if (selection) {
      selection.removeAllRanges();
    }
  };

  const jumpToMessage = (messageId: string) => {
    const element = messageRefs.current[messageId];

    if (!element) {
      return;
    }

    element.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });

    setFlashedMessageId(messageId);

    if (flashTimeoutRef.current) {
      clearTimeout(flashTimeoutRef.current);
    }

    flashTimeoutRef.current = setTimeout(() => {
      setFlashedMessageId((current) =>
        current === messageId ? null : current,
      );
    }, 1800);
  };

  const captureSelectedText = (messageId: string) => {
    if (typeof window === "undefined") {
      return;
    }

    const selection = window.getSelection();
    const contentElement = contentRefs.current[messageId];
    const text = selection?.toString().trim() ?? "";

    if (!contentElement || !selection || selection.rangeCount === 0 || !text) {
      if (selectedExcerpt?.messageId === messageId) {
        setSelectedExcerpt(null);
      }
      return;
    }

    const range = selection.getRangeAt(0);
    const commonNode = range.commonAncestorContainer;

    if (!contentElement.contains(commonNode)) {
      return;
    }

    const prefixRange = range.cloneRange();
    prefixRange.selectNodeContents(contentElement);
    prefixRange.setEnd(range.startContainer, range.startOffset);

    const start = prefixRange.toString().length;
    const end = start + selection.toString().length;

    if (end <= start) {
      setSelectedExcerpt(null);
      return;
    }

    setSelectedExcerpt({
      messageId,
      text,
      start,
      end,
    });
  };

  useEffect(() => {
    if (!initialSessionId || loadedSessionRef.current === initialSessionId) {
      return;
    }

    loadedSessionRef.current = initialSessionId;
    setCurrentSessionId(initialSessionId);

    async function fetchHistory() {
      setLoadingHistory(true);

      try {
        const res = await fetch(`/api/sessions/${initialSessionId}/messages`);

        if (!res.ok) {
          return;
        }

        const data = (await res.json()) as {
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
        };

        const annotationMap = new Map(
          (data.annotations ?? []).map((annotation) => [
            annotation.message_id,
            annotation,
          ]),
        );

        setMessages(
          data.messages.map((message) => {
            const annotation = annotationMap.get(message.id);

            return {
              id: message.id,
              role: message.role,
              content: message.content,
              citations: message.citations?.map((citation, index) => ({
                index: index + 1,
                snippet: citation.content_preview,
              })),
              highlightColor: annotation?.highlight_color ?? null,
              selectionStart: annotation?.selection_start ?? null,
              selectionEnd: annotation?.selection_end ?? null,
            };
          }),
        );

        setNotes(buildNotesFromAnnotations(data.annotations ?? []));
        setSelectedExcerpt(null);

        requestAnimationFrame(() => {
          scrollToLatest("auto");
          updateScrollState();
        });
      } finally {
        setLoadingHistory(false);
      }
    }

    void fetchHistory();
  }, [initialSessionId]);

  useEffect(() => {
    setSelectedDocumentId(initialDocumentId);
  }, [initialDocumentId]);

  useEffect(() => {
    if (!selectedDocumentId) {
      router.replace("/chat", { scroll: false });
      return;
    }

    const params = new URLSearchParams();
    params.set("documentId", selectedDocumentId);

    if (currentSessionId) {
      params.set("sessionId", currentSessionId);
    }

    router.replace(`/chat?${params.toString()}`, { scroll: false });
  }, [router, selectedDocumentId, currentSessionId]);

  useEffect(() => {
    requestAnimationFrame(() => {
      if (shouldStickToBottomRef.current) {
        scrollToLatest("smooth");
      } else {
        updateScrollState();
      }
    });
  }, [messages, sending]);

  useEffect(() => {
    return () => {
      if (flashTimeoutRef.current) {
        clearTimeout(flashTimeoutRef.current);
      }
    };
  }, []);

  const handleSelectDocument = (docId: string) => {
    if (docId === selectedDocumentId) {
      return;
    }

    setSelectedDocumentId(docId);
    setCurrentSessionId(null);
    setMessages([]);
    setNotes([]);
    setSelectedExcerpt(null);
    setFlashedMessageId(null);
    loadedSessionRef.current = null;
  };

  const persistAnnotation = async (input: {
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
      headers: {
        "Content-Type": "application/json",
      },
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
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmed = input.trim();

    if (!trimmed || !selectedDocumentId) {
      return;
    }

    const userMessage: ChatMessage = {
      id: createMessageId(),
      role: "user",
      content: trimmed,
    };

    shouldStickToBottomRef.current = true;
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setSending(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          documentId: selectedDocumentId,
          message: trimmed,
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
      const nextSessionId = payload.sessionId ?? null;

      if (nextSessionId && !currentSessionId) {
        setCurrentSessionId(nextSessionId);
      }

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

      if (payload.reused) {
        toast.success("Reused a previous exact answer.");
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Could not get an answer.";

      setMessages((prev) => [
        ...prev,
        {
          id: createMessageId(),
          role: "assistant",
          content: errorMessage,
        },
      ]);
    } finally {
      setSending(false);
    }
  };

  const handleHighlightMessage = async (
    messageId: string,
    highlightColor: HighlightColor,
  ) => {
    const prevMessages = messages;
    const prevNotes = notes;

    const targetMessage = messages.find((message) => message.id === messageId);

    if (!targetMessage || targetMessage.role !== "assistant") {
      return;
    }

    const nextHighlightColor =
      targetMessage.highlightColor === highlightColor ? null : highlightColor;

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
      setMessages(prevMessages);
      setNotes(prevNotes);

      const errorMessage =
        error instanceof Error ? error.message : "Could not save highlight.";

      toast.error(errorMessage);
    }
  };

  const handleToggleNote = async (messageId: string) => {
    const prevMessages = messages;
    const prevNotes = notes;

    const message = messages.find((entry) => entry.id === messageId);

    if (!message || message.role !== "assistant") {
      return;
    }

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
            ? {
                ...item,
                selectionStart: nextSelectionStart,
                selectionEnd: nextSelectionEnd,
              }
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
      setMessages(prevMessages);
      setNotes(prevNotes);

      const errorMessage =
        error instanceof Error ? error.message : "Could not save note.";

      toast.error(errorMessage);
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    const prevMessages = messages;
    const prevNotes = notes;

    const note = notes.find((item) => item.id === noteId);

    if (!note) {
      return;
    }

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
      setMessages(prevMessages);
      setNotes(prevNotes);

      const errorMessage =
        error instanceof Error ? error.message : "Could not delete note.";

      toast.error(errorMessage);
    }
  };

  if (documents.length === 0) {
    return (
      <div className="mx-auto flex max-w-3xl items-center justify-center rounded-3xl border border-dashed border-gray-300 bg-white p-10 text-center text-gray-500 dark:border-[#3b414a] dark:bg-[#323840] dark:text-[#aab2be]">
        Upload a document first, then we can chat with it here.
      </div>
    );
  }

  return (
    <div className="grid h-[calc(100vh-8rem)] min-h-0 w-full min-w-0 gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
      <aside className="flex min-h-0 flex-col rounded-[1.75rem] border border-gray-200 bg-white p-5 dark:border-[#3b414a] dark:bg-[#2c3138]">
        <div className="mb-4 flex shrink-0 items-center gap-2 text-sm font-semibold text-gray-700 dark:text-[#eef1f7]">
          <MessageSquare className="h-4 w-4 text-violet-500" />
          Your documents
        </div>

        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto">
          <div className="space-y-2">
            {documents.map((doc) => {
              const isActive = doc.id === selectedDocumentId;

              return (
                <button
                  key={doc.id}
                  type="button"
                  onClick={() => handleSelectDocument(doc.id)}
                  className={`w-full rounded-2xl border px-4 py-3 text-left text-sm transition ${
                    isActive
                      ? "border-violet-500 bg-violet-50 text-violet-900 dark:border-[#5960a4] dark:bg-[#39405a] dark:text-[#f4f5ff]"
                      : "border-gray-200 hover:border-violet-200 hover:bg-gray-50 dark:border-[#3b414a] dark:text-[#d6dae3] dark:hover:bg-[#323840]"
                  }`}
                >
                  <p className="truncate font-medium">{doc.filename}</p>
                  <p className="mt-1 text-xs text-gray-400 dark:text-[#9ea6b3]">
                    Ask focused questions about this source
                  </p>
                </button>
              );
            })}
          </div>

          <div className="border-t border-gray-100 pt-4 dark:border-[#3b414a]">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-[#eef1f7]">
              <BookmarkPlus className="h-4 w-4 text-violet-500" />
              Saved notes
            </div>

            <div className="space-y-2">
              {notes.length === 0 ? (
                <p className="rounded-2xl bg-gray-50 px-4 py-3 text-xs text-gray-500 dark:bg-[#323840] dark:text-[#aab2be]">
                  Save an assistant reply to keep it here.
                </p>
              ) : (
                notes.map((note) => (
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
                    className={`w-full rounded-2xl border p-3 text-left text-sm transition hover:scale-[1.01] focus:outline-none focus:ring-2 focus:ring-violet-400 ${getHighlightClasses(note.highlightColor)}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <p className="line-clamp-4 whitespace-pre-wrap">
                        {note.content}
                      </p>

                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          void handleDeleteNote(note.id);
                        }}
                        className="shrink-0 rounded-xl p-2 text-gray-400 transition hover:bg-white/60 hover:text-red-500 dark:hover:bg-[#25292f]"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>

                    <p className="mt-2 text-[11px] font-medium opacity-70">
                      Click to jump to source
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </aside>

      <section className="relative flex min-h-0 flex-col rounded-[1.75rem] border border-gray-200 bg-white p-5 dark:border-[#3b414a] dark:bg-[#323840]">
        <div className="shrink-0 border-b border-gray-100 pb-4 dark:border-[#3b414a]">
          <p className="text-sm font-medium text-violet-600">Source chat</p>
          <h1 className="mt-1 text-2xl font-semibold text-gray-900 dark:text-[#f4f7fb]">
            {selectedDocument?.filename ?? "Choose a document"}
          </h1>
          <p className="mt-2 text-sm text-gray-500 dark:text-[#aab2be]">
            Ask about one file at a time. Answers stay grounded in the selected
            source.
          </p>
        </div>

        <div
          ref={scrollContainerRef}
          onScroll={updateScrollState}
          className="min-h-0 flex-1 space-y-4 overflow-y-auto py-6"
        >
          {loadingHistory ? (
            <div className="flex items-center gap-2 text-sm text-gray-400 dark:text-[#aab2be]">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading chat history...
            </div>
          ) : messages.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-5 text-sm text-gray-500 dark:border-[#434954] dark:bg-[#2a2f36] dark:text-[#aab2be]">
              Try asking:
              <br />
              &quot;Summarize this document&quot;
              <br />
              &quot;What are the key points?&quot;
              <br />
              &quot;Explain this in simple terms&quot;
            </div>
          ) : (
            messages.map((message) => {
              const hasSelectedExcerpt =
                selectedExcerpt?.messageId === message.id &&
                selectedExcerpt.text.length > 0;

              const bubbleClassName =
                message.role === "user"
                  ? "ml-auto max-w-[80%] bg-violet-600 text-white"
                  : `max-w-[88%] border ${getHighlightClasses(message.highlightColor)}`;

              return (
                <div
                  key={message.id}
                  ref={(element) => {
                    messageRefs.current[message.id] = element;
                  }}
                  className={`rounded-2xl px-4 py-3 transition ${
                    flashedMessageId === message.id
                      ? "ring-2 ring-violet-400 ring-offset-2 ring-offset-transparent"
                      : ""
                  } ${bubbleClassName}`}
                >
                  <p
                    ref={(element) => {
                      contentRefs.current[message.id] = element;
                    }}
                    className="whitespace-pre-wrap text-sm leading-6"
                    onMouseUp={() => captureSelectedText(message.id)}
                  >
                    {renderMessageContent(message)}
                  </p>

                  {message.citations?.length ? (
                    <div className="mt-4 space-y-2 border-t border-gray-200 pt-3 text-xs text-gray-500 dark:border-[#434954] dark:text-[#aab2be]">
                      {message.citations.map((citation) => (
                        <div
                          key={citation.index}
                          className="rounded-xl bg-white/60 p-3 dark:bg-[#2a2f36]"
                        >
                          <p className="font-semibold text-gray-600 dark:text-[#dce2ec]">
                            Source [{citation.index}]
                          </p>
                          <p className="mt-1 whitespace-pre-wrap">
                            {citation.snippet}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : null}

                  {message.role === "assistant" ? (
                    <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-gray-200 pt-3 text-xs dark:border-[#434954]">
                      <div className="flex items-center gap-2 text-gray-500 dark:text-[#aab2be]">
                        <Highlighter className="h-3.5 w-3.5" />
                        Highlight
                      </div>

                      <div className="flex items-center gap-2">
                        {HIGHLIGHT_OPTIONS.map((option) => {
                          const isActive =
                            message.highlightColor === option.color;

                          return (
                            <button
                              key={option.color}
                              type="button"
                              onClick={() =>
                                void handleHighlightMessage(
                                  message.id,
                                  option.color,
                                )
                              }
                              className={`h-5 w-5 rounded-full border transition ${
                                isActive
                                  ? "scale-110 border-gray-900 dark:border-white"
                                  : "border-white/70"
                              }`}
                              style={{ backgroundColor: option.swatch }}
                              aria-label={`Highlight ${option.color}`}
                            />
                          );
                        })}
                      </div>

                      <button
                        type="button"
                        onClick={() => void handleToggleNote(message.id)}
                        className="rounded-xl border border-gray-200 px-3 py-1.5 text-gray-600 transition hover:border-violet-300 hover:text-violet-700 dark:border-[#48505a] dark:text-[#dce2ec] dark:hover:border-[#6670ff] dark:hover:text-white"
                      >
                        {notes.some((note) => note.messageId === message.id)
                          ? "Saved"
                          : hasSelectedExcerpt
                            ? "Save selection"
                            : "Save note"}
                      </button>

                      {hasSelectedExcerpt ? (
                        <span className="rounded-full bg-violet-100 px-2.5 py-1 text-[11px] font-medium text-violet-700 dark:bg-violet-900/30 dark:text-violet-300">
                          Selected text ready
                        </span>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              );
            })
          )}

          {sending ? (
            <div className="flex items-center gap-2 text-sm text-gray-400 dark:text-[#aab2be]">
              <Loader2 className="h-4 w-4 animate-spin" />
              Thinking...
            </div>
          ) : null}
        </div>

        {showJumpToLatest ? (
          <button
            type="button"
            onClick={() => scrollToLatest("smooth")}
            className="absolute bottom-24 right-6 z-10 inline-flex items-center gap-2 rounded-full bg-violet-600 px-4 py-3 text-sm font-medium text-white shadow-lg transition hover:bg-violet-700"
          >
            <ArrowDown className="h-4 w-4" />
            Latest
          </button>
        ) : null}

        <form
          onSubmit={handleSubmit}
          className="mt-4 shrink-0 border-t border-gray-100 pt-4 dark:border-[#3b414a]"
        >
          <div className="flex gap-3">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={
                selectedDocument
                  ? `Ask about ${selectedDocument.filename}`
                  : "Choose a document to start"
              }
              disabled={!selectedDocument || sending}
              className="flex-1 rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-violet-500 dark:border-[#48505a] dark:bg-[#2a2f36] dark:text-[#f1f4fa] dark:placeholder:text-[#8e97a5]"
            />

            <button
              type="submit"
              disabled={!selectedDocument || sending || !input.trim()}
              className="inline-flex items-center justify-center rounded-2xl bg-violet-600 px-5 py-3 text-white transition hover:bg-violet-700 disabled:opacity-50"
            >
              <SendHorizonal className="h-4 w-4" />
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}