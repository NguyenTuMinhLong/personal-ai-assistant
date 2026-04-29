// components/GuestTrialPopup.tsx
"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

const PENDING_MIGRATION_KEY = "guest_pending_migration";

type GuestTrialPopupProps = {
  isOpen: boolean;
  onDismiss: () => void;
  anonymousId?: string | null;
};

export function GuestTrialPopup({ isOpen, onDismiss, anonymousId }: GuestTrialPopupProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onDismiss();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [isOpen, onDismiss]);

  if (!isOpen) return null;

  const handleSignUp = () => {
    if (anonymousId) {
      localStorage.setItem(PENDING_MIGRATION_KEY, anonymousId);
    }
    void router.push("/sign-up");
  };

  const handleSignIn = () => {
    if (anonymousId) {
      localStorage.setItem(PENDING_MIGRATION_KEY, anonymousId);
    }
    void router.push("/sign-in");
  };

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === overlayRef.current) onDismiss();
      }}
    >
      <div className="w-full max-w-md animate-in fade-in zoom-in-95 duration-200">
        <div className="relative overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-2xl dark:border-stone-700 dark:bg-stone-900">
          {/* Decorative top bar */}
          <div className="h-1.5 w-full bg-gradient-to-r from-amber-400 to-orange-500" />

          <div className="flex flex-col items-center gap-5 p-8 text-center">
            {/* Icon */}
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 shadow-sm dark:bg-amber-900/30">
              <svg
                className="h-7 w-7 text-amber-500"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z"
                />
              </svg>
            </div>

            <div className="flex flex-col gap-2">
              <h2 className="text-xl font-semibold text-stone-900 dark:text-stone-100">
                You've reached your trial limit
              </h2>
              <p className="text-sm text-stone-500 dark:text-stone-400">
                You've used all 10 free messages. Create a free account to
                continue chatting, upload documents, and get unlimited access.
              </p>
            </div>

            <div className="flex w-full flex-col gap-2.5">
              <button
                onClick={handleSignUp}
                className="w-full rounded-xl bg-amber-500 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-amber-600 active:scale-[0.98]"
              >
                Create Free Account
              </button>
              <button
                onClick={handleSignIn}
                className="w-full rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm font-medium text-stone-700 transition-colors hover:bg-stone-50 active:scale-[0.98] dark:border-stone-700 dark:bg-stone-800 dark:text-stone-300 dark:hover:bg-stone-700"
              >
                I Already Have an Account
              </button>
            </div>

            <p className="text-xs text-stone-400 dark:text-stone-500">
              Your guest data will be linked to your new account.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
