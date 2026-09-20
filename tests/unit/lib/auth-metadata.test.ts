import { describe, it, expect, vi, beforeEach } from 'vitest'

// React's `cache` is a Server Components API unavailable in jsdom — stub it as passthrough
vi.mock('react', async (importOriginal) => {
    const actual = (await importOriginal()) as Record<string, unknown>
    return { ...actual, cache: (fn: (...args: unknown[]) => unknown) => fn }
})

// vi.mock factories are hoisted: the spies must be created with vi.hoisted
const { getUser, findUnique } = vi.hoisted(() => ({
    getUser: vi.fn(),
    findUnique: vi.fn(),
}))

vi.mock('@/lib/supabase-server', () => ({
    createClient: async () => ({ auth: { getUser } }),
}))

vi.mock('@/lib/prisma', () => ({
    prisma: { user: { findUnique } },
}))

import { getSession, getSessionIncludingInactive } from '@/lib/auth'

const supabaseUser = (overrides: Record<string, unknown> = {}) => ({
    id: 'user-uuid-1',
    email: 'user@zerocento.it',
    app_metadata: {},
    user_metadata: {},
    ...overrides,
})

const prismaUser = {
    id: 'user-uuid-1',
    email: 'user@zerocento.it',
    firstName: 'Mario',
    lastName: 'Atleta',
    role: 'trainee',
    isActive: true,
}

describe('getSession authorization source', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('reads role and isActive from app_metadata without hitting Prisma', async () => {
        getUser.mockResolvedValue({
            data: {
                user: supabaseUser({
                    app_metadata: { role: 'trainer', isActive: true },
                    user_metadata: { firstName: 'Marco', lastName: 'Trainer' },
                }),
            },
            error: null,
        })

        const session = await getSession()

        expect(session?.user.role).toBe('trainer')
        expect(session?.user.firstName).toBe('Marco')
        expect(session?.user.lastName).toBe('Trainer')
        expect(findUnique).not.toHaveBeenCalled()
    })

    it('ignores a role injected into user_metadata', async () => {
        getUser.mockResolvedValue({
            data: {
                user: supabaseUser({
                    app_metadata: { role: 'trainee', isActive: true },
                    user_metadata: { role: 'admin', isActive: true, firstName: 'Mario', lastName: 'Atleta' },
                }),
            },
            error: null,
        })

        const session = await getSession()

        expect(session?.user.role).toBe('trainee')
    })

    it('ignores isActive injected into user_metadata by a deactivated user', async () => {
        getUser.mockResolvedValue({
            data: {
                user: supabaseUser({
                    app_metadata: { role: 'trainee', isActive: false },
                    user_metadata: { isActive: true, firstName: 'Mario', lastName: 'Atleta' },
                }),
            },
            error: null,
        })

        await expect(getSession()).resolves.toBeNull()
    })

    it('falls back to Prisma when app_metadata carries no authorization data', async () => {
        getUser.mockResolvedValue({
            data: {
                user: supabaseUser({
                    user_metadata: { role: 'admin', isActive: true, firstName: 'X', lastName: 'Y' },
                }),
            },
            error: null,
        })
        findUnique.mockResolvedValue(prismaUser)

        const session = await getSession()

        expect(findUnique).toHaveBeenCalledWith({
            where: { email: 'user@zerocento.it' },
            select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                role: true,
                isActive: true,
            },
        })
        expect(session?.user.role).toBe('trainee')
    })

    it('falls back to Prisma when display names are missing from user_metadata', async () => {
        getUser.mockResolvedValue({
            data: { user: supabaseUser({ app_metadata: { role: 'trainer', isActive: true } }) },
            error: null,
        })
        findUnique.mockResolvedValue(prismaUser)

        const session = await getSession()

        expect(findUnique).toHaveBeenCalled()
        expect(session?.user.firstName).toBe('Mario')
    })

    it('returns null when Prisma says the user is inactive', async () => {
        getUser.mockResolvedValue({ data: { user: supabaseUser() }, error: null })
        findUnique.mockResolvedValue({ ...prismaUser, isActive: false })

        await expect(getSession()).resolves.toBeNull()
    })

    it('returns null when the Supabase token is invalid', async () => {
        getUser.mockResolvedValue({ data: { user: null }, error: { message: 'invalid' } })

        await expect(getSession()).resolves.toBeNull()
        expect(findUnique).not.toHaveBeenCalled()
    })
})

describe('getSessionIncludingInactive authorization source', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('returns an inactive user from app_metadata', async () => {
        getUser.mockResolvedValue({
            data: {
                user: supabaseUser({
                    app_metadata: { role: 'trainee', isActive: false },
                    user_metadata: { firstName: 'Mario', lastName: 'Atleta' },
                }),
            },
            error: null,
        })

        const session = await getSessionIncludingInactive()

        expect(session?.user.isActive).toBe(false)
        expect(session?.user.role).toBe('trainee')
        expect(findUnique).not.toHaveBeenCalled()
    })

    it('ignores a role injected into user_metadata', async () => {
        getUser.mockResolvedValue({
            data: {
                user: supabaseUser({
                    app_metadata: { role: 'trainee', isActive: false },
                    user_metadata: { role: 'admin', firstName: 'Mario', lastName: 'Atleta' },
                }),
            },
            error: null,
        })

        const session = await getSessionIncludingInactive()

        expect(session?.user.role).toBe('trainee')
    })

    it('falls back to Prisma and keeps inactive users', async () => {
        getUser.mockResolvedValue({ data: { user: supabaseUser() }, error: null })
        findUnique.mockResolvedValue({ ...prismaUser, isActive: false })

        const session = await getSessionIncludingInactive()

        expect(session?.user.isActive).toBe(false)
    })
})
