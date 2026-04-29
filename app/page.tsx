// app/page.tsx
import Link from "next/link";
import {
  Brain,
  FileText,
  Zap,
  Shield,
  ArrowRight,
  Sparkles,
  Layers,
  MessageSquare,
  ChevronDown,
  Upload,
  BookmarkPlus,
  Quote,
  Eye,
} from "lucide-react";
import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

export default async function HomePage() {
  const user = await currentUser();

  if (user) {
    redirect("/documents");
  }

  return (
    <div className="min-h-screen bg-stone-50 dark:bg-stone-950">
      {/* Navigation */}
      <header className="fixed top-0 left-0 right-0 z-50 border-b border-stone-200/80 bg-white/90 backdrop-blur-sm dark:border-stone-800 dark:bg-stone-900/90">
        <div className="mx-auto flex h-15 max-w-7xl items-center justify-between px-6">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-stone-700 to-stone-900 shadow-lg dark:from-stone-500 dark:to-stone-700">
              <Brain className="h-5 w-5 text-white" />
            </div>
            <span className="text-xl font-bold text-stone-900 dark:text-stone-100">
              Second<span className="text-stone-500">Brain</span>
            </span>
          </div>
          <nav className="hidden items-center gap-8 md:flex">
            <a
              href="#features"
              className="text-sm font-medium text-stone-500 transition-colors hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-100"
            >
              Features
            </a>
            <a
              href="#how-it-works"
              className="text-sm font-medium text-stone-500 transition-colors hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-100"
            >
              How it works
            </a>
            <div className="flex items-center gap-3">
              <Link
                href="/sign-in"
                className="rounded-lg px-4 py-2 text-sm font-medium text-stone-600 transition-colors hover:bg-stone-100 dark:text-stone-400 dark:hover:bg-stone-800 dark:hover:text-stone-100"
              >
                Sign in
              </Link>
              <Link
                href="/sign-up"
                className="rounded-lg bg-stone-900 px-5 py-2.5 text-sm font-semibold text-white transition-all hover:bg-stone-800 dark:bg-stone-100 dark:text-stone-900 dark:hover:bg-stone-200"
              >
                Get started
              </Link>
            </div>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden pt-28 pb-20">
        {/* Background decorations */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[600px] pointer-events-none">
          <div className="absolute inset-0 bg-gradient-to-b from-stone-200/60 via-transparent to-transparent rounded-full blur-3xl" />
        </div>

        <div className="relative mx-auto max-w-7xl px-6">
          <div className="mx-auto max-w-3xl text-center">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-stone-200 bg-white px-4 py-1.5 text-sm font-medium text-stone-500 shadow-sm backdrop-blur-sm dark:border-stone-700 dark:bg-stone-900/80 dark:text-stone-400">
              <Sparkles className="h-4 w-4" />
              Free to try &mdash; no account required
            </div>
            <h1 className="mb-6 text-4xl font-bold tracking-tight text-stone-900 md:text-6xl dark:text-stone-50 leading-[1.1]">
              Chat with any document
              <br />
              <span className="text-stone-500">in seconds</span>
            </h1>
            <p className="mx-auto mb-10 max-w-xl text-lg leading-relaxed text-stone-500 dark:text-stone-400">
              Upload a PDF, ask questions, get cited answers. No sign-up needed
              &mdash; try it right now, free for 10 messages.
            </p>
            <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
              <Link
                href="/chat"
                className="group inline-flex items-center gap-2.5 rounded-xl bg-stone-900 px-8 py-4 text-base font-semibold text-white shadow-xl transition-all hover:bg-stone-800 hover:shadow-2xl hover:shadow-stone-900/20 hover:-translate-y-0.5 active:translate-y-0 dark:bg-stone-100 dark:text-stone-900 dark:hover:bg-stone-200"
              >
                <Upload className="h-5 w-5" />
                Try free now &mdash; 10 messages
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>
              <Link
                href="/sign-up"
                className="inline-flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-8 py-4 text-base font-medium text-stone-700 backdrop-blur-sm transition-all hover:border-stone-300 hover:bg-stone-50 hover:shadow-lg dark:border-stone-700 dark:bg-stone-900 dark:text-stone-300 dark:hover:border-stone-600 dark:hover:bg-stone-800"
              >
                Create free account
              </Link>
            </div>
          </div>

          {/* Hero chat mockup — matches actual ChatWorkspace styling */}
          <div className="relative mx-auto mt-14 max-w-4xl">
            <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-2xl shadow-stone-900/10 dark:border-stone-700 dark:bg-stone-900">
              {/* Window chrome */}
              <div className="flex items-center gap-3 border-b border-stone-200 bg-stone-50 px-5 py-3.5 dark:border-stone-800 dark:bg-stone-900/80">
                <div className="flex gap-2">
                  <div className="h-3 w-3 rounded-full bg-red-400/80" />
                  <div className="h-3 w-3 rounded-full bg-yellow-400/80" />
                  <div className="h-3 w-3 rounded-full bg-green-400/80" />
                </div>
                <div className="flex flex-1 items-center justify-center">
                  <div className="flex items-center gap-2 rounded-lg border border-stone-200 bg-white px-3 py-1 text-xs font-medium text-stone-500 shadow-sm dark:border-stone-700 dark:bg-stone-800 dark:text-stone-400">
                    <Brain className="h-3 w-3" />
                    AI Assistant
                    <span className="ml-1 flex h-2 w-2">
                      <span className="absolute h-2 w-2 rounded-full bg-emerald-400 animate-ping opacity-50" />
                      <span className="relative h-2 w-2 rounded-full bg-emerald-400" />
                    </span>
                  </div>
                </div>
              </div>

              {/* Chat area */}
              <div className="flex">
                {/* Sidebar skeleton */}
                <div className="hidden w-48 border-r border-stone-100 p-4 dark:border-stone-800 md:block">
                  <div className="mb-4 flex items-center gap-2 rounded-lg bg-stone-100 px-3 py-2 dark:bg-stone-800">
                    <FileText className="h-4 w-4 text-stone-400" />
                    <span className="truncate text-xs font-medium text-stone-600 dark:text-stone-400">document.pdf</span>
                  </div>
                  <div className="mb-2 space-y-1">
                    {[90, 70, 55].map((w, i) => (
                      <div key={i} className="flex items-center gap-2 rounded-md bg-stone-50 px-3 py-2 dark:bg-stone-800/50">
                        <MessageSquare className="h-3 w-3 shrink-0 text-stone-300 dark:text-stone-600" />
                        <div className="h-2 flex-1 rounded-full bg-stone-200 dark:bg-stone-700" style={{ width: `${w}%` }} />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Messages */}
                <div className="flex-1 p-5">
                  {/* User message */}
                  <div className="mb-4 flex flex-col items-end gap-1">
                    <div className="max-w-[75%] rounded-2xl rounded-tr-sm border border-stone-100 bg-stone-100 px-4 py-2.5 shadow-sm dark:border-stone-700 dark:bg-stone-800">
                      <p className="text-sm text-stone-800 dark:text-stone-200">
                        What are the key findings in this research paper?
                      </p>
                    </div>
                  </div>

                  {/* AI response */}
                  <div className="flex flex-col items-start gap-1">
                    <div className="flex items-center gap-2 mb-1.5">
                      <div className="flex h-6 w-6 items-center justify-center rounded-md bg-stone-900 dark:bg-stone-100">
                        <Brain className="h-3.5 w-3.5 text-white dark:text-stone-900" />
                      </div>
                      <span className="text-xs font-semibold text-stone-400">AI Assistant</span>
                    </div>
                    <div className="max-w-[80%] rounded-2xl rounded-tl-sm border border-stone-200 bg-white px-4 py-3 shadow-sm dark:border-stone-700 dark:bg-stone-900">
                      <p className="text-sm leading-relaxed text-stone-700 dark:text-stone-300">
                        The paper presents <strong>three key findings</strong>: a novel
                        semantic caching approach that reduces latency by 87%, a hybrid
                        retrieval method combining BM25 and vector search, and evidence
                        that context window size significantly impacts answer quality.
                      </p>
                      {/* Citations */}
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        <span className="inline-flex items-center rounded-full bg-stone-100 px-2 py-0.5 text-[10px] font-medium text-stone-500 dark:bg-stone-800 dark:text-stone-400">
                          [1] p.3
                        </span>
                        <span className="inline-flex items-center rounded-full bg-stone-100 px-2 py-0.5 text-[10px] font-medium text-stone-500 dark:bg-stone-800 dark:text-stone-400">
                          [2] p.12
                        </span>
                        <span className="inline-flex items-center rounded-full bg-stone-100 px-2 py-0.5 text-[10px] font-medium text-stone-500 dark:bg-stone-800 dark:text-stone-400">
                          [3] p.24
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Input bar */}
                  <div className="mt-5 flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-4 py-3 shadow-sm dark:border-stone-700 dark:bg-stone-900">
                    <div className="flex items-center gap-1.5 text-stone-400">
                      <Upload className="h-4 w-4" />
                      <MessageSquare className="h-4 w-4" />
                    </div>
                    <div className="flex-1 text-sm text-stone-400">Ask about your document...</div>
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900">
                      <ArrowRight className="h-4 w-4" />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Floating badges */}
            <div className="absolute -left-4 top-16 hidden lg:flex flex-col gap-3">
              <div className="flex items-center gap-3 rounded-xl border border-stone-200 bg-white/95 p-3.5 shadow-lg backdrop-blur-sm dark:border-stone-700 dark:bg-stone-900/95">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-100 shadow-sm dark:bg-emerald-900/30">
                  <Zap className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <p className="text-sm font-bold text-stone-900 dark:text-stone-100">Cited answers</p>
                  <p className="text-xs text-stone-500 dark:text-stone-400">Every response has sources</p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-xl border border-stone-200 bg-white/95 p-3.5 shadow-lg backdrop-blur-sm dark:border-stone-700 dark:bg-stone-900/95">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-100 shadow-sm dark:bg-amber-900/30">
                  <Quote className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <p className="text-sm font-bold text-stone-900 dark:text-stone-100">Highlight & save</p>
                  <p className="text-xs text-stone-500 dark:text-stone-400">Build your knowledge base</p>
                </div>
              </div>
            </div>

            <div className="absolute -right-4 top-20 hidden lg:flex flex-col gap-3">
              <div className="flex items-center gap-3 rounded-xl border border-stone-200 bg-white/95 p-3.5 shadow-lg backdrop-blur-sm dark:border-stone-700 dark:bg-stone-900/95">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-100 shadow-sm dark:bg-violet-900/30">
                  <Eye className="h-4 w-4 text-violet-600 dark:text-violet-400" />
                </div>
                <div>
                  <p className="text-sm font-bold text-stone-900 dark:text-stone-100">Semantic search</p>
                  <p className="text-xs text-stone-500 dark:text-stone-400">Understands your questions</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Scroll indicator */}
      <div className="flex justify-center pb-6">
        <a
          href="#features"
          className="flex flex-col items-center gap-1 text-stone-400 transition-colors hover:text-stone-600 dark:text-stone-600 dark:hover:text-stone-300"
        >
          <span className="text-xs">See features</span>
          <ChevronDown className="h-4 w-4 animate-bounce" />
        </a>
      </div>

      {/* Features Section */}
      <section id="features" className="py-20">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mx-auto mb-16 max-w-2xl text-center">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-stone-200 bg-white px-4 py-1.5 text-xs font-medium text-stone-500 shadow-sm dark:border-stone-700 dark:bg-stone-900 dark:text-stone-400">
              <Layers className="h-3.5 w-3.5" />
              Features
            </div>
            <h2 className="mb-4 text-3xl font-bold tracking-tight text-stone-900 md:text-4xl dark:text-stone-50">
              Everything you need to work with documents
            </h2>
            <p className="text-base leading-relaxed text-stone-500 dark:text-stone-400">
              From contracts to research papers, SecondBrain understands your
              documents and answers your questions instantly with precision.
            </p>
          </div>

          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {features.map((feature, index) => (
              <div
                key={index}
                className="group relative rounded-2xl border border-stone-200 bg-white p-7 transition-all duration-200 hover:border-stone-300 hover:shadow-xl hover:-translate-y-0.5 dark:border-stone-700 dark:bg-stone-900 hover:dark:border-stone-600"
              >
                <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-stone-100 shadow-sm transition-transform duration-200 group-hover:scale-110 dark:bg-stone-800">
                  <feature.icon className="h-6 w-6 text-stone-600 dark:text-stone-400" />
                </div>
                <h3 className="mb-2.5 text-lg font-semibold text-stone-900 dark:text-stone-100">
                  {feature.title}
                </h3>
                <p className="leading-relaxed text-sm text-stone-500 dark:text-stone-400">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works Section */}
      <section
        id="how-it-works"
        className="bg-white py-20 dark:bg-stone-900/50"
      >
        <div className="mx-auto max-w-7xl px-6">
          <div className="mx-auto mb-16 max-w-2xl text-center">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-stone-200 bg-stone-50 px-4 py-1.5 text-xs font-medium text-stone-500 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-400">
              <Sparkles className="h-3.5 w-3.5" />
              Simple process
            </div>
            <h2 className="mb-4 text-3xl font-bold tracking-tight text-stone-900 md:text-4xl dark:text-stone-50">
              How it works
            </h2>
            <p className="text-base leading-relaxed text-stone-500 dark:text-stone-400">
              Three steps to insights from any document.
            </p>
          </div>

          <div className="mx-auto grid max-w-3xl gap-8 md:grid-cols-3">
            {steps.map((step, index) => (
              <div key={index} className="flex flex-col items-center text-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl border-2 border-stone-200 bg-white shadow-sm transition-transform duration-200 hover:scale-110 dark:border-stone-700 dark:bg-stone-900">
                  <span className="text-2xl font-bold text-stone-300 dark:text-stone-600">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                </div>
                <step.icon className="h-8 w-8 text-stone-400" />
                <div>
                  <h3 className="mb-1.5 text-base font-semibold text-stone-900 dark:text-stone-100">
                    {step.title}
                  </h3>
                  <p className="text-sm leading-relaxed text-stone-500 dark:text-stone-400">
                    {step.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20">
        <div className="mx-auto max-w-7xl px-6">
          <div className="relative overflow-hidden rounded-3xl border border-stone-200 bg-white shadow-xl dark:border-stone-800 dark:bg-stone-900">
            <div className="absolute inset-0 bg-gradient-to-br from-stone-100 to-stone-50 dark:from-stone-900 dark:to-stone-800" />
            <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-stone-200/50 blur-3xl dark:bg-stone-800/50" />
            <div className="absolute -bottom-16 -left-16 h-48 w-48 rounded-full bg-stone-200/50 blur-3xl dark:bg-stone-800/50" />

            <div className="relative px-8 py-20 md:px-16 md:py-24">
              <div className="mx-auto max-w-2xl text-center">
                <h2 className="mb-4 text-3xl font-bold tracking-tight text-stone-900 md:text-4xl dark:text-stone-50">
                  Start chatting with your documents today
                </h2>
                <p className="mb-10 text-base leading-relaxed text-stone-500 dark:text-stone-400">
                  No account needed. Upload a document and get instant, cited answers.
                  Free for your first 10 messages.
                </p>
                <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
                  <Link
                    href="/chat"
                    className="group inline-flex items-center gap-2.5 rounded-xl bg-stone-900 px-8 py-4 text-base font-semibold text-white shadow-xl transition-all hover:bg-stone-800 hover:shadow-2xl hover:-translate-y-0.5 active:translate-y-0 dark:bg-stone-100 dark:text-stone-900 dark:hover:bg-stone-200"
                  >
                    Try for free now
                    <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
                  </Link>
                  <Link
                    href="/sign-up"
                    className="inline-flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-8 py-4 text-base font-medium text-stone-700 transition-all hover:border-stone-300 hover:bg-stone-50 hover:shadow-lg dark:border-stone-700 dark:bg-stone-900 dark:text-stone-300 dark:hover:border-stone-600 dark:hover:bg-stone-800"
                  >
                    Create account
                  </Link>
                </div>
                <p className="mt-4 text-xs text-stone-400 dark:text-stone-500">
                  Unlimited messages with a free account
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-stone-200 py-10 dark:border-stone-800">
        <div className="mx-auto max-w-7xl px-6">
          <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-stone-700 to-stone-900 dark:from-stone-500 dark:to-stone-700">
                <Brain className="h-4 w-4 text-white" />
              </div>
              <span className="text-lg font-bold text-stone-900 dark:text-stone-100">
                SecondBrain
              </span>
            </div>
            <p className="text-sm text-stone-400 dark:text-stone-500">
              Built with AI. Powered by curiosity.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

const features = [
  {
    icon: Upload,
    title: "Upload any document",
    description:
      "Support for PDF, DOCX, TXT, and Markdown. Upload in seconds and start chatting immediately.",
  },
  {
    icon: MessageSquare,
    title: "Natural conversations",
    description:
      "Ask questions in plain language. Get answers with source citations included.",
  },
  {
    icon: BookmarkPlus,
    title: "Save important insights",
    description:
      "Highlight key passages and save notes. Build your personal knowledge base.",
  },
  {
    icon: Shield,
    title: "Private and secure",
    description:
      "Your documents are encrypted and never shared. Full control over your data.",
  },
  {
    icon: Zap,
    title: "Lightning fast",
    description:
      "Semantic caching delivers instant answers for repeated questions.",
  },
  {
    icon: Quote,
    title: "Smart citations",
    description:
      "Every answer includes source citations. Click to jump to the exact passage.",
  },
];

const steps = [
  {
    icon: Upload,
    title: "Upload your document",
    description: "Drag and drop any document. We support PDF, DOCX, TXT, and more.",
  },
  {
    icon: MessageSquare,
    title: "Ask anything",
    description: "Type your questions in natural language. Our AI understands context.",
  },
  {
    icon: Brain,
    title: "Get insights",
    description: "Receive accurate answers with citations. Save important findings.",
  },
];
