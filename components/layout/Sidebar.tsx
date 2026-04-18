// components/layout/Sidebar.tsx
"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { FileText, MessageSquare, Plus, Settings } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useChatSessions } from "@/hooks/useChatSessions";

export function Sidebar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const documentId = searchParams.get("documentId") ?? undefined;
  const currentSessionId = searchParams.get("sessionId");

  const { sessions, loading } = useChatSessions(documentId);

  const navLink = (href: string, icon: React.ReactNode, label: string) => {
    const active = pathname.startsWith(href.split("?")[0]);
    return (
      <Link
        href={href}
        className={`flex items-center gap-3 rounded-2xl px-4 py-3 font-medium transition
          ${
            active
              ? "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300"
              : "text-gray-700 hover:bg-gray-100 dark:text-[#a0a0b0] dark:hover:bg-[#353b43]"
          }`}
      >
        {icon}
        {label}
      </Link>
    );
  };

  return (
    <div className="flex w-64 flex-col border-r border-gray-200 bg-white dark:border-[#353b43] dark:bg-[#25292f]">
      {/* Logo */}
      <div className="border-b border-gray-200 p-6 dark:border-[#353b43]">
        <h2 className="flex items-center gap-2 text-2xl font-bold text-gray-800 dark:text-[#f5f7fb]">
          <span className="text-violet-500">SB</span>
          SecondBrain
        </h2>
      </div>

      <nav className="flex-1 space-y-2 overflow-y-auto p-4">
        {navLink(
          "/documents",
          <FileText className="h-5 w-5" />,
          "Documents",
        )}
        {navLink("/chat", <MessageSquare className="h-5 w-5" />, "Chat")}

        {/* Chat History */}
        {sessions.length > 0 && (
          <div className="mt-2">
            <p className="mb-1 px-4 text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-600">
              Recent chats
            </p>
            <div className="space-y-0.5">
              {loading ? (
                // Skeleton
                Array.from({ length: 3 }).map((_, i) => (
                  <div
                    key={i}
                    className="mx-1 h-10 animate-pulse rounded-xl bg-gray-100 dark:bg-[#353b43]"
                  />
                ))
              ) : (
                sessions.map((session) => {
                  const isActive = currentSessionId === session.id;
                  const sessionUrl = `/chat?documentId=${session.document_ids}&sessionId=${session.id}`;

                  return (
                    <Link
                      key={session.id}
                      href={sessionUrl}
                      className={`flex flex-col rounded-xl px-4 py-2 transition
                        ${
                          isActive
                            ? "bg-violet-50 text-violet-700 dark:bg-violet-900/20 dark:text-violet-300"
                            : "text-gray-600 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-[#353b43]"
                        }`}
                    >
                      <span className="truncate text-sm font-medium">
                        {session.title}
                      </span>
                      <span className="text-xs text-gray-400 dark:text-gray-600">
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

        {/* New Chat shortcut */}
        {documentId && (
          <Link
            href={`/chat?documentId=${documentId}`}
            className="mt-2 flex items-center gap-2 rounded-xl px-4 py-2 text-sm text-violet-600 hover:bg-violet-50 dark:text-violet-400 dark:hover:bg-violet-900/20"
          >
            <Plus className="h-4 w-4" />
            New chat
          </Link>
        )}

        {navLink(
          "/settings",
          <Settings className="h-5 w-5" />,
          "Settings",
        )}
      </nav>
    </div>
  );
}