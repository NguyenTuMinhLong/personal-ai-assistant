"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import {
  FileText,
  Loader2,
  Search,
  X,
} from "lucide-react";
import { toast } from "sonner";
import type { GlobalSearchResult } from "@/types";

export default function SearchPage() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GlobalSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const handleSearch = useCallback(
    async (q: string) => {
      if (!q.trim()) return;

      setLoading(true);
      setSearched(true);

      try {
        const res = await fetch("/api/search/global", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: q }),
        });

        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error ?? "Search failed.");
        }

        setResults(data.results ?? []);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Search failed.";
        toast.error(msg);
        setResults([]);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSearch(query);
  };

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <header className="shrink-0 border-b border-stone-200 bg-stone-50 px-6 py-5 dark:border-stone-800 dark:bg-stone-900">
        <div className="mx-auto max-w-3xl">
          <h1 className="mb-4 text-xl font-bold text-stone-800 dark:text-stone-100">
            Global Search
          </h1>
          <form onSubmit={handleSubmit} className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleSearch(query);
                  }
                }}
                placeholder="Ask anything across all your documents..."
                className="w-full rounded-xl border border-stone-200 bg-white py-3 pl-11 pr-10 text-sm text-stone-900 placeholder:text-stone-400 focus:border-stone-400 focus:outline-none focus:ring-2 focus:ring-stone-200 dark:border-stone-700 dark:bg-stone-800 dark:text-white dark:placeholder:text-stone-500 dark:focus:border-stone-600 dark:focus:ring-stone-700"
                autoFocus
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-1 text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-700"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <button
              type="submit"
              disabled={loading || !query.trim()}
              className="flex items-center gap-2 rounded-xl bg-stone-900 px-5 py-3 text-sm font-medium text-white transition-all hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-stone-700 dark:hover:bg-stone-600"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}
              Search
            </button>
          </form>
        </div>
      </header>

      {/* Results */}
      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="mx-auto max-w-3xl">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-stone-400" />
              <span className="ml-3 text-sm text-stone-500">Searching all documents...</span>
            </div>
          ) : searched && results.length === 0 ? (
            <div className="py-20 text-center">
              <Search className="mx-auto mb-3 h-10 w-10 text-stone-300 dark:text-stone-600" />
              <p className="text-sm text-stone-500 dark:text-stone-400">
                No results found. Try different keywords.
              </p>
            </div>
          ) : !searched ? (
            <div className="py-20 text-center">
              <Search className="mx-auto mb-3 h-10 w-10 text-stone-300 dark:text-stone-600" />
              <p className="text-sm text-stone-500 dark:text-stone-400">
                Search across all your uploaded documents.
              </p>
              <p className="mt-1 text-xs text-stone-400 dark:text-stone-500">
                Results are ranked by relevance across all documents.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              <p className="text-xs text-stone-400 dark:text-stone-500">
                {results.length} document{results.length !== 1 ? "s" : ""} found
              </p>

              {results.map((doc) => (
                <div
                  key={doc.documentId}
                  className="rounded-xl border border-stone-200 bg-white dark:border-stone-700 dark:bg-stone-800 overflow-hidden"
                >
                  {/* Document header */}
                  <button
                    type="button"
                    onClick={() => router.push(`/chat?documentId=${doc.documentId}`)}
                    className="flex w-full items-center gap-3 px-5 py-4 text-left transition-colors hover:bg-stone-50 dark:hover:bg-stone-700/50"
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-stone-100 dark:bg-stone-700">
                      <FileText className="h-4 w-4 text-stone-500 dark:text-stone-400" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-stone-800 dark:text-stone-100">
                        {doc.documentName}
                      </p>
                      <p className="text-xs text-stone-400 dark:text-stone-500">
                        {doc.chunks.length} relevant chunk{doc.chunks.length !== 1 ? "s" : ""}
                      </p>
                    </div>
                    <span className="shrink-0 rounded-full bg-stone-100 px-2.5 py-1 text-[10px] font-medium text-stone-500 dark:bg-stone-700 dark:text-stone-400">
                      {Math.round(doc.totalScore * 100)}% match
                    </span>
                  </button>

                  {/* Chunks */}
                  <div className="border-t border-stone-100 px-5 py-3 dark:border-stone-700">
                    <div className="space-y-2">
                      {doc.chunks.map((chunk, idx) => (
                        <div
                          key={idx}
                          className="rounded-lg border border-stone-100 bg-stone-50 p-3 dark:border-stone-700 dark:bg-stone-900/50"
                        >
                          <p className="text-xs text-stone-500 dark:text-stone-400 mb-1.5 flex items-center gap-2">
                            <span className="inline-flex h-4 w-4 items-center justify-center rounded bg-stone-200 text-[9px] font-bold text-stone-500 dark:bg-stone-700 dark:text-stone-400">
                              {idx + 1}
                            </span>
                            {chunk.metadata.title && (
                              <span className="font-medium text-stone-600 dark:text-stone-300">
                                {chunk.metadata.title}
                              </span>
                            )}
                            {chunk.metadata.section && (
                              <span className="text-stone-400">/ {chunk.metadata.section}</span>
                            )}
                          </p>
                          <p className="line-clamp-3 text-sm text-stone-700 dark:text-stone-300">
                            {chunk.content}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
