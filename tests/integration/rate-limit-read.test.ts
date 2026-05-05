import { describe, it, expect, vi } from 'vitest'
import { NextRequest } from 'next/server'

// ── Mocks must be declared before importing the middleware ───────────────────
// Prevents @upstash/redis/cloudflare from attempting CF-specific initialisation
vi.mock('@upstash/redis/cloudflare', () => ({
    Redis: vi.fn(),
}))

// Note: @supabase/ssr mock is NOT needed here.
// API routes now return NextResponse.next() before Supabase is ever called.

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

        await exhaustLimit(ip, path, 100)

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

        await exhaustLimit(ip, path, 99)

        const res = await middleware(buildRequest(ip, path))
        expect(res.status).not.toBe(429)
    })

    it('does not rate limit repeated requests to the public login page', async () => {
        const ip = '10.0.1.5'
        const path = '/login'

        for (let i = 0; i < 10; i++) {
            const res = await middleware(buildRequest(ip, path))
            expect(res.status).not.toBe(429)
        }
    })

    it('passes API requests through to route handlers without calling getUser', async () => {
        const ip = '10.0.1.99'
        const path = '/api/programs'
        // Should return 200 (NextResponse.next()), NOT 401
        const res = await middleware(buildRequest(ip, path))
        expect(res.status).toBe(200)
    })

    it('rate limits POST mutations via in-memory store, returns 429 after 100', async () => {
        const ip = '10.0.2.1'
        const path = '/api/programs/prog-test-id/copy-week'

        function buildPostRequest(ipAddr: string, pathname: string): NextRequest {
            return new NextRequest(`http://localhost${pathname}`, {
                method: 'POST',
                headers: { 'x-forwarded-for': ipAddr },
            })
        }

        for (let i = 0; i < 100; i++) {
            await middleware(buildPostRequest(ip, path))
        }

        const res = await middleware(buildPostRequest(ip, path))
        expect(res.status).toBe(429)
        expect(res.headers.get('Retry-After')).toBe('60')
    })
})
