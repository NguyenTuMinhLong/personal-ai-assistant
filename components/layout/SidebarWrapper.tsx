"use client";

import { useState } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { Menu, X } from "lucide-react";

export function SidebarWrapper() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      {/* Mobile hamburger button */}
      <button
        onClick={() => setMobileOpen(true)}
        className="fixed left-3 top-4 z-50 hidden max-[768px]:flex max-[768px]:items-center max-[768px]:justify-center max-[768px]:h-9 max-[768px]:w-9 max-[768px]:rounded-lg max-[768px]:border max-[768px]:border-stone-200 max-[768px]:bg-white max-[768px]:shadow-sm max-[768px]:dark:border-stone-700 max-[768px]:dark:bg-stone-900"
        aria-label="Open menu"
      >
        <Menu className="h-4 w-4 text-stone-600 dark:text-stone-300" />
      </button>

      {/* Mobile backdrop with blur */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm max-[768px]:block"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile sidebar - slides in from left */}
      <div
        className={`fixed inset-y-0 left-0 z-50 transition-transform duration-300 ease-out max-[768px]:flex max-[768px]:flex-col ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        } max-[768px]:w-72 max-[768px]:shadow-2xl`}
      >
        <Sidebar />

        {/* Mobile close button */}
        <button
          onClick={() => setMobileOpen(false)}
          className="absolute right-2.5 top-2.5 flex h-7 w-7 items-center justify-center rounded-lg text-stone-400 transition-colors hover:bg-stone-200 hover:text-stone-600 dark:hover:bg-stone-700 dark:hover:text-stone-200 max-[768px]:flex md:hidden"
          aria-label="Close menu"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Desktop sidebar always visible */}
      <div className="hidden md:block">
        <Sidebar />
      </div>
    </>
  );
}
