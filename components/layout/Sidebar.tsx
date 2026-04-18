// components/layout/Sidebar.tsx
import Link from "next/link";
import { FileText, MessageSquare, Settings } from "lucide-react";

export function Sidebar() {
  return (
    <div className="flex w-64 flex-col border-r border-gray-200 bg-white dark:border-[#353b43] dark:bg-[#25292f]">
      <div className="border-b border-gray-200 p-6 dark:border-[#353b43]">
        <h2 className="flex items-center gap-2 text-2xl font-bold text-gray-800 dark:text-[#f5f7fb]">
          <span className="text-violet-500">SB</span>
          SecondBrain
        </h2>
      </div>

      <nav className="flex-1 space-y-2 p-4">
        <Link
          href="/documents"
          className="flex items-center gap-3 rounded-2xl px-4 py-3 font-medium text-gray-700 transition hover:bg-gray-100 dark:text-[#d6dae3] dark:hover:bg-[#323840]"
        >
          <FileText className="h-5 w-5" />
          Documents
        </Link>

        <Link
          href="/chat"
          className="flex items-center gap-3 rounded-2xl px-4 py-3 font-medium text-gray-700 transition hover:bg-gray-100 dark:text-[#d6dae3] dark:hover:bg-[#323840]"
        >
          <MessageSquare className="h-5 w-5" />
          Chat
        </Link>

        <Link
          href="/settings"
          className="flex items-center gap-3 rounded-2xl px-4 py-3 font-medium text-gray-700 transition hover:bg-gray-100 dark:text-[#d6dae3] dark:hover:bg-[#323840]"
        >
          <Settings className="h-5 w-5" />
          Settings
        </Link>
      </nav>

      <div className="border-t border-gray-200 p-4 text-xs text-gray-500 dark:border-[#353b43] dark:text-[#9fa6b2]">
        Free Tier • Supabase + OpenAI
      </div>
    </div>
  );
}