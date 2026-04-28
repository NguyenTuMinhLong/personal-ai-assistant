import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const isPublicRoute = createRouteMatcher([
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/',
]);

// Simple in-memory rate limiter for Edge runtime
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

const RATE_LIMIT = 10; // requests per window
const WINDOW_MS = 60 * 1000; // 1 minute

function getClientIP(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const ip = forwarded ? forwarded.split(',')[0].trim() : 'anonymous';
  return ip;
}

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const record = rateLimitStore.get(ip);

  if (!record || now > record.resetTime) {
    rateLimitStore.set(ip, { count: 1, resetTime: now + WINDOW_MS });
    return false;
  }

  if (record.count >= RATE_LIMIT) {
    return true;
  }

  record.count++;
  return false;
}

export default clerkMiddleware(async (auth, req: NextRequest) => {
  const { pathname } = req.nextUrl;

  // Apply rate limiting only to chat API routes
  const isChatRoute = pathname.startsWith('/api/chat') ||
                      pathname.startsWith('/api/chat-files') ||
                      pathname.startsWith('/api/chat-images');

  if (isChatRoute) {
    const ip = getClientIP(req);

    if (isRateLimited(ip)) {
      return NextResponse.json(
        { error: 'Too many requests. Please wait a moment before trying again.' },
        {
          status: 429,
          headers: {
            'Retry-After': '60',
            'X-RateLimit-Limit': String(RATE_LIMIT),
            'X-RateLimit-Remaining': '0',
          },
        }
      );
    }
  }

  // Add security headers to all responses
  const response = NextResponse.next();
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

  if (!isPublicRoute(req)) {
    await auth.protect();
  }

  return response;
});

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
};
