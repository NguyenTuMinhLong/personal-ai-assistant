// components/chat/ChatWorkspace.tsx
"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BookmarkPlus,
  Highlighter,
  Loader2,
  MessageSquare,
  SendHorizonal,
  Trash2,
} from "lucide-react";

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
};

type SavedNote = {
  id: string;
  messageId: string;
  content: string;
  highlightColor?: HighlightColor | null;
};

type ChatWorkspaceProps = {
  documents: StoredDocument[];
  initialDocumentId: string | null;
  initialSessionId: string | null; // 👈 thêm
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

  const selectedDocument = useMemo(
    () => documents.find((doc) => doc.id === selectedDocumentId) ?? null,
    [documents, selectedDocumentId],
  );

  // ── Load messages khi có sessionId ──────────────────────────
  const loadedSessionRef = useRef<string | null>(null);

  useEffect(() => {
    if (!initialSessionId || loadedSessionRef.current === initialSessionId) {
      return;
    }

    loadedSessionRef.current = initialSessionId;
    setCurrentSessionId(initialSessionId);

    async function fetchHistory() {
      setLoadingHistory(true);
      try {
        const res = await fetch(
          `/api/sessions/${initialSessionId}/messages`,
        );
        if (!res.ok) return;

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
        };

        // Convert DB messages → ChatMessage format
        setMessages(
          data.messages.map((m) => ({
            id: m.id,
            role: m.role,
            content: m.content,
            citations: m.citations?.map((c, i) => ({
              index: i + 1,
              snippet: c.content_preview,
            })),
          })),
        );
      } finally {
        setLoadingHistory(false);
      }
    }

    fetchHistory();
  }, [initialSessionId]);

  // ── Reset khi đổi document ────────────────────────────────
  useEffect(() => {
    setSelectedDocumentId(initialDocumentId);
  }, [initialDocumentId]);

  // ── Sync URL ──────────────────────────────────────────────
  useEffect(() => {
    if (!selectedDocumentId) {
      router.replace("/chat", { scroll: false });
      return;
    }

    const params = new URLSearchParams();
    params.set("documentId", selectedDocumentId);
    if (currentSessionId) params.set("sessionId", currentSessionId);

    router.replace(`/chat?${params.toString()}`, { scroll: false });
  }, [router, selectedDocumentId, currentSessionId]);

  // ── Đổi document → reset messages + session ──────────────
  const handleSelectDocument = (docId: string) => {
    if (docId === selectedDocumentId) return;
    setSelectedDocumentId(docId);
    setCurrentSessionId(null);
    setMessages([]);
    setNotes([]);
    loadedSessionRef.current = null;
  };

  // ── Submit ────────────────────────────────────────────────
  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || !selectedDocumentId) return;

    const userMsg: ChatMessage = {
      id: createMessageId(),
      role: "user",
      content: trimmed,
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setSending(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documentId: selectedDocumentId,
          message: trimmed,
          sessionId: currentSessionId, // 👈 gửi sessionId nếu có
        }),
      });

      const payload = (await response.json()) as {
        answer?: string;
        citations?: Citation[];
        sessionId?: string; // 👈 nhận sessionId từ API
        error?: string;
      } | null;

      if (!response.ok || !payload?.answer) {
        throw new Error(payload?.error ?? "Could not get an answer.");
      }

      // Lưu sessionId nếu là lần đầu
      if (payload.sessionId && !currentSessionId) {
        setCurrentSessionId(payload.sessionId);
      }

      setMessages((prev) => [
        ...prev,
        {
          id: createMessageId(),
          role: "assistant",
          content: payload.answer!,
          citations: payload.citations ?? [],
        },
      ]);
    } catch (error) {
      const msg =
        error instanceof Error ? error.message : "Could not get an answer.";
      setMessages((prev) => [
        ...prev,
        { id: createMessageId(), role: "assistant", content: msg },
      ]);
    } finally {
      setSending(false);
    }
  };

  // ── Highlight ─────────────────────────────────────────────
  const handleHighlightMessage = (
    messageId: string,
    highlightColor: HighlightColor,
  ) => {
    setMessages((prev) =>
      prev.map((m) =>
        m.id === messageId
          ? {
              ...m,
              highlightColor:
                m.highlightColor === highlightColor ? null : highlightColor,
            }
          : m,
      ),
    );
    setNotes((prev) =>
      prev.map((n) =>
        n.messageId === messageId
          ? {
              ...n,
              highlightColor:
                messages.find((m) => m.id === messageId)?.highlightColor ===
                highlightColor
                  ? null
                  : highlightColor,
            }
          : n,
      ),
    );
  };

  // ── Notes ─────────────────────────────────────────────────
  const handleToggleNote = (messageId: string) => {
    const message = messages.find((m) => m.id === messageId);
    if (!message || message.role !== "assistant") return;

    const exists = notes.some((n) => n.messageId === messageId);

    if (exists) {
      setNotes((prev) => prev.filter((n) => n.messageId !== messageId));
    } else {
      setNotes((prev) => [
        {
          id: createMessageId(),
          messageId,
          content: message.content,
          highlightColor: message.highlightColor ?? null,
        },
        ...prev,
      ]);
    }
  };

  const handleDeleteNote = (noteId: string) => {
    setNotes((prev) => prev.filter((n) => n.id !== noteId));
  };

  // ── Render ────────────────────────────────────────────────
  if (documents.length === 0) {
    return (
      <div className="mx-auto flex max-w-3xl items-center justify-center rounded-3xl border border-dashed border-gray-300 bg-white p-10 text-center text-gray-500 dark:border-[#3b414a] dark:bg-[#323840] dark:text-[#aab2be]">
        Upload a document first, then we can chat with it here.
      </div>
    );
  }

  return (
    <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
      {/* Sidebar */}
      <aside className="rounded-[1.75rem] border border-gray-200 bg-white p-5 dark:border-[#3b414a] dark:bg-[#2c3138]">
        <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-[#eef1f7]">
          <MessageSquare className="h-4 w-4 text-violet-500" />
          Your documents
        </div>
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

        {/* Notes */}
        <div className="mt-6 border-t border-gray-100 pt-4 dark:border-[#3b414a]">
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
                  className={`rounded-2xl border p-3 text-sm ${getHighlightClasses(note.highlightColor)}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="line-clamp-4 whitespace-pre-wrap">
                      {note.content}
                    </p>
                    <button
                      type="button"
                      onClick={() => handleDeleteNote(note.id)}
                      className="shrink-0 rounded-xl p-2 text-gray-400 transition hover:bg-white/60 hover:text-red-500 dark:hover:bg-[#25292f]"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </aside>

      {/* Chat */}
      <section className="flex min-h-[70vh] flex-col rounded-[1.75rem] border border-gray-200 bg-white p-5 dark:border-[#3b414a] dark:bg-[#323840]">
        <div className="border-b border-gray-100 pb-4 dark:border-[#3b414a]">
          <p className="text-sm font-medium text-violet-600">Source chat</p>
          <h1 className="mt-1 text-2xl font-semibold text-gray-900 dark:text-[#f4f7fb]">
            {selectedDocument?.filename ?? "Choose a document"}
          </h1>
          <p className="mt-2 text-sm text-gray-500 dark:text-[#aab2be]">
            Ask about one file at a time. Answers stay grounded in the selected
            source.
          </p>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto py-6">
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
            messages.map((message) => (
              <div
                key={message.id}
                className={`rounded-2xl px-4 py-3 ${
                  message.role === "user"
                    ? "ml-auto max-w-[80%] bg-violet-600 text-white"
                    : `max-w-[85%] border ${getHighlightClasses(message.highlightColor)}`
                }`}
              >
                <p className="whitespace-pre-wrap text-sm leading-6">
                  {message.content}
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
                        const isActive = message.highlightColor === option.color;
                        return (
                          <button
                            key={option.color}
                            type="button"
                            onClick={() =>
                              handleHighlightMessage(message.id, option.color)
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
                      onClick={() => handleToggleNote(message.id)}
                      className="rounded-xl border border-gray-200 px-3 py-1.5 text-gray-600 transition hover:border-violet-300 hover:text-violet-700 dark:border-[#48505a] dark:text-[#dce2ec] dark:hover:border-[#6670ff] dark:hover:text-white"
                    >
                      {notes.some((n) => n.messageId === message.id)
                        ? "Saved"
                        : "Save note"}
                    </button>
                  </div>
                ) : null}
              </div>
            ))
          )}
          {sending ? (
            <div className="flex items-center gap-2 text-sm text-gray-400 dark:text-[#aab2be]">
              <Loader2 className="h-4 w-4 animate-spin" />
              Thinking...
            </div>
          ) : null}
        </div>

        <form onSubmit={handleSubmit} className="mt-auto flex gap-3 pt-4">
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
        </form>
      </section>
    </div>
  );
}