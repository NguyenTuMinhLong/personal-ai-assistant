// components/chat/GuestTrialBanner.tsx
"use client";

import { Sparkles } from "lucide-react";

type GuestTrialBannerProps = {
  messagesRemaining: number;
  totalLimit: number;
  uploadUsed: boolean;
  onSignUp: () => void;
};

export function GuestTrialBanner({
  messagesRemaining,
  totalLimit,
  uploadUsed,
  onSignUp,
}: GuestTrialBannerProps) {
  const isLow = messagesRemaining <= 3;
  const barPercent = (messagesRemaining / totalLimit) * 100;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-2 px-4 pt-4">
      <div className="flex items-center justify-between rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-800 dark:bg-amber-900/20">
        <div className="flex items-center gap-3">
          <Sparkles className="h-4 w-4 shrink-0 text-amber-500" />
          <div className="flex flex-col gap-0.5">
            <p className="text-sm font-medium text-amber-700 dark:text-amber-300">
              Guest Trial &middot; {messagesRemaining}/{totalLimit} messages left
            </p>
            <p className="text-xs text-amber-600 dark:text-amber-400">
              {uploadUsed
                ? "1 file/image already uploaded."
                : "You can upload 1 file or image."}
            </p>
          </div>
        </div>
        <button
          onClick={onSignUp}
          className="shrink-0 rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-amber-600"
        >
          Sign Up Free
        </button>
      </div>

      {/* Progress bar */}
      <div className="h-1 w-full overflow-hidden rounded-full bg-stone-200 dark:bg-stone-700">
        <div
          className={`h-full rounded-full transition-all duration-500 ${
            isLow ? "bg-amber-400" : "bg-amber-300"
          }`}
          style={{ width: `${barPercent}%` }}
        />
      </div>
    </div>
  );
}
