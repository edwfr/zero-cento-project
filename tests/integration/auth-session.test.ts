import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/prisma', () => ({
    prisma: {
        user: {
            findUnique: vi.fn(),
        },
    },
}))

vi.mock('@/lib/supabase-server', () => ({
    createClient: vi.fn(),
}))

import { getSession } from '@/lib/auth'
import { createClient } from '@/lib/supabase-server'
import { prisma } from '@/lib/prisma'

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
        } as any)

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
        expect(prisma.user.findUnique).not.toHaveBeenCalled()
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
        } as any)

        const session = await getSession()

        expect(session).toBeNull()
        expect(prisma.user.findUnique).not.toHaveBeenCalled()
    })

    it('falls back to Prisma when metadata is incomplete', async () => {
        vi.mocked(createClient).mockResolvedValue({
            auth: {
                getUser: vi.fn().mockResolvedValue({
                    data: { user: mockSupabaseUserWithPartialMeta },
                    error: null,
                }),
            },
        } as any)

        vi.mocked(prisma.user.findUnique).mockResolvedValue({
            id: 'user-uuid-2',
            email: 'legacy@example.com',
            firstName: 'Legacy',
            lastName: 'User',
            role: 'trainee',
            isActive: true,
        } as any)

        const session = await getSession()

        expect(prisma.user.findUnique).toHaveBeenCalledWith({
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
