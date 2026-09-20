import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// vi.mock factories are hoisted: the spy must be created with vi.hoisted
const { getUser } = vi.hoisted(() => ({ getUser: vi.fn() }))

// Prevents @upstash/redis/cloudflare from attempting CF-specific initialisation
vi.mock('@upstash/redis/cloudflare', () => ({ Redis: vi.fn() }))

vi.mock('@supabase/ssr', () => ({
    createServerClient: () => ({ auth: { getUser } }),
}))

import { middleware } from '@/middleware'

// Unique IP per test so the in-memory rate-limit store never collides
let ipCounter = 0
const request = (path: string) =>
    new NextRequest(`http://localhost${path}`, {
        headers: { 'x-forwarded-for': `10.9.0.${++ipCounter}` },
    })

describe('middleware: forced password change', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('redirects when app_metadata.mustChangePassword is true', async () => {
        getUser.mockResolvedValue({
            data: { user: { id: 'u-1', app_metadata: { mustChangePassword: true }, user_metadata: {} } },
        })

        const response = await middleware(request('/trainer/dashboard'))

        expect(response.headers.get('location')).toContain('/force-change-password')
    })

    it('ignores mustChangePassword injected into user_metadata', async () => {
        getUser.mockResolvedValue({
            data: { user: { id: 'u-1', app_metadata: {}, user_metadata: { mustChangePassword: true } } },
        })

        const response = await middleware(request('/trainer/dashboard'))

        expect(response.headers.get('location')).toBeNull()
    })

    it('does not redirect a user without the flag', async () => {
        getUser.mockResolvedValue({
            data: { user: { id: 'u-1', app_metadata: {}, user_metadata: {} } },
        })

        const response = await middleware(request('/trainer/dashboard'))

        expect(response.headers.get('location')).toBeNull()
    })

    it('redirects an unauthenticated user to login', async () => {
        getUser.mockResolvedValue({ data: { user: null } })

        const response = await middleware(request('/trainer/dashboard'))

        expect(response.headers.get('location')).toContain('/login')
    })

    it('does not loop on the force-change-password page itself', async () => {
        getUser.mockResolvedValue({
            data: { user: { id: 'u-1', app_metadata: { mustChangePassword: true }, user_metadata: {} } },
        })

        const response = await middleware(request('/force-change-password'))

        expect(response.headers.get('location')).toBeNull()
    })
})
