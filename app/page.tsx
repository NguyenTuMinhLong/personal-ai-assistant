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
} from "lucide-react";
import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

export default async function HomePage() {
  const user = await currentUser();

  if (user) {
    redirect("/documents");
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-violet-50/50 to-fuchsia-50/30 dark:from-[#0f1117] dark:via-violet-950/20 dark:to-fuchsia-950/10">
      {/* Navigation */}
      <header className="fixed top-0 left-0 right-0 z-50 border-b border-gray-200/50 bg-white/70 backdrop-blur-2xl dark:border-violet-900/30 dark:bg-[#0f1117]/70">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 to-fuchsia-600 shadow-lg shadow-violet-500/25">
              <Brain className="h-5 w-5 text-white" />
            </div>
            <span className="text-xl font-bold text-gray-900 dark:text-white">
              Second<span className="text-violet-600">Brain</span>
            </span>
          </div>
          <nav className="hidden items-center gap-8 md:flex">
            <a
              href="#features"
              className="text-sm font-medium text-gray-600 transition-colors hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
            >
              Features
            </a>
            <a
              href="#how-it-works"
              className="text-sm font-medium text-gray-600 transition-colors hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
            >
              How it works
            </a>
            <Link
              href="/sign-in"
              className="rounded-full bg-gray-900 px-5 py-2.5 text-sm font-medium text-white transition-all hover:bg-gray-800 hover:shadow-lg hover:shadow-gray-900/25 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100"
            >
              Get started
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden pt-36 pb-24">
        {/* Background decorations */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[900px] pointer-events-none">
          <div className="absolute inset-0 bg-gradient-radial from-violet-500/15 via-transparent to-transparent rounded-full blur-3xl" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-radial from-fuchsia-500/10 via-transparent to-transparent rounded-full blur-3xl" />
        </div>

        {/* Grid pattern overlay */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:40px_40px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]" />

        <div className="relative mx-auto max-w-7xl px-6">
          <div className="mx-auto max-w-4xl text-center">
            <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-violet-200 bg-violet-50/80 px-5 py-2 text-sm font-medium text-violet-700 shadow-sm backdrop-blur-sm dark:border-violet-800/50 dark:bg-violet-500/10 dark:text-violet-300">
              <Sparkles className="h-4 w-4" />
              Powered by advanced AI with semantic search
            </div>
            <h1 className="mb-8 text-5xl font-bold tracking-tight text-gray-900 md:text-7xl dark:text-white leading-[1.1]">
              Your documents,{" "}
              <span className="relative inline-block">
                <span className="bg-gradient-to-r from-violet-600 to-fuchsia-600 bg-clip-text text-transparent">
                  intelligently answered
                </span>
                <span className="absolute -bottom-1 left-0 right-0 h-[3px] rounded-full bg-gradient-to-r from-violet-600 to-fuchsia-600 opacity-60" />
              </span>
            </h1>
            <p className="mx-auto mb-12 max-w-2xl text-xl leading-relaxed text-gray-600 dark:text-gray-400">
              Upload any document and chat with it instantly. Get accurate, cited answers,
              save key insights, and build your personal knowledge base — all in seconds.
            </p>
            <div className="flex flex-col items-center gap-5 sm:flex-row sm:justify-center">
              <Link
                href="/sign-up"
                className="group inline-flex items-center gap-2.5 rounded-full bg-gradient-to-r from-violet-600 to-fuchsia-600 px-9 py-4 text-base font-semibold text-white shadow-xl shadow-violet-500/25 transition-all hover:shadow-2xl hover:shadow-violet-500/30 hover:scale-[1.02] active:scale-[0.98]"
              >
                Start for free
                <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
              </Link>
              <Link
                href="/sign-in"
                className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white/80 px-9 py-4 text-base font-semibold text-gray-700 backdrop-blur-sm transition-all hover:border-gray-300 hover:bg-white hover:shadow-lg dark:border-violet-800/50 dark:bg-[#1a1625]/80 dark:text-gray-300 dark:hover:bg-[#252030]"
              >
                Sign in
              </Link>
            </div>
          </div>

          {/* Hero visual */}
          <div className="relative mx-auto mt-20 max-w-5xl">
            <div className="relative rounded-3xl border border-gray-200/80 bg-white/80 shadow-2xl backdrop-blur-xl dark:border-violet-900/40 dark:bg-[#1a1625]/80">
              {/* Window chrome */}
              <div className="flex items-center gap-3 border-b border-gray-100/80 px-5 py-3.5 dark:border-violet-900/30">
                <div className="flex gap-2">
                  <div className="h-3 w-3 rounded-full bg-red-400/80 shadow-inner shadow-red-400/50" />
                  <div className="h-3 w-3 rounded-full bg-yellow-400/80 shadow-inner shadow-yellow-400/50" />
                  <div className="h-3 w-3 rounded-full bg-green-400/80 shadow-inner shadow-green-400/50" />
                </div>
                <span className="ml-3 text-sm font-medium text-gray-400 dark:text-gray-500">
                  SecondBrain — Chat Interface
                </span>
              </div>
              <div className="grid md:grid-cols-2">
                {/* Left panel */}
                <div className="border-b border-r-0 border-gray-100/80 p-6 dark:border-violet-900/30 md:border-r md:border-b-0">
                  <div className="mb-5 flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-100 dark:bg-violet-500/20 shadow-sm">
                      <FileText className="h-5 w-5 text-violet-600 dark:text-violet-400" />
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900 dark:text-white">
                        research_paper.pdf
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Uploaded 2 hours ago</p>
                    </div>
                  </div>
                  {/* Skeleton lines */}
                  <div className="space-y-2.5">
                    <div className="h-3 w-full rounded-full bg-gray-100 dark:bg-violet-900/40" />
                    <div className="h-3 w-5/6 rounded-full bg-gray-100 dark:bg-violet-900/40" />
                    <div className="h-3 w-4/6 rounded-full bg-gray-100 dark:bg-violet-900/40" />
                    <div className="mt-3 h-3 w-3/4 rounded-full bg-gray-100 dark:bg-violet-900/40" />
                  </div>
                </div>
                {/* Right panel */}
                <div className="p-6">
                  <div className="mb-5 flex items-center gap-2.5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-100 dark:bg-violet-500/20">
                      <Brain className="h-4 w-4 text-violet-600 dark:text-violet-400" />
                    </div>
                    <span className="text-sm font-semibold text-gray-500 dark:text-gray-400">
                      AI Assistant
                    </span>
                    <span className="ml-auto flex h-2 w-2 items-center justify-center">
                      <span className="absolute h-2 w-2 rounded-full bg-emerald-400 animate-ping opacity-75" />
                      <span className="relative h-2 w-2 rounded-full bg-emerald-400" />
                    </span>
                  </div>
                  <div className="space-y-3">
                    <div className="rounded-2xl rounded-tl-md bg-gray-100 px-4 py-3 dark:bg-[#252030]">
                      <p className="text-sm text-gray-700 dark:text-gray-300">
                        What are the key findings in this paper?
                      </p>
                    </div>
                    <div className="rounded-2xl rounded-tr-md border border-violet-100/60 bg-white/60 px-4 py-3 shadow-sm backdrop-blur-sm dark:border-violet-900/30 dark:bg-[#1a1625]/60">
                      <p className="text-sm text-gray-700 dark:text-gray-300">
                        The paper presents three main findings: a novel approach to...
                      </p>
                      <div className="mt-2 flex gap-1.5">
                        <span className="inline-flex items-center rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-medium text-violet-600 dark:bg-violet-500/15 dark:text-violet-300">
                          [1] page 3
                        </span>
                        <span className="inline-flex items-center rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-medium text-violet-600 dark:bg-violet-500/15 dark:text-violet-300">
                          [2] page 12
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Floating stat cards */}
            <div className="absolute -left-5 top-1/4 hidden lg:flex flex-col gap-3">
              <div className="animate-in slide-in-from-left-4 fade-in duration-500 rounded-2xl border border-violet-200/80 bg-white/95 p-4 shadow-xl backdrop-blur-sm dark:border-violet-900/50 dark:bg-[#1a1625]/95">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-100 dark:bg-emerald-500/20 shadow-sm">
                    <Zap className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div>
                    <p className="font-bold text-gray-900 dark:text-white text-lg">98%</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Answer accuracy</p>
                  </div>
                </div>
              </div>
              <div className="animate-in slide-in-from-left-4 fade-in duration-700 rounded-2xl border border-violet-200/80 bg-white/95 p-4 shadow-xl backdrop-blur-sm dark:border-violet-900/50 dark:bg-[#1a1625]/95">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-100 dark:bg-amber-500/20 shadow-sm">
                    <MessageSquare className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                  </div>
                  <div>
                    <p className="font-bold text-gray-900 dark:text-white text-lg">10x</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Faster research</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="absolute -right-5 bottom-1/4 hidden lg:flex flex-col gap-3">
              <div className="animate-in slide-in-from-right-4 fade-in duration-600 rounded-2xl border border-violet-200/80 bg-white/95 p-4 shadow-xl backdrop-blur-sm dark:border-violet-900/50 dark:bg-[#1a1625]/95">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-100 dark:bg-blue-500/20 shadow-sm">
                    <Shield className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <p className="font-bold text-gray-900 dark:text-white text-lg">100%</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Private & secure</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Scroll indicator */}
      <div className="flex justify-center pb-4">
        <a href="#features" className="flex flex-col items-center gap-1 text-gray-400 transition-colors hover:text-gray-600 dark:text-gray-600 dark:hover:text-gray-300">
          <span className="text-xs">Explore</span>
          <ChevronDown className="h-4 w-4 animate-bounce" />
        </a>
      </div>

      {/* Features Section */}
      <section id="features" className="py-28">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mx-auto mb-20 max-w-2xl text-center">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-violet-200/60 bg-violet-50/60 px-4 py-1.5 text-xs font-medium text-violet-700 dark:border-violet-800/40 dark:bg-violet-500/10 dark:text-violet-300">
              <Layers className="h-3.5 w-3.5" />
              Powerful features
            </div>
            <h2 className="mb-5 text-4xl font-bold tracking-tight text-gray-900 md:text-5xl dark:text-white leading-tight">
              Everything you need to work with documents
            </h2>
            <p className="text-lg leading-relaxed text-gray-600 dark:text-gray-400">
              From PDF contracts to research papers, SecondBrain understands your
              documents and answers your questions instantly with precision.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {features.map((feature, index) => (
              <div
                key={index}
                className="group relative rounded-3xl border border-gray-200/80 bg-white/80 p-8 backdrop-blur-sm transition-all duration-300 hover:border-violet-300/80 hover:shadow-2xl hover:shadow-violet-500/10 hover:-translate-y-1 dark:border-violet-900/30 dark:bg-[#1a1625]/80"
              >
                <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-violet-500/5 to-fuchsia-500/5 opacity-0 transition-opacity duration-300 group-hover:opacity-100 pointer-events-none" />
                <div className="relative">
                  <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 shadow-lg shadow-violet-500/25 transition-transform duration-300 group-hover:scale-110 group-hover:shadow-xl group-hover:shadow-violet-500/30">
                    <feature.icon className="h-7 w-7 text-white" />
                  </div>
                  <h3 className="mb-3 text-xl font-bold text-gray-900 dark:text-white">
                    {feature.title}
                  </h3>
                  <p className="leading-relaxed text-gray-600 dark:text-gray-400">
                    {feature.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works Section */}
      <section
        id="how-it-works"
        className="bg-gradient-to-b from-gray-50/50 to-white/30 py-28 dark:from-violet-950/10 dark:to-transparent"
      >
        <div className="mx-auto max-w-7xl px-6">
          <div className="mx-auto mb-20 max-w-2xl text-center">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-violet-200/60 bg-violet-50/60 px-4 py-1.5 text-xs font-medium text-violet-700 dark:border-violet-800/40 dark:bg-violet-500/10 dark:text-violet-300">
              <Sparkles className="h-3.5 w-3.5" />
              Simple process
            </div>
            <h2 className="mb-5 text-4xl font-bold tracking-tight text-gray-900 md:text-5xl dark:text-white leading-tight">
              How it works
            </h2>
            <p className="text-lg leading-relaxed text-gray-600 dark:text-gray-400">
              Three simple steps to unlock insights from any document.
            </p>
          </div>

          <div className="mx-auto max-w-4xl">
            <div className="relative">
              <div className="absolute left-8 top-1/2 h-[calc(100%-4rem)] w-px -translate-y-1/2 bg-gradient-to-b from-violet-500 to-fuchsia-500 dark:from-violet-600 dark:to-fuchsia-600 md:left-1/2 md:-translate-x-1/2 md:translate-y-0 md:top-24 md:h-px md:w-[calc(100%-4rem)]" />

              <div className="space-y-12 md:space-y-0">
                {steps.map((step, index) => (
                  <div
                    key={index}
                    className={`relative flex flex-col gap-8 md:flex-row md:items-center ${
                      index % 2 === 1 ? "md:flex-row-reverse" : ""
                    }`}
                  >
                    <div className="flex-1 md:text-right">
                      <div className="inline-block rounded-2xl border border-gray-200/80 bg-white/80 p-7 shadow-lg backdrop-blur-sm dark:border-violet-900/30 dark:bg-[#1a1625]/80">
                        <span className="mb-4 block text-5xl font-bold text-violet-600/20 dark:text-violet-400/20">
                          {String(index + 1).padStart(2, "0")}
                        </span>
                        <h3 className="mb-2 text-xl font-bold text-gray-900 dark:text-white">
                          {step.title}
                        </h3>
                        <p className="leading-relaxed text-gray-600 dark:text-gray-400">
                          {step.description}
                        </p>
                      </div>
                    </div>
                    <div className="absolute left-8 top-6 flex h-16 w-16 items-center justify-center rounded-full border-4 border-white bg-gradient-to-br from-violet-500 to-fuchsia-500 shadow-lg dark:border-[#1a1625] md:relative md:left-auto md:top-auto md:shrink-0 transition-transform duration-300 hover:scale-110">
                      <step.icon className="h-7 w-7 text-white" />
                    </div>
                    <div className="flex-1 md:block" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-28">
        <div className="mx-auto max-w-7xl px-6">
          <div className="relative overflow-hidden rounded-3xl">
            <div className="absolute inset-0 bg-gradient-to-br from-violet-600 to-fuchsia-600" />
            <div className="absolute -top-20 -right-20 h-60 w-60 rounded-full bg-white/10 blur-3xl" />
            <div className="absolute -bottom-20 -left-20 h-60 w-60 rounded-full bg-black/10 blur-3xl" />
            <div className="absolute inset-0 opacity-30" />

            <div className="relative px-8 py-24 md:px-16 md:py-32">
              <div className="mx-auto max-w-3xl text-center">
                <h2 className="mb-6 text-4xl font-bold tracking-tight text-white md:text-5xl leading-tight">
                  Ready to build your second brain?
                </h2>
                <p className="mb-12 text-xl text-violet-100 leading-relaxed">
                  Join thousands of researchers, students, and professionals who
                  trust SecondBrain for their document intelligence.
                </p>
                <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
                  <Link
                    href="/sign-up"
                    className="group inline-flex items-center gap-2.5 rounded-full bg-white px-10 py-4.5 text-lg font-semibold text-violet-600 shadow-xl transition-all hover:bg-gray-100 hover:shadow-2xl hover:scale-[1.02] active:scale-[0.98]"
                  >
                    Get started free
                    <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-200/60 py-14 dark:border-violet-900/30">
        <div className="mx-auto max-w-7xl px-6">
          <div className="flex flex-col items-center justify-between gap-6 md:flex-row">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 to-fuchsia-600 shadow-lg shadow-violet-500/25">
                <Brain className="h-5 w-5 text-white" />
              </div>
              <span className="text-xl font-bold text-gray-900 dark:text-white">
                Second<span className="text-violet-600">Brain</span>
              </span>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400">
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
    icon: FileText,
    title: "Upload any document",
    description:
      "Support for PDF, DOCX, TXT, and Markdown files. Upload in seconds and start chatting immediately.",
  },
  {
    icon: MessageSquare,
    title: "Natural conversations",
    description:
      "Ask questions in plain English. Get answers that understand context and citations.",
  },
  {
    icon: Layers,
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
      "Get instant answers with our semantic caching. No more waiting for AI responses.",
  },
  {
    icon: Brain,
    title: "Smart citations",
    description:
      "Every answer includes source citations. Click to jump to the exact passage.",
  },
];

const steps = [
  {
    icon: FileText,
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
