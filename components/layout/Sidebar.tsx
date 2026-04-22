// components/layout/Sidebar.tsx
"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  FileText,
  MessageSquare,
  Plus,
  Settings,
  Sparkles,
  ChevronRight,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useChatSessions } from "@/hooks/useChatSessions";

export function Sidebar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const documentId = searchParams.get("documentId") ?? undefined;
  const currentSessionId = searchParams.get("sessionId");

  const { sessions, loading } = useChatSessions(documentId);

  const navLink = (
    href: string,
    icon: React.ReactNode,
    label: string,
    isActive: boolean,
  ) => {
    return (
      <Link
        href={href}
        className={`group flex items-center gap-3 rounded-xl px-4 py-3 font-medium transition-all duration-200
          ${
            isActive
              ? "bg-gradient-to-r from-violet-500/10 to-fuchsia-500/10 text-violet-600 dark:from-violet-500/20 dark:to-fuchsia-500/20 dark:text-violet-400"
              : "text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-[#2a2d38] dark:hover:text-white"
          }`}
      >
        <span
          className={`transition-transform duration-200 group-hover:scale-110 ${
            isActive ? "text-violet-600 dark:text-violet-400" : ""
          }`}
        >
          {icon}
        </span>
        {label}
        {isActive && (
          <ChevronRight className="ml-auto h-4 w-4 text-violet-500" />
        )}
      </Link>
    );
  };

  return (
    <div className="flex h-full w-64 flex-col border-r border-gray-100 bg-white dark:border-violet-900/20 dark:bg-[#1a1c24]">
      {/* Logo */}
      <div className="border-b border-gray-100 p-5 dark:border-violet-900/20">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 shadow-lg shadow-violet-500/25">
            <Sparkles className="h-5 w-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">
              Second<span className="text-violet-600">Brain</span>
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-500">
              AI Document Assistant
            </p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 overflow-y-auto p-4">
        {navLink(
          "/documents",
          <FileText className="h-5 w-5" />,
          "Documents",
          pathname === "/documents",
        )}
        {navLink(
          "/chat",
          <MessageSquare className="h-5 w-5" />,
          "Chat",
          pathname === "/chat" || pathname.startsWith("/chat"),
        )}

        {/* Chat History Section */}
        {sessions.length > 0 && (
          <div className="mt-6">
            <div className="mb-2 flex items-center justify-between px-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-600">
                Recent chats
              </p>
              {documentId && (
                <Link
                  href={`/chat?documentId=${documentId}`}
                  className="flex h-6 w-6 items-center justify-center rounded-lg bg-violet-100 text-violet-600 transition-colors hover:bg-violet-200 dark:bg-violet-500/20 dark:text-violet-400 dark:hover:bg-violet-500/30"
                  title="New chat"
                >
                  <Plus className="h-3.5 w-3.5" />
                </Link>
              )}
            </div>
            <div className="space-y-1">
              {loading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <div
                    key={i}
                    className="mx-2 h-12 animate-pulse rounded-xl bg-gray-100 dark:bg-[#23262f]"
                  />
                ))
              ) : (
                sessions.slice(0, 8).map((session) => {
                  const isActive = currentSessionId === session.id;
                  const sessionUrl = `/chat?documentId=${session.document_ids}&sessionId=${session.id}`;

                  return (
                    <Link
                      key={session.id}
                      href={sessionUrl}
                      className={`group flex flex-col rounded-xl px-4 py-3 transition-all duration-200
                        ${
                          isActive
                            ? "bg-gradient-to-r from-violet-500/10 to-fuchsia-500/10 border border-violet-200/50 dark:border-violet-500/30"
                            : "hover:bg-gray-50 dark:hover:bg-[#2a2d38]"
                        }`}
                    >
                      <span className="truncate text-sm font-medium text-gray-700 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-white">
                        {session.title}
                      </span>
                      <span className="mt-0.5 text-xs text-gray-400 dark:text-gray-600">
                        {formatDistanceToNow(new Date(session.updated_at), {
                          addSuffix: true,
                        })}
                      </span>
                    </Link>
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
            className="mt-4 flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-500 to-fuchsia-500 px-4 py-3 text-sm font-medium text-white shadow-lg shadow-violet-500/25 transition-all hover:shadow-xl hover:shadow-violet-500/30"
          >
            <Plus className="h-4 w-4" />
            New chat
          </Link>
        )}
      </nav>

      {/* Settings at bottom */}
      <div className="border-t border-gray-100 p-4 dark:border-violet-900/20">
        {navLink(
          "/settings",
          <Settings className="h-5 w-5" />,
          "Settings",
          pathname === "/settings",
        )}
      </div>
    </div>
  );
}
