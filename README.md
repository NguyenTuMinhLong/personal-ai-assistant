# SecondBrain - Personal AI Assistant

An AI-powered personal knowledge base that helps you chat with your documents using RAG (Retrieval-Augmented Generation).

## Features

- **Document Upload**: Upload PDF, DOCX, TXT, and MD files
- **Semantic Search**: Find relevant content across all your documents
- **AI Chat**: Ask questions and get answers with citations
- **Streaming Responses**: Real-time AI responses via SSE
- **Image Support**: Attach images to your chat messages
- **Session Management**: Organize conversations by sessions
- **Annotations**: Highlight and add notes to documents
- **Feedback System**: Upvote/downvote responses to improve quality
- **Analytics**: Track usage, cache hits, and response times

## Tech Stack

- **Frontend**: Next.js 16, React 19, Tailwind CSS 4
- **AI**: OpenAI GPT-4o / OpenRouter (Vercel AI SDK)
- **Database**: Supabase (PostgreSQL + pgvector)
- **Auth**: Clerk Authentication

## Prerequisites

- Node.js 20+
- Supabase account with pgvector extension
- OpenAI API key or OpenRouter API key

## Setup

### 1. Clone and Install

```bash
git clone <your-repo>
cd personal-ai-assistant
npm install
```

### 2. Environment Variables

Copy the example env file:

```bash
cp .env.example .env.local
```

Fill in your values:

| Variable | Description | Required |
|----------|-------------|----------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | Yes |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key | Yes |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key | Yes |
| `OPENAI_API_KEY` | OpenAI API key | Yes* |
| `OPENROUTER_API_KEY` | OpenRouter API key | Yes* |

*Choose either OpenAI or OpenRouter

### 3. Supabase Setup

1. Create a new project at [supabase.com](https://supabase.com)
2. Enable the `pgvector` extension in SQL editor:

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

3. Run database migrations. Copy the migration files from `supabase/migrations/` and run them in your Supabase SQL editor.

4. Configure Row Level Security (RLS) policies as needed for your use case.

### 4. Clerk Setup

1. Create an app at [clerk.com](https://clerk.com)
2. Add your Clerk publishable key and secret key to `.env.local`:

```
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_...
CLERK_SECRET_KEY=sk_...
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
```

### 5. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to start.

## Deployment

### Vercel (Recommended)

1. Push your code to GitHub
2. Import project to [Vercel](https://vercel.com)
3. Add environment variables in Vercel dashboard
4. Deploy

Note: This project uses Next.js 16 with React 19 (beta features).

### Rate Limiting

The app includes rate limiting for chat endpoints:

- **10 requests per minute** per IP address
- Applies to: `/api/chat`, `/api/chat/stream`, `/api/chat-files`, `/api/chat-images`

For production with multiple instances, consider using Vercel KV for distributed rate limiting.

## Project Structure

```
personal-ai-assistant/
├── app/                    # Next.js App Router
│   ├── api/               # API routes
│   │   ├── analytics/
│   │   ├── chat/
│   │   ├── documents/
│   │   ├── feedback/
│   │   ├── search/
│   │   ├── sessions/
│   │   └── upload/
│   ├── documents/         # Document pages
│   ├── layout.tsx
│   └── page.tsx
├── lib/                    # Utility libraries
│   ├── ai.ts             # AI provider setup
│   ├── documents.ts      # Document processing
│   ├── hybrid-search.ts  # RAG search
│   ├── qa-cache.ts       # Answer caching
│   ├── sessions.ts       # Chat sessions
│   └── supabase.ts      # Database client
├── middleware.ts          # Rate limiting & security headers
├── vercel.json           # Vercel configuration
└── supabase/
    └── migrations/       # Database migrations
```

## Environment Variables Reference

| Variable | Default | Description |
|----------|---------|-------------|
| `RAG_TOP_K` | 8 | Number of documents to retrieve |
| `MAX_CONTEXT_CHARS` | 3000 | Max characters for text context |
| `MAX_CONTEXT_CHARS_WITH_IMAGE` | 2000 | Max characters for image context |
| `RAG_RRF_K` | 60 | RRF fusion constant for hybrid search |

## License

MIT
