// components/layout/Sidebar.tsx
import Link from "next/link";
import { FileText, MessageSquare, Settings } from "lucide-react";

export function Sidebar() {
  return (
    <div className="w-64 bg-white dark:bg-gray-900 border-r flex flex-col">
      <div className="p-6 border-b">
        <h2 className="text-2xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
          <span className="text-violet-600">🧠</span>
          SecondBrain
        </h2>
      </div>

      <nav className="flex-1 p-4 space-y-2">
        <Link
          href="/documents"
          className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 font-medium"
        >
          <FileText className="w-5 h-5" />
          Documents
        </Link>

        <Link
          href="/chat"
          className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 font-medium"
        >
          <MessageSquare className="w-5 h-5" />
          Chat
        </Link>

        <Link
          href="/settings"
          className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 font-medium"
        >
          <Settings className="w-5 h-5" />
          Settings
        </Link>
      </nav>

      <div className="p-4 border-t text-xs text-gray-500 dark:text-gray-400">
        Free Tier • Supabase + OpenAI
      </div>
    </div>
  );
}