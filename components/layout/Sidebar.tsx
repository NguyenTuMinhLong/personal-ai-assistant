// components/layout/Sidebar.tsx
"use client";

import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import {
  FileText,
  MessageSquare,
  Plus,
  Settings,
  Sparkles,
  Trash2,
  Loader2,
} from "lucide-react";
import { formatDistanceToNow, parseISO } from "date-fns";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useChatSessions } from "@/hooks/useChatSessions";

export function Sidebar() {
  const pathname = usePathname();
  const params = useParams();
  const router = useRouter();
  const documentId = params.documentId as string | undefined;
  const currentSessionId = params.sessionId as string | undefined;

  const { sessions, loading, refreshSessions } = useChatSessions(documentId);

  const handleDeleteSession = async (e: React.MouseEvent, sessionId: string, title: string) => {
    e.preventDefault();
    e.stopPropagation();

    if (!confirm(`Delete "${title}"? This cannot be undone.`)) return;

    try {
      const res = await fetch(`/api/sessions/${sessionId}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("Chat deleted");
        refreshSessions();
        // If currently viewing this session, redirect
        if (currentSessionId === sessionId) {
          router.push("/chat");
        }
      } else {
        throw new Error();
      }
    } catch {
      toast.error("Could not delete chat");
    }
  };

  const navLink = (
    href: string,
    icon: React.ReactNode,
    label: string,
    isActive: boolean,
  ) => {
    return (
      <Link
        href={href}
        className={`group flex items-center gap-3 rounded-xl px-4 py-2.5 font-medium transition-all duration-200
          ${
            isActive
              ? "bg-stone-200 text-stone-900 shadow-sm dark:bg-stone-800 dark:text-stone-100"
              : "text-stone-500 hover:bg-stone-100 hover:text-stone-800 dark:text-stone-500 dark:hover:bg-stone-800/70 dark:hover:text-stone-200"
          }`}
      >
        <span className={`transition-transform group-hover:scale-110 ${isActive ? "text-stone-700 dark:text-stone-200" : ""}`}>
          {icon}
        </span>
        {label}
        {isActive && (
          <span className="ml-auto h-1.5 w-1.5 rounded-full bg-stone-400 dark:bg-stone-500" />
        )}
      </Link>
    );
  };

  return (
    <div className="flex h-full w-64 flex-col border-r border-stone-200 bg-stone-50/80 dark:border-stone-800 dark:bg-stone-900/80 backdrop-blur-sm">
      {/* Logo */}
      <div className="border-b border-stone-200 p-5 dark:border-stone-800">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-stone-200 shadow-sm dark:bg-stone-800">
            <Sparkles className="h-4 w-4 text-stone-500 dark:text-stone-400" />
          </div>
          <div>
            <h2 className="text-base font-bold text-stone-800 dark:text-stone-100">
              Second<span className="text-stone-500 dark:text-stone-400">Brain</span>
            </h2>
            <p className="text-xs text-stone-400 dark:text-stone-500">
              Your personal AI assistant
            </p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-0.5 overflow-y-auto p-2.5">
        {navLink(
          "/documents",
          <FileText className="h-4 w-4" />,
          "Documents",
          pathname === "/documents",
        )}
        {navLink(
          "/chat",
          <MessageSquare className="h-4 w-4" />,
          "Chat",
          pathname === "/chat" || pathname.startsWith("/chat"),
        )}

        {/* Chat History Section */}
        {sessions.length > 0 && (
          <div className="mt-4">
            <div className="mb-1.5 flex items-center justify-between px-3">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-stone-400 dark:text-stone-600">
                Recent Chats
              </p>
              {documentId && (
                <Link
                  href={`/chat?documentId=${documentId}`}
                  className="flex h-5 w-5 items-center justify-center rounded-md text-stone-400 transition-all hover:bg-stone-200 hover:text-stone-600 dark:hover:bg-stone-800 dark:hover:text-stone-300"
                  title="New chat"
                >
                  <Plus className="h-3 w-3" />
                </Link>
              )}
            </div>
            <div className="space-y-0.5">
              {loading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <div
                    key={i}
                    className="mx-2 h-9 animate-pulse rounded-xl bg-stone-200/50 dark:bg-stone-800/50"
                  />
                ))
              ) : (
                sessions.slice(0, 8).map((session) => {
                  const isActive = currentSessionId === session.id;
                  const sessionUrl = `/chat?documentId=${session.document_id}&sessionId=${session.id}`;

                  return (
                    <div key={session.id} className="group relative flex flex-col rounded-xl px-3 py-2 transition-colors hover:bg-stone-200/50 dark:hover:bg-stone-800/40">
                      <Link
                        href={sessionUrl}
                        className={`absolute inset-0 rounded-xl transition-colors ${
                          isActive
                            ? "bg-stone-200/70 dark:bg-stone-800"
                            : ""
                        }`}
                      />
                      <button
                        onClick={(e) => handleDeleteSession(e, session.id, session.title)}
                        className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-md text-stone-400 opacity-0 transition-all hover:bg-red-100 hover:text-red-500 group-hover:opacity-100 dark:hover:bg-red-900/20 dark:hover:text-red-400"
                        title="Delete chat"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                      {session.document_name && (
                        <span className="truncate text-[10px] font-medium text-stone-400 dark:text-stone-500">
                          {session.document_name}
                        </span>
                      )}
                      <div className="flex items-center gap-1.5 pr-5">
                        <span className="truncate text-xs text-stone-600 dark:text-stone-400">
                          {session.title}
                        </span>
                        {session.updated_at && (
                          <span className="shrink-0 text-[10px] text-stone-400 dark:text-stone-600">
                            {formatDistanceToNow(parseISO(session.updated_at), { addSuffix: true })}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* New Chat shortcut - shown when no sessions or no document selected */}
        {(!sessions.length || !documentId) && (
          <Link
            href="/chat"
            className="mx-2 mt-3 flex items-center gap-2 rounded-xl bg-stone-200 px-3.5 py-2.5 text-xs font-semibold text-stone-600 transition-all hover:bg-stone-300 dark:bg-stone-800 dark:text-stone-400 dark:hover:bg-stone-700"
          >
            <Plus className="h-3.5 w-3.5" />
            New chat
          </Link>
        )}
      </nav>

      {/* Settings at bottom */}
      <div className="border-t border-stone-200 p-2.5 dark:border-stone-800">
        {navLink(
          "/settings",
          <Settings className="h-4 w-4" />,
          "Settings",
          pathname === "/settings",
        )}
      </div>
    </div>
  );
}
