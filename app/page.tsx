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
} from "lucide-react";
import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

export default async function HomePage() {
  const user = await currentUser();

  if (user) {
    redirect("/documents");
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-violet-50 dark:from-[#0f1117] dark:to-[#1a1625]">
      {/* Navigation */}
      <header className="fixed top-0 left-0 right-0 z-50 border-b border-gray-100/50 bg-white/80 backdrop-blur-xl dark:border-violet-900/20 dark:bg-[#0f1117]/80">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 to-violet-700 shadow-lg shadow-violet-500/25">
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
      <section className="relative overflow-hidden pt-32 pb-20">
        {/* Background decorations */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[800px]">
          <div className="absolute inset-0 bg-gradient-to-r from-violet-500/20 to-fuchsia-500/20 rounded-full blur-3xl" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-to-br from-violet-400/10 to-fuchsia-400/10 rounded-full blur-3xl" />
        </div>

        <div className="relative mx-auto max-w-7xl px-6">
          <div className="mx-auto max-w-4xl text-center">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-violet-200 bg-violet-50 px-4 py-1.5 text-sm font-medium text-violet-700 dark:border-violet-800/50 dark:bg-violet-500/10 dark:text-violet-300">
              <Sparkles className="h-4 w-4" />
              Powered by AI
            </div>
            <h1 className="mb-6 text-5xl font-bold tracking-tight text-gray-900 md:text-7xl dark:text-white">
              Your documents,{" "}
              <span className="bg-gradient-to-r from-violet-600 to-fuchsia-600 bg-clip-text text-transparent">
                intelligently answered
              </span>
            </h1>
            <p className="mx-auto mb-10 max-w-2xl text-xl text-gray-600 dark:text-gray-400">
              Upload any document and chat with it instantly. Get accurate answers
              backed by citations, save important insights, and build your second
              brain.
            </p>
            <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
              <Link
                href="/sign-up"
                className="group inline-flex items-center gap-2 rounded-full bg-violet-600 px-8 py-4 text-base font-semibold text-white shadow-xl shadow-violet-500/25 transition-all hover:bg-violet-700 hover:shadow-2xl hover:shadow-violet-500/30"
              >
                Start for free
                <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
              </Link>
              <Link
                href="/sign-in"
                className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-8 py-4 text-base font-semibold text-gray-700 transition-all hover:border-gray-300 hover:bg-gray-50 dark:border-violet-800/50 dark:bg-[#1a1625] dark:text-gray-300 dark:hover:bg-[#252030]"
              >
                Sign in
              </Link>
            </div>
          </div>

          {/* Hero visual */}
          <div className="relative mx-auto mt-20 max-w-5xl">
            <div className="relative rounded-3xl border border-gray-200/50 bg-white/80 shadow-2xl backdrop-blur-xl dark:border-violet-900/30 dark:bg-[#1a1625]/80">
              <div className="flex items-center gap-2 border-b border-gray-100 px-4 py-3 dark:border-violet-900/30">
                <div className="flex gap-2">
                  <div className="h-3 w-3 rounded-full bg-red-400/80" />
                  <div className="h-3 w-3 rounded-full bg-yellow-400/80" />
                  <div className="h-3 w-3 rounded-full bg-green-400/80" />
                </div>
                <span className="ml-2 text-sm text-gray-400">chat interface</span>
              </div>
              <div className="grid md:grid-cols-2">
                <div className="border-b border-r-0 border-gray-100 p-6 dark:border-violet-900/30 md:border-r md:border-b-0">
                  <div className="mb-4 flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-100 dark:bg-violet-500/20">
                      <FileText className="h-5 w-5 text-violet-600 dark:text-violet-400" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">
                        research_paper.pdf
                      </p>
                      <p className="text-sm text-gray-500">Uploaded 2 hours ago</p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="h-3 w-3/4 rounded-full bg-gray-200 dark:bg-violet-900/50" />
                    <div className="h-3 w-1/2 rounded-full bg-gray-200 dark:bg-violet-900/50" />
                  </div>
                </div>
                <div className="p-6">
                  <div className="mb-4 flex items-center gap-2">
                    <Brain className="h-5 w-5 text-violet-600 dark:text-violet-400" />
                    <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
                      AI Assistant
                    </span>
                  </div>
                  <div className="space-y-3">
                    <div className="rounded-2xl rounded-tl-md bg-gray-100 px-4 py-3 dark:bg-[#252030]">
                      <p className="text-sm text-gray-700 dark:text-gray-300">
                        What are the key findings in this paper?
                      </p>
                    </div>
                    <div className="rounded-2xl rounded-tr-md border border-violet-100 bg-white px-4 py-3 dark:border-violet-900/30 dark:bg-[#1a1625]">
                      <p className="text-sm text-gray-700 dark:text-gray-300">
                        The paper presents three main findings: first, a novel
                        approach to...
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Floating elements */}
            <div className="absolute -left-4 top-1/4 rounded-2xl border border-violet-200 bg-white/90 p-4 shadow-xl backdrop-blur-sm dark:border-violet-900/50 dark:bg-[#1a1625]/90">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 dark:bg-emerald-500/20">
                  <Zap className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <p className="font-semibold text-gray-900 dark:text-white">98%</p>
                  <p className="text-xs text-gray-500">Answer accuracy</p>
                </div>
              </div>
            </div>

            <div className="absolute -right-4 bottom-1/4 rounded-2xl border border-violet-200 bg-white/90 p-4 shadow-xl backdrop-blur-sm dark:border-violet-900/50 dark:bg-[#1a1625]/90">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 dark:bg-amber-500/20">
                  <MessageSquare className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <p className="font-semibold text-gray-900 dark:text-white">10x</p>
                  <p className="text-xs text-gray-500">Faster research</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-24">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mx-auto mb-16 max-w-2xl text-center">
            <h2 className="mb-4 text-4xl font-bold tracking-tight text-gray-900 md:text-5xl dark:text-white">
              Everything you need to work with documents
            </h2>
            <p className="text-lg text-gray-600 dark:text-gray-400">
              From PDF contracts to research papers, SecondBrain understands your
              documents and answers your questions instantly.
            </p>
          </div>

          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            {features.map((feature, index) => (
              <div
                key={index}
                className="group relative rounded-3xl border border-gray-200 bg-white p-8 transition-all hover:border-violet-200 hover:shadow-xl hover:shadow-violet-500/5 dark:border-violet-900/30 dark:bg-[#1a1625] dark:hover:border-violet-800/50"
              >
                <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 shadow-lg shadow-violet-500/25">
                  <feature.icon className="h-7 w-7 text-white" />
                </div>
                <h3 className="mb-3 text-xl font-bold text-gray-900 dark:text-white">
                  {feature.title}
                </h3>
                <p className="text-gray-600 dark:text-gray-400">
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
        className="bg-gray-50/50 py-24 dark:bg-violet-950/10"
      >
        <div className="mx-auto max-w-7xl px-6">
          <div className="mx-auto mb-16 max-w-2xl text-center">
            <h2 className="mb-4 text-4xl font-bold tracking-tight text-gray-900 md:text-5xl dark:text-white">
              How it works
            </h2>
            <p className="text-lg text-gray-600 dark:text-gray-400">
              Three simple steps to unlock insights from any document.
            </p>
          </div>

          <div className="mx-auto max-w-4xl">
            <div className="relative">
              {/* Connection line */}
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
                      <div className="inline-block rounded-2xl border border-gray-200 bg-white p-6 shadow-lg dark:border-violet-900/30 dark:bg-[#1a1625] md:inline-block">
                        <span className="mb-4 block text-5xl font-bold text-violet-600/20 dark:text-violet-400/20">
                          {String(index + 1).padStart(2, "0")}
                        </span>
                        <h3 className="mb-2 text-xl font-bold text-gray-900 dark:text-white">
                          {step.title}
                        </h3>
                        <p className="text-gray-600 dark:text-gray-400">
                          {step.description}
                        </p>
                      </div>
                    </div>
                    <div className="absolute left-8 top-6 flex h-16 w-16 items-center justify-center rounded-full border-4 border-white bg-gradient-to-br from-violet-500 to-fuchsia-500 shadow-lg dark:border-[#1a1625] md:relative md:left-auto md:top-auto md:shrink-0">
                      <step.icon className="h-7 w-7 text-white" />
                    </div>
                    <div className="flex-1 md:block">
                      {/* Empty for layout balance */}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24">
        <div className="mx-auto max-w-7xl px-6">
          <div className="relative overflow-hidden rounded-3xl">
            <div className="absolute inset-0 bg-gradient-to-br from-violet-600 to-fuchsia-600" />
            <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSA2MCAwIEwgMCAwIDAgNjAiIGZpbGw9Im5vbmUiIHN0cm9rZT0id2hpdGUiIHN0cm9rZS1vcGFjaXR5PSIwLjA1IiBzdHJva2Utd2lkdGg9IjEiLz48L3BhdHRlcm4+PC9kZWZzPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9InVybCgjZ3JpZCkiLz48L3N2Zz4=')] opacity-50" />

            <div className="relative px-8 py-20 md:px-16 md:py-28">
              <div className="mx-auto max-w-3xl text-center">
                <h2 className="mb-6 text-4xl font-bold tracking-tight text-white md:text-5xl">
                  Ready to build your second brain?
                </h2>
                <p className="mb-10 text-xl text-violet-100">
                  Join thousands of researchers, students, and professionals who
                  trust SecondBrain for their document intelligence.
                </p>
                <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
                  <Link
                    href="/sign-up"
                    className="group inline-flex items-center gap-2 rounded-full bg-white px-8 py-4 text-lg font-semibold text-violet-600 shadow-xl transition-all hover:bg-gray-100 hover:shadow-2xl"
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
      <footer className="border-t border-gray-200 py-12 dark:border-violet-900/30">
        <div className="mx-auto max-w-7xl px-6">
          <div className="flex flex-col items-center justify-between gap-6 md:flex-row">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 to-violet-700 shadow-lg shadow-violet-500/25">
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
