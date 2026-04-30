// components/TrialFeedback.tsx
"use client";

import { useState } from "react";
import { ThumbsUp, ThumbsDown, Loader2 } from "lucide-react";
import { toast } from "sonner";

type TrialFeedbackProps = {
  messageCount: number;
  totalLimit: number;
  onDismiss: () => void;
};

export function TrialFeedback({ messageCount, totalLimit, onDismiss }: TrialFeedbackProps) {
  const [feedback, setFeedback] = useState<"up" | "down" | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const showFeedback = messageCount >= totalLimit - 2 && messageCount < totalLimit;

  if (!showFeedback || submitted) return null;

  const handleFeedback = async (vote: "up" | "down") => {
    setFeedback(vote);
    setSubmitting(true);

    try {
      // Track feedback (could send to analytics)
      console.log("[trial] User feedback:", vote);
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 500));
      
      setSubmitted(true);
      toast.success("Thanks for your feedback!");
      onDismiss();
    } catch (error) {
      toast.error("Failed to submit feedback");
      setFeedback(null);
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-2 px-4 pb-4">
      <div className="flex items-center justify-between rounded-xl border border-stone-200 bg-white px-4 py-3 dark:border-stone-700 dark:bg-stone-900">
        <div className="flex flex-col gap-1">
          <p className="text-sm font-medium text-stone-700 dark:text-stone-200">
            How is your experience so far?
          </p>
          <p className="text-xs text-stone-500 dark:text-stone-400">
            {totalLimit - messageCount} messages remaining. Help us improve!
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => handleFeedback("down")}
            disabled={submitting}
            className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-all ${
              feedback === "down"
                ? "border-red-300 bg-red-50 text-red-600 dark:border-red-700 dark:bg-red-900/30 dark:text-red-400"
                : "border-stone-200 text-stone-500 hover:border-red-200 hover:text-red-500 dark:border-stone-700 dark:text-stone-400 dark:hover:border-red-500/30 dark:hover:text-red-400"
            }`}
          >
            {submitting && feedback === "down" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <ThumbsDown className="h-3.5 w-3.5" />
            )}
            Not great
          </button>

          <button
            onClick={() => handleFeedback("up")}
            disabled={submitting}
            className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-all ${
              feedback === "up"
                ? "border-emerald-300 bg-emerald-50 text-emerald-600 dark:border-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                : "border-stone-200 text-stone-500 hover:border-emerald-200 hover:text-emerald-500 dark:border-stone-700 dark:text-stone-400 dark:hover:border-emerald-500/30 dark:hover:text-emerald-400"
            }`}
          >
            {submitting && feedback === "up" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <ThumbsUp className="h-3.5 w-3.5" />
            )}
            Great!
          </button>
        </div>
      </div>
    </div>
  );
}
