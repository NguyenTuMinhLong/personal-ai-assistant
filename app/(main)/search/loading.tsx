export default function Loading() {
  return (
    <div className="flex h-full flex-col">
      {/* Header skeleton */}
      <header className="shrink-0 border-b border-stone-200 bg-stone-50 px-4 py-4 dark:border-stone-800 dark:bg-stone-900 md:px-6 md:py-5">
        <div className="mx-auto max-w-3xl">
          <div className="mb-4 h-6 w-40 rounded-md bg-stone-200 dark:bg-stone-800 md:h-7" />
          <div className="flex gap-2">
            <div className="relative flex-1">
              <div className="h-11 w-full rounded-xl border border-stone-200 bg-stone-100 dark:border-stone-700 dark:bg-stone-800" />
            </div>
            <div className="h-11 w-24 rounded-xl bg-stone-200 dark:bg-stone-800" />
          </div>
        </div>
      </header>

      {/* Content skeleton */}
      <div className="flex-1 overflow-y-auto px-4 py-4 md:px-6 md:py-6">
        <div className="mx-auto max-w-3xl space-y-4">
          {/* Placeholder search hint */}
          <div className="py-20 text-center">
            <div className="mx-auto mb-3 h-10 w-10 rounded-full bg-stone-200 dark:bg-stone-800" />
            <div className="mx-auto mb-2 h-4 w-64 rounded-md bg-stone-200 dark:bg-stone-800" />
            <div className="mx-auto h-3 w-48 rounded-md bg-stone-200 dark:bg-stone-800" />
          </div>

          {/* Result placeholders (hidden initially) */}
          {[...Array(2)].map((_, i) => (
            <div
              key={i}
              className="rounded-xl border border-stone-200 bg-white dark:border-stone-700 dark:bg-stone-800 overflow-hidden"
            >
              <div className="flex items-center gap-3 px-5 py-4">
                <div className="h-9 w-9 shrink-0 rounded-lg bg-stone-200 dark:bg-stone-700" />
                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="h-4 w-40 rounded-md bg-stone-200 dark:bg-stone-700" />
                  <div className="h-3 w-24 rounded-md bg-stone-200 dark:bg-stone-700" />
                </div>
                <div className="h-6 w-16 rounded-full bg-stone-200 dark:bg-stone-700" />
              </div>
              <div className="border-t border-stone-100 px-5 py-3 dark:border-stone-700 space-y-2">
                {[...Array(2)].map((_, j) => (
                  <div key={j} className="rounded-lg border border-stone-100 bg-stone-50 p-3 dark:border-stone-700 dark:bg-stone-900/50 space-y-1.5">
                    <div className="h-3 w-32 rounded-md bg-stone-200 dark:bg-stone-700" />
                    <div className="h-3 w-full rounded-md bg-stone-200 dark:bg-stone-700" />
                    <div className="h-3 w-3/4 rounded-md bg-stone-200 dark:bg-stone-700" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
