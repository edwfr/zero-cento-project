// This file exercises the real auth implementation (getSession), not a route
// handler: '@/lib/auth' is deliberately NOT mocked here. Only Prisma and
// Supabase are.
import { describe, it, expect, vi, beforeEach } from 'vitest'

// React's `cache` is a Server Components API unavailable in jsdom — stub it as passthrough
vi.mock('react', async (importOriginal) => {
    const actual = await importOriginal() as Record<string, unknown>
    return {
        ...actual,
        cache: <T>(fn: T) => fn,
    }
})

vi.mock('@/lib/supabase-server', () => ({
    createClient: vi.fn(),
}))

import { getSession } from '@/lib/auth'
import { createClient } from '@/lib/supabase-server'
import { prismaMock } from '../helpers/prisma-mock'

const mockSupabaseUserWithFullMeta = {
    id: 'user-uuid-1',
    email: 'test@example.com',
    user_metadata: {
        role: 'trainer',
        firstName: 'Mario',
        lastName: 'Rossi',
        isActive: true,
    },
}

const mockSupabaseUserWithPartialMeta = {
    id: 'user-uuid-2',
    email: 'legacy@example.com',
    user_metadata: {
        role: 'trainee',
        // missing firstName, lastName, isActive
    },
}

describe('getSession', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('returns session from metadata without calling Prisma when all fields present', async () => {
        vi.mocked(createClient).mockResolvedValue({
            auth: {
                getUser: vi.fn().mockResolvedValue({
                    data: { user: mockSupabaseUserWithFullMeta },
                    error: null,
                }),
            },
        } as never)

        const session = await getSession()

        expect(session).toEqual({
            user: {
                id: 'user-uuid-1',
                email: 'test@example.com',
                firstName: 'Mario',
                lastName: 'Rossi',
                role: 'trainer',
                isActive: true,
            },
            supabaseUser: mockSupabaseUserWithFullMeta,
        })
        expect(prismaMock.user.findUnique).not.toHaveBeenCalled()
    })

    it('returns null without calling Prisma when metadata shows isActive=false', async () => {
        vi.mocked(createClient).mockResolvedValue({
            auth: {
                getUser: vi.fn().mockResolvedValue({
                    data: {
                        user: {
                            ...mockSupabaseUserWithFullMeta,
                            user_metadata: { ...mockSupabaseUserWithFullMeta.user_metadata, isActive: false },
                        },
                    },
                    error: null,
                }),
            },
        } as never)

        const session = await getSession()

        expect(session).toBeNull()
        expect(prismaMock.user.findUnique).not.toHaveBeenCalled()
    })

    it('falls back to Prisma when metadata is incomplete', async () => {
        vi.mocked(createClient).mockResolvedValue({
            auth: {
                getUser: vi.fn().mockResolvedValue({
                    data: { user: mockSupabaseUserWithPartialMeta },
                    error: null,
                }),
            },
        } as never)

        prismaMock.user.findUnique.mockResolvedValue({
            id: 'user-uuid-2',
            email: 'legacy@example.com',
            firstName: 'Legacy',
            lastName: 'User',
            role: 'trainee',
            isActive: true,
        } as never)

        const session = await getSession()

        expect(prismaMock.user.findUnique).toHaveBeenCalledWith({
            where: { email: 'legacy@example.com' },
            select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                role: true,
                isActive: true,
            },
        })
        expect(session?.user.firstName).toBe('Legacy')
    })
})
