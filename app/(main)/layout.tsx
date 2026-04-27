// app/(main)/layout.tsx
import { UserButton } from "@clerk/nextjs";
import { SidebarWrapper } from "@/components/layout/SidebarWrapper";
import { ErrorBoundary } from "@/components/ErrorBoundary";

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen bg-stone-100 dark:bg-stone-950">
      <SidebarWrapper />

      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-14 items-center justify-between border-b border-stone-200 bg-white/90 px-6 pl-16 max-md:pl-4 backdrop-blur-sm dark:border-stone-800 dark:bg-stone-900/90">
          <div className="flex items-center gap-3">
            <div className="h-px flex-1" />
          </div>
          <UserButton
            appearance={{
              elements: {
                avatarBox: "h-8 w-8",
              },
            }}
          />
        </header>

        <main className="flex-1 overflow-auto px-6 py-6 max-md:px-4 max-md:py-4">
          <ErrorBoundary>
            {children}
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
}
