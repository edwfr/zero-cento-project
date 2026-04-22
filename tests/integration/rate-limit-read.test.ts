import { describe, it, expect, vi } from 'vitest'
import { NextRequest } from 'next/server'

// ── Mocks must be declared before importing the middleware ───────────────────
// Prevents @upstash/redis/cloudflare from attempting CF-specific initialisation
vi.mock('@upstash/redis/cloudflare', () => ({
    Redis: vi.fn(),
}))

// Prevents real Supabase network calls for the first N requests that pass the
// rate limit check and reach the auth layer (they will return 401 — correct).
vi.mock('@supabase/ssr', () => ({
    createServerClient: vi.fn(() => ({
        auth: {
            getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
        },
    })),
}))

import { middleware } from '@/middleware'

// ── Helpers ──────────────────────────────────────────────────────────────────

function buildRequest(ip: string, pathname: string): NextRequest {
    return new NextRequest(`http://localhost${pathname}`, {
        headers: { 'x-forwarded-for': ip },
    })
}

async function exhaustLimit(ip: string, pathname: string, limit: number): Promise<void> {
    for (let i = 0; i < limit; i++) {
        await middleware(buildRequest(ip, pathname))
    }
}

// ── Tests ────────────────────────────────────────────────────────────────────
// Each test uses a unique source IP so the in-memory rateLimitStore keys
// never overlap across test cases (keys are composed as `${ip}:${pathname}`).

describe('Rate limiting — read endpoints (I3)', () => {
    it('returns 429 with Retry-After after 100 requests to GET /api/exercises', async () => {
        const ip = '10.0.1.1'
        const path = '/api/exercises'

        // Requests 1-100: pass rate limit, reach auth layer → 401 (expected)
        await exhaustLimit(ip, path, 100)

        // Request 101: blocked by rate limiter before auth layer → 429
        const res = await middleware(buildRequest(ip, path))

        expect(res.status).toBe(429)

        const body = (await res.json()) as { error: { code: string; message: string } }
        expect(body.error.code).toBe('RATE_LIMIT_EXCEEDED')
        expect(body.error.message).toBeTruthy()

        // Retry-After must be present and equal to the window in seconds (60)
        expect(res.headers.get('Retry-After')).toBe('60')
    })

    it('returns 429 with Retry-After after 100 requests to GET /api/programs', async () => {
        const ip = '10.0.1.2'
        const path = '/api/programs'

        await exhaustLimit(ip, path, 100)

        const res = await middleware(buildRequest(ip, path))

        expect(res.status).toBe(429)

        const body = (await res.json()) as { error: { code: string } }
        expect(body.error.code).toBe('RATE_LIMIT_EXCEEDED')
        expect(res.headers.get('Retry-After')).toBe('60')
    })

    it('returns 429 with Retry-After after 100 requests to GET /api/personal-records', async () => {
        const ip = '10.0.1.3'
        const path = '/api/personal-records'

        await exhaustLimit(ip, path, 100)

        const res = await middleware(buildRequest(ip, path))

        expect(res.status).toBe(429)

        const body = (await res.json()) as { error: { code: string } }
        expect(body.error.code).toBe('RATE_LIMIT_EXCEEDED')
        expect(res.headers.get('Retry-After')).toBe('60')
    })

    it('does not rate limit requests below the threshold', async () => {
        const ip = '10.0.1.4'
        const path = '/api/exercises'

        // 99 requests should NOT trigger rate limiting (returns 401, not 429)
        await exhaustLimit(ip, path, 99)

        const res = await middleware(buildRequest(ip, path))
        expect(res.status).not.toBe(429)
    })
})
