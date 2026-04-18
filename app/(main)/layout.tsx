// app/(main)/layout.tsx
import { UserButton } from "@clerk/nextjs";
import { Sidebar } from "@/components/layout/Sidebar";

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen bg-gray-50 dark:bg-[#25292f]">
      <Sidebar />

      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-16 items-center justify-between border-b border-gray-200 bg-white/90 px-6 backdrop-blur-sm dark:border-[#353b43] dark:bg-[#25292f]/95">
          <h1 className="text-xl font-semibold text-gray-800 dark:text-[#f5f7fb]">
            Personal AI Assistant
          </h1>
          <UserButton afterSignOutUrl="/" />
        </header>

        <main className="flex-1 overflow-auto px-6 py-7">{children}</main>
      </div>
    </div>
  );
}
