export default function Loading() {
  return (
    <div className="flex h-full flex-col">
      {/* Header skeleton */}
      <div className="mb-4 flex items-center gap-4">
        <div className="h-5 w-32 rounded-md bg-stone-200 dark:bg-stone-800" />
        <div className="ml-auto h-5 w-20 rounded-md bg-stone-200 dark:bg-stone-800" />
      </div>

      {/* Message bubbles skeleton */}
      <div className="flex-1 space-y-6">
        {/* User message */}
        <div className="flex justify-end">
          <div className="max-w-md rounded-2xl rounded-tr-md bg-stone-200 px-4 py-3 dark:bg-stone-800">
            <div className="h-4 w-48 rounded-md bg-stone-300 dark:bg-stone-700" />
          </div>
        </div>

        {/* Assistant message */}
        <div className="flex justify-start">
          <div className="max-w-md rounded-2xl rounded-tl-md bg-stone-100 px-4 py-3 dark:bg-stone-800/80">
            <div className="mb-1.5 h-4 w-full rounded-md bg-stone-300 dark:bg-stone-700" />
            <div className="mb-1.5 h-4 w-5/6 rounded-md bg-stone-300 dark:bg-stone-700" />
            <div className="h-4 w-3/4 rounded-md bg-stone-300 dark:bg-stone-700" />
          </div>
        </div>

        {/* User message */}
        <div className="flex justify-end">
          <div className="max-w-md rounded-2xl rounded-tr-md bg-stone-200 px-4 py-3 dark:bg-stone-800">
            <div className="h-4 w-36 rounded-md bg-stone-300 dark:bg-stone-700" />
          </div>
        </div>

        {/* Assistant message */}
        <div className="flex justify-start">
          <div className="max-w-md rounded-2xl rounded-tl-md bg-stone-100 px-4 py-3 dark:bg-stone-800/80">
            <div className="mb-1.5 h-4 w-full rounded-md bg-stone-300 dark:bg-stone-700" />
            <div className="mb-1.5 h-4 w-4/5 rounded-md bg-stone-300 dark:bg-stone-700" />
            <div className="h-4 w-2/3 rounded-md bg-stone-300 dark:bg-stone-700" />
          </div>
        </div>

        {/* Typing indicator */}
        <div className="flex justify-start">
          <div className="flex items-center gap-1.5 rounded-2xl rounded-tl-md bg-stone-100 px-4 py-3 dark:bg-stone-800/80">
            <div className="h-2 w-2 animate-pulse rounded-full bg-stone-400 dark:bg-stone-600" />
            <div className="h-2 w-2 animate-pulse rounded-full bg-stone-400 dark:bg-stone-600 [animation-delay:200ms]" />
            <div className="h-2 w-2 animate-pulse rounded-full bg-stone-400 dark:bg-stone-600 [animation-delay:400ms]" />
          </div>
        </div>
      </div>

      {/* Input skeleton */}
      <div className="mt-4 flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-4 py-3 dark:border-stone-700 dark:bg-stone-900">
        <div className="h-9 flex-1 rounded-lg bg-stone-100 dark:bg-stone-800" />
        <div className="h-9 w-9 rounded-lg bg-stone-200 dark:bg-stone-800" />
      </div>
    </div>
  );
}
