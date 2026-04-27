"use client";

import { Component, type ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

type Props = {
  children: ReactNode;
  fallback?: ReactNode;
};

type State = {
  hasError: boolean;
  error?: Error;
};

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  handleReset = () => {
    this.setState({ hasError: false, error: undefined });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-5 bg-stone-50 px-4 dark:bg-stone-950">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-red-200 bg-red-50 shadow-sm dark:border-red-900/40 dark:bg-red-900/20">
            <AlertTriangle className="h-8 w-8 text-red-600 dark:text-red-400" />
          </div>

          <div className="max-w-md text-center">
            <h2 className="mb-2 text-xl font-bold text-stone-800 dark:text-stone-100">
              Something went wrong
            </h2>
            <p className="mb-6 text-sm leading-relaxed text-stone-500 dark:text-stone-400">
              {this.state.error?.message
                ? this.state.error.message
                : "An unexpected error occurred. Please try refreshing the page or clicking the button below."}
            </p>

            <div className="flex flex-col gap-2.5 sm:flex-row sm:justify-center">
              <button
                onClick={this.handleReset}
                className="inline-flex items-center gap-2 rounded-xl bg-stone-900 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-stone-700 active:scale-95 dark:bg-stone-700 dark:hover:bg-stone-600"
              >
                <RefreshCw className="h-4 w-4" />
                Try again
              </button>

              <button
                onClick={() => window.location.reload()}
                className="inline-flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-5 py-2.5 text-sm font-semibold text-stone-600 shadow-sm transition-all hover:bg-stone-50 active:scale-95 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-300 dark:hover:bg-stone-700"
              >
                Refresh page
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
