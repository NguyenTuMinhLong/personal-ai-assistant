"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, MessageSquare, SendHorizonal } from "lucide-react";

import type { StoredDocument } from "@/lib/documents";

type Citation = {
  index: number;
  snippet: string;
};

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  citations?: Citation[];
};

type ChatWorkspaceProps = {
  documents: StoredDocument[];
  initialDocumentId: string | null;
};

export function ChatWorkspace({
  documents,
  initialDocumentId,
}: ChatWorkspaceProps) {
  const router = useRouter();
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(
    initialDocumentId,
  );
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  const selectedDocument = useMemo(
    () => documents.find((doc) => doc.id === selectedDocumentId) ?? null,
    [documents, selectedDocumentId],
  );

  useEffect(() => {
    setSelectedDocumentId(initialDocumentId);
  }, [initialDocumentId]);

  useEffect(() => {
    setMessages([]);

    if (selectedDocumentId) {
      router.replace(`/chat?documentId=${selectedDocumentId}`, { scroll: false });
      return;
    }

    router.replace("/chat", { scroll: false });
  }, [router, selectedDocumentId]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmed = input.trim();

    if (!trimmed || !selectedDocumentId) {
      return;
    }

    const nextUserMessage: ChatMessage = {
      role: "user",
      content: trimmed,
    };

    setMessages((prev) => [...prev, nextUserMessage]);
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
        }),
      });

      const payload =
        (await response.json()) as
          | { answer?: string; citations?: Citation[]; error?: string }
          | null;

      if (!response.ok || !payload?.answer) {
        throw new Error(payload?.error || "Could not get an answer.");
      }

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: payload.answer,
          citations: payload.citations ?? [],
        },
      ]);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Could not get an answer.";

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: message,
        },
      ]);
    } finally {
      setSending(false);
    }
  };

  if (documents.length === 0) {
    return (
      <div className="mx-auto flex max-w-3xl items-center justify-center rounded-3xl border border-dashed border-gray-300 bg-white p-10 text-center text-gray-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-400">
        Upload a document first, then we can chat with it here.
      </div>
    );
  }

  return (
    <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
      <aside className="rounded-3xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-900">
        <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-200">
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
                onClick={() => setSelectedDocumentId(doc.id)}
                className={`w-full rounded-2xl border px-4 py-3 text-left text-sm transition ${isActive ? "border-violet-500 bg-violet-50 text-violet-900 dark:bg-violet-950/40 dark:text-violet-100" : "border-gray-200 hover:border-violet-200 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"}`}
              >
                <p className="truncate font-medium">{doc.filename}</p>
                <p className="mt-1 text-xs text-gray-400">
                  Ask focused questions about this source
                </p>
              </button>
            );
          })}
        </div>
      </aside>

      <section className="flex min-h-[70vh] flex-col rounded-3xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-900">
        <div className="border-b border-gray-100 pb-4 dark:border-gray-800">
          <p className="text-sm font-medium text-violet-600">Source chat</p>
          <h1 className="mt-1 text-2xl font-semibold text-gray-900 dark:text-white">
            {selectedDocument?.filename ?? "Choose a document"}
          </h1>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            Ask about one file at a time. Answers stay grounded in the selected
            source.
          </p>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto py-6">
          {messages.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-5 text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-800/40 dark:text-gray-400">
              Try asking:
              <br />
              &quot;Summarize this document&quot;
              <br />
              &quot;What are the key points?&quot;
              <br />
              &quot;Explain this in simple terms&quot;
            </div>
          ) : (
            messages.map((message, index) => (
              <div
                key={`${message.role}-${index}`}
                className={`rounded-2xl px-4 py-3 ${message.role === "user" ? "ml-auto max-w-[80%] bg-violet-600 text-white" : "max-w-[85%] border border-gray-200 bg-gray-50 text-gray-800 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"}`}
              >
                <p className="whitespace-pre-wrap text-sm leading-6">
                  {message.content}
                </p>
                {message.citations?.length ? (
                  <div className="mt-4 space-y-2 border-t border-gray-200 pt-3 text-xs text-gray-500 dark:border-gray-700 dark:text-gray-400">
                    {message.citations.map((citation) => (
                      <div key={citation.index} className="rounded-xl bg-white/60 p-3 dark:bg-black/10">
                        <p className="font-semibold text-gray-600 dark:text-gray-300">
                          Source [{citation.index}]
                        </p>
                        <p className="mt-1 whitespace-pre-wrap">
                          {citation.snippet}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            ))
          )}
          {sending ? (
            <div className="flex items-center gap-2 text-sm text-gray-400">
              <Loader2 className="h-4 w-4 animate-spin" />
              Thinking...
            </div>
          ) : null}
        </div>

        <form onSubmit={handleSubmit} className="mt-auto flex gap-3 pt-4">
          <input
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder={
              selectedDocument
                ? `Ask about ${selectedDocument.filename}`
                : "Choose a document to start"
            }
            disabled={!selectedDocument || sending}
            className="flex-1 rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-violet-500 dark:border-gray-700 dark:bg-gray-950"
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
