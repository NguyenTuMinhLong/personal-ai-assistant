// components/TryFreeButton.tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { Upload, ArrowRight } from "lucide-react";
import { GuestTrialModal } from "@/components/GuestTrialModal";

export function TryFreeButton() {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setIsModalOpen(true)}
        className="group inline-flex items-center gap-2.5 rounded-xl bg-stone-900 px-8 py-4 text-base font-semibold text-white shadow-xl transition-all hover:bg-stone-800 hover:shadow-2xl hover:shadow-stone-900/20 hover:-translate-y-0.5 active:translate-y-0 dark:bg-stone-100 dark:text-stone-900 dark:hover:bg-stone-200"
      >
        <Upload className="h-5 w-5" />
        Try free now &mdash; 10 messages
        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
      </button>

      <GuestTrialModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </>
  );
}

export function TryFreeLink() {
  return (
    <Link
      href="/sign-up"
      className="inline-flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-8 py-4 text-base font-medium text-stone-700 backdrop-blur-sm transition-all hover:border-stone-300 hover:bg-stone-50 hover:shadow-lg dark:border-stone-700 dark:bg-stone-900 dark:text-stone-300 dark:hover:border-stone-600 dark:hover:bg-stone-800"
    >
      Create free account
    </Link>
  );
}
