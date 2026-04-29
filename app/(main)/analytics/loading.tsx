export default function Loading() {
  return (
    <div className="flex h-full flex-col overflow-y-auto">
      {/* Header skeleton */}
      <div className="shrink-0 border-b border-stone-200 bg-stone-50 px-4 py-4 dark:border-stone-800 dark:bg-stone-900 md:px-6 md:py-5">
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="h-5 w-40 rounded-md bg-stone-200 dark:bg-stone-800 md:h-6 md:w-48" />
            <div className="h-3 w-64 rounded-md bg-stone-200 dark:bg-stone-800 md:h-4" />
          </div>
          <div className="h-8 w-24 rounded-lg bg-stone-200 dark:bg-stone-800" />
        </div>
      </div>

      {/* Content skeleton */}
      <div className="flex-1 px-4 py-4 md:px-6 md:py-6">
        <div className="mx-auto max-w-4xl space-y-4 md:space-y-6">
          {/* Stats grid skeleton */}
          <div className="grid grid-cols-2 gap-3 md:gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="rounded-xl border border-stone-200 bg-white p-4 dark:border-stone-700 dark:bg-stone-800">
                <div className="mb-3 h-10 w-10 rounded-lg bg-stone-200 dark:bg-stone-700" />
                <div className="mb-1 h-6 w-16 rounded-md bg-stone-200 dark:bg-stone-700" />
                <div className="h-3 w-20 rounded-md bg-stone-200 dark:bg-stone-700" />
              </div>
            ))}
          </div>

          {/* Charts row skeleton */}
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-xl border border-stone-200 bg-white p-5 dark:border-stone-700 dark:bg-stone-800">
              <div className="mb-4 h-4 w-36 rounded-md bg-stone-200 dark:bg-stone-700" />
              <div className="mb-4 flex items-center gap-3">
                <div className="h-6 w-10 rounded-md bg-stone-200 dark:bg-stone-700" />
                <div className="flex-1" />
                <div className="h-6 w-10 rounded-md bg-stone-200 dark:bg-stone-700" />
              </div>
              <div className="h-3 w-full rounded-full bg-stone-200 dark:bg-stone-700" />
            </div>

            <div className="rounded-xl border border-stone-200 bg-white p-5 dark:border-stone-700 dark:bg-stone-800">
              <div className="mb-4 h-4 w-32 rounded-md bg-stone-200 dark:bg-stone-700" />
              <div className="flex items-end gap-1" style={{ height: 80 }}>
                {[...Array(7)].map((_, i) => (
                  <div
                    key={i}
                    className="flex-1 rounded-sm bg-stone-200 dark:bg-stone-700 animate-pulse"
                    style={{ height: `${20 + Math.random() * 60}%` }}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Summary skeleton */}
          <div className="rounded-xl border border-stone-200 bg-white p-5 dark:border-stone-700 dark:bg-stone-800">
            <div className="mb-4 h-4 w-24 rounded-md bg-stone-200 dark:bg-stone-700" />
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {[...Array(4)].map((_, i) => (
                <div key={i}>
                  <div className="mb-1 h-6 w-12 rounded-md bg-stone-200 dark:bg-stone-700" />
                  <div className="h-3 w-20 rounded-md bg-stone-200 dark:bg-stone-700" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
