"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  BarChart3,
  BookOpen,
  Loader2,
  MessageSquare,
  RefreshCw,
  ThumbsDown,
  ThumbsUp,
  TrendingUp,
  Zap,
} from "lucide-react";

type AnalyticsStats = {
  totalQueries: number;
  totalDocuments: number;
  totalSessions: number;
  totalMessages: number;
  totalFeedback: number;
  totalUpvotes: number;
  totalDownvotes: number;
  feedbackScore: number;
  cacheHitRate: number;
  avgLatencyMs: number | null;
};

type DailyQuery = { date: string; count: number };

type AnalyticsData = {
  stats: AnalyticsStats;
  queriesPerDay: DailyQuery[];
  generatedAt: string;
};

function StatCard({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  sub?: string;
}) {
  return (
    <div className="rounded-xl border border-stone-200 bg-white p-5 dark:border-stone-700 dark:bg-stone-800">
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-stone-100 dark:bg-stone-700">
        {icon}
      </div>
      <p className="mb-1 text-2xl font-bold text-stone-800 dark:text-stone-100">
        {typeof value === "number" ? value.toLocaleString() : value}
      </p>
      <p className="text-sm font-medium text-stone-600 dark:text-stone-400">{label}</p>
      {sub && (
        <p className="mt-0.5 text-xs text-stone-400 dark:text-stone-500">{sub}</p>
      )}
    </div>
  );
}

function SimpleBarChart({ data }: { data: DailyQuery[] }) {
  if (!data || data.length === 0) {
    return <p className="text-xs text-stone-400">No data available yet.</p>;
  }

  const max = Math.max(...data.map(d => d.count), 1);
  const last7 = data.slice(-7);

  return (
    <div className="space-y-1">
      <div className="flex items-end gap-1" style={{ height: 80 }}>
        {last7.map((d) => {
          const height = Math.max(4, Math.round((d.count / max) * 80));
          return (
            <div
              key={d.date}
              className="flex-1 rounded-sm bg-stone-300 dark:bg-stone-600 transition-all hover:bg-stone-400 dark:hover:bg-stone-500 relative group"
              style={{ height }}
              title={`${d.date}: ${d.count} query${d.count !== 1 ? "s" : ""}`}
            />
          );
        })}
      </div>
      <div className="flex gap-1">
        {last7.map((d) => (
          <div key={d.date} className="flex-1 text-center">
            <p className="text-[9px] text-stone-400 dark:text-stone-500">
              {d.date.slice(5)}
            </p>
          </div>
        ))}
      </div>
      <p className="text-[10px] text-stone-400 dark:text-stone-500">
        Last 7 days — {data.reduce((sum, d) => sum + d.count, 0)} total queries
      </p>
    </div>
  );
}

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const fetchCountRef = useRef(0);

  const fetchData = useCallback(async () => {
    const fetchId = ++fetchCountRef.current;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/analytics");
      if (!res.ok) throw new Error((await res.json()).error ?? "Failed to load");
      const json = await res.json();
      if (fetchId === fetchCountRef.current) {
        setData(json);
        setLastUpdated(new Date());
      }
    } catch (err) {
      if (fetchId === fetchCountRef.current) {
        setError(err instanceof Error ? err.message : "Failed to load analytics");
      }
    } finally {
      if (fetchId === fetchCountRef.current) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Refresh when user returns to the tab
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        fetchData();
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [fetchData]);

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      {/* Header */}
      <header className="shrink-0 border-b border-stone-200 bg-stone-50 px-6 py-5 dark:border-stone-800 dark:bg-stone-900">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-stone-800 dark:text-stone-100">
              Usage Analytics
            </h1>
            <p className="mt-0.5 text-sm text-stone-500 dark:text-stone-400">
              Track your SecondBrain activity and AI usage
            </p>
          </div>
          <button
            onClick={fetchData}
            disabled={loading}
            className="flex items-center gap-2 rounded-lg border border-stone-200 bg-white px-3 py-2 text-xs font-medium text-stone-600 transition-all hover:bg-stone-50 disabled:opacity-50 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-400 dark:hover:bg-stone-700"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </header>

      <div className="flex-1 px-6 py-6">
        {loading && !data ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-stone-400" />
            <span className="ml-3 text-sm text-stone-500">Loading analytics...</span>
          </div>
        ) : error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center dark:border-red-900/40 dark:bg-red-900/20">
            <p className="text-sm font-medium text-red-700 dark:text-red-300">{error}</p>
            <button
              onClick={fetchData}
              className="mt-3 rounded-lg bg-red-100 px-4 py-2 text-xs font-medium text-red-700 transition-colors hover:bg-red-200 dark:bg-red-900/40 dark:text-red-300 dark:hover:bg-red-900/60"
            >
              Try again
            </button>
          </div>
        ) : data ? (
          <div className="mx-auto max-w-4xl space-y-6">
            {/* Empty state hint */}
            {data.stats.totalQueries === 0 && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800 dark:border-amber-900/40 dark:bg-amber-900/20 dark:text-amber-300">
                <strong>No data yet.</strong> Start asking questions in the Chat tab — your activity will appear here automatically.
              </div>
            )}

            {/* Top stats grid */}
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
              <StatCard
                icon={<MessageSquare className="h-5 w-5 text-stone-500" />}
                label="Total Queries"
                value={data.stats.totalQueries}
              />
              <StatCard
                icon={<BookOpen className="h-5 w-5 text-stone-500" />}
                label="Documents"
                value={data.stats.totalDocuments}
              />
              <StatCard
                icon={<BarChart3 className="h-5 w-5 text-stone-500" />}
                label="Chat Sessions"
                value={data.stats.totalSessions}
              />
              <StatCard
                icon={<TrendingUp className="h-5 w-5 text-stone-500" />}
                label="Avg Latency"
                value={data.stats.avgLatencyMs != null ? `${data.stats.avgLatencyMs}ms` : "—"}
                sub={data.stats.avgLatencyMs != null ? "per query" : "No data yet"}
              />
              <StatCard
                icon={<Zap className="h-5 w-5 text-stone-500" />}
                label="Cache Hit Rate"
                value={`${data.stats.cacheHitRate}%`}
                sub="cached responses"
              />
            </div>

            {/* Feedback + Chart row */}
            <div className="grid gap-4 lg:grid-cols-2">
              {/* Feedback breakdown */}
              <div className="rounded-xl border border-stone-200 bg-white p-5 dark:border-stone-700 dark:bg-stone-800">
                <h2 className="mb-4 text-sm font-semibold text-stone-700 dark:text-stone-200">
                  AI Response Feedback
                </h2>

                <div className="mb-4 flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <ThumbsUp className="h-4 w-4 text-emerald-500" />
                    <span className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
                      {data.stats.totalUpvotes}
                    </span>
                  </div>
                  <div className="flex-1" />
                  <div className="flex items-center gap-2">
                    <ThumbsDown className="h-4 w-4 text-red-400" />
                    <span className="text-xl font-bold text-red-500 dark:text-red-400">
                      {data.stats.totalDownvotes}
                    </span>
                  </div>
                </div>

                <div className="h-3 w-full overflow-hidden rounded-full bg-stone-100 dark:bg-stone-700">
                  {data.stats.totalFeedback > 0 ? (
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-red-400 transition-all"
                      style={{
                        width: `${(data.stats.totalUpvotes / data.stats.totalFeedback) * 100}%`,
                      }}
                    />
                  ) : (
                    <div className="h-full rounded-full bg-stone-200 dark:bg-stone-600" style={{ width: "50%" }} />
                  )}
                </div>

                <div className="mt-3 flex items-center justify-between text-xs text-stone-400 dark:text-stone-500">
                  <span>Helpful</span>
                  <span className={`font-medium ${data.stats.feedbackScore >= 0 ? "text-emerald-500" : "text-red-500"}`}>
                    Net score: {data.stats.feedbackScore >= 0 ? "+" : ""}{data.stats.feedbackScore}
                  </span>
                  <span>Needs work</span>
                </div>
              </div>

              {/* Queries per day chart */}
              <div className="rounded-xl border border-stone-200 bg-white p-5 dark:border-stone-700 dark:bg-stone-800">
                <h2 className="mb-4 text-sm font-semibold text-stone-700 dark:text-stone-200">
                  Queries Over Time
                </h2>
                <SimpleBarChart data={data.queriesPerDay} />
              </div>
            </div>

            {/* Secondary stats */}
            <div className="rounded-xl border border-stone-200 bg-white p-5 dark:border-stone-700 dark:bg-stone-800">
              <h2 className="mb-4 text-sm font-semibold text-stone-700 dark:text-stone-200">
                Summary
              </h2>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <div>
                  <p className="text-2xl font-bold text-stone-700 dark:text-stone-200">
                    {data.stats.totalMessages}
                  </p>
                  <p className="text-xs text-stone-400">Messages sent</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-stone-700 dark:text-stone-200">
                    {data.stats.totalFeedback}
                  </p>
                  <p className="text-xs text-stone-400">Feedback given</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-stone-700 dark:text-stone-200">
                    {data.stats.totalDocuments > 0
                      ? Math.round(data.stats.totalQueries / data.stats.totalDocuments)
                      : 0}
                  </p>
                  <p className="text-xs text-stone-400">Avg queries/doc</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-stone-700 dark:text-stone-200">
                    {data.stats.totalSessions > 0
                      ? Math.round(data.stats.totalMessages / data.stats.totalSessions)
                      : 0}
                  </p>
                  <p className="text-xs text-stone-400">Avg messages/session</p>
                </div>
              </div>
            </div>

            {/* Last updated */}
            <p className="text-center text-xs text-stone-400 dark:text-stone-500">
              Last updated: {lastUpdated ? lastUpdated.toLocaleTimeString() : "Never"}
              {loading && <span className="ml-2 text-stone-300">Refreshing...</span>}
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
