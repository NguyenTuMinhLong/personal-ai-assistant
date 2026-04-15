// app/(main)/layout.tsx
import { UserButton } from "@clerk/nextjs";
import { Sidebar } from "@/components/layout/Sidebar";

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-950">
      {/* Sidebar */}
      <Sidebar />

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="h-14 border-b bg-white dark:bg-gray-900 px-6 flex items-center justify-between">
          <h1 className="text-xl font-semibold text-gray-800 dark:text-gray-100">
            Personal AI Assistant
          </h1>
          <UserButton afterSignOutUrl="/" />
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
}