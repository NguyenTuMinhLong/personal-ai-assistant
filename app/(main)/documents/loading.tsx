export default function Loading() {
  return (
    <div className="mx-auto max-w-6xl animate-pulse">
      {/* Header skeleton */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <div className="mb-1 h-8 w-40 rounded-md bg-stone-200 dark:bg-stone-800" />
          <div className="h-4 w-64 rounded-md bg-stone-200 dark:bg-stone-800" />
        </div>
        <div className="h-9 w-28 rounded-lg bg-stone-200 dark:bg-stone-800" />
      </div>

      {/* Drop zone skeleton */}
      <div className="mb-8 rounded-xl border-2 border-dashed border-stone-200 p-6 dark:border-stone-700">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-stone-200 dark:bg-stone-800" />
          <div className="h-4 w-48 rounded-md bg-stone-200 dark:bg-stone-800" />
          <div className="h-3 w-64 rounded-md bg-stone-200 dark:bg-stone-800" />
        </div>
      </div>

      {/* Cards skeleton */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="overflow-hidden rounded-xl border border-stone-200 bg-stone-50 p-4 dark:border-stone-700 dark:bg-stone-900"
          >
            <div className="mb-2.5 flex items-start gap-2.5">
              <div className="h-9 w-9 rounded-lg bg-stone-200 dark:bg-stone-800" />
              <div className="flex-1">
                <div className="mb-1 h-4 w-3/4 rounded-md bg-stone-200 dark:bg-stone-800" />
                <div className="h-3 w-1/2 rounded-md bg-stone-200 dark:bg-stone-800" />
              </div>
            </div>

            <div className="mb-2.5 rounded-lg border border-stone-100 bg-white p-2.5 dark:border-stone-800 dark:bg-stone-800/50">
              <div className="mb-1 h-2.5 w-20 rounded-md bg-stone-200 dark:bg-stone-700" />
              <div className="mb-1 h-3 w-full rounded-md bg-stone-200 dark:bg-stone-700" />
              <div className="h-3 w-2/3 rounded-md bg-stone-200 dark:bg-stone-700" />
            </div>

            <div className="flex items-center gap-1.5">
              <div className="h-7 w-full rounded-lg bg-stone-200 dark:bg-stone-800" />
              <div className="h-7 w-7 rounded-lg bg-stone-200 dark:bg-stone-800" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
