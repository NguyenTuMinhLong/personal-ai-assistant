import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { Toaster } from "sonner";

import { ThemeToggle } from "@/components/theme/ThemeToggle";
import "./globals.css";

export const metadata: Metadata = {
  title: "Personal AI Assistant",
  description: "Your personal second-brain knowledge base",
};

const themeScript = `
(function () {
  try {
    var theme = localStorage.getItem("secondbrain-theme") === "dark" ? "dark" : "light";
    document.documentElement.classList.toggle("dark", theme === "dark");
    document.documentElement.style.colorScheme = theme;
  } catch (error) {}
})();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html lang="vi" suppressHydrationWarning>
        <body>
          <script dangerouslySetInnerHTML={{ __html: themeScript }} />
          <div className="fixed right-4 top-4 z-50">
            <ThemeToggle />
          </div>
          {children}
          <Toaster position="top-right" richColors />
        </body>
      </html>
    </ClerkProvider>
  );
}
