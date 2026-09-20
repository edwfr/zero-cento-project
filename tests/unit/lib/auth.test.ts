import { describe, it, expect, vi, beforeEach } from 'vitest'

// React's `cache` is a Server Components API unavailable in jsdom — stub it as
// passthrough, exactly as tests/integration/auth-session.test.ts does.
vi.mock('react', async (importOriginal) => {
    const actual = await importOriginal() as Record<string, unknown>
    return { ...actual, cache: <T>(fn: T) => fn }
})

const getUser = vi.fn()

vi.mock('@/lib/supabase-server', () => ({
    createClient: async () => ({ auth: { getUser } }),
}))

import { getSession, getSessionIncludingInactive } from '@/lib/auth'
import { prismaMock } from '../../helpers/prisma-mock'
import { makeSupabaseUser } from '../../helpers/sessions'

const activeTrainer = makeSupabaseUser({
    id: 'supabase-uuid-1',
    email: 'trainer@zerocento.it',
    app_metadata: { role: 'trainer', isActive: true },
    user_metadata: { firstName: 'Marco', lastName: 'Trainer' },
})

const prismaUser = {
    id: 'trainer-uuid-1',
    email: 'trainer@zerocento.it',
    firstName: 'Marco',
    lastName: 'Trainer',
    role: 'trainer',
    isActive: true,
}

beforeEach(() => {
    getUser.mockResolvedValue({ data: { user: activeTrainer }, error: null })
})

describe('getSession', () => {
    it('returns null when Supabase reports an error', async () => {
        getUser.mockResolvedValue({ data: { user: null }, error: { message: 'jwt expired' } })

        await expect(getSession()).resolves.toBeNull()
        expect(prismaMock.user.findUnique).not.toHaveBeenCalled()
    })

    it('returns null when there is no user', async () => {
        getUser.mockResolvedValue({ data: { user: null }, error: null })

        await expect(getSession()).resolves.toBeNull()
    })

    it('builds the session from metadata without touching Prisma', async () => {
        const session = await getSession()

        expect(session?.user).toMatchObject({
            id: 'supabase-uuid-1',
            email: 'trainer@zerocento.it',
            firstName: 'Marco',
            lastName: 'Trainer',
            role: 'trainer',
            isActive: true,
        })
        expect(prismaMock.user.findUnique).not.toHaveBeenCalled()
    })

    it('returns null when the metadata says the account is inactive', async () => {
        getUser.mockResolvedValue({
            data: {
                user: makeSupabaseUser({
                    email: 'trainer@zerocento.it',
                    app_metadata: { role: 'trainer', isActive: false },
                    user_metadata: { firstName: 'Marco', lastName: 'Trainer' },
                }),
            },
            error: null,
        })

        await expect(getSession()).resolves.toBeNull()
        expect(prismaMock.user.findUnique).not.toHaveBeenCalled()
    })

    it('falls back to Prisma when the metadata is incomplete', async () => {
        getUser.mockResolvedValue({
            data: {
                user: makeSupabaseUser({
                    email: 'trainer@zerocento.it',
                    app_metadata: { role: 'trainer' }, // isActive missing
                    user_metadata: { firstName: 'Marco', lastName: 'Trainer' },
                }),
            },
            error: null,
        })
        prismaMock.user.findUnique.mockResolvedValue(prismaUser as never)

        const session = await getSession()

        expect(prismaMock.user.findUnique).toHaveBeenCalledWith({
            where: { email: 'trainer@zerocento.it' },
            select: { id: true, email: true, firstName: true, lastName: true, role: true, isActive: true },
        })
        expect(session?.user.id).toBe('trainer-uuid-1')
    })

    it('returns null when Prisma has no such user', async () => {
        getUser.mockResolvedValue({
            data: { user: makeSupabaseUser({ email: 'ghost@zerocento.it', app_metadata: {}, user_metadata: {} }) },
            error: null,
        })
        prismaMock.user.findUnique.mockResolvedValue(null)

        await expect(getSession()).resolves.toBeNull()
    })

    it('returns null when the Prisma user is inactive', async () => {
        getUser.mockResolvedValue({
            data: { user: makeSupabaseUser({ email: 'trainer@zerocento.it', app_metadata: {}, user_metadata: {} }) },
            error: null,
        })
        prismaMock.user.findUnique.mockResolvedValue({ ...prismaUser, isActive: false } as never)

        await expect(getSession()).resolves.toBeNull()
    })

    it('ignores a role forged in user_metadata', async () => {
        getUser.mockResolvedValue({
            data: {
                user: makeSupabaseUser({
                    email: 'trainee@zerocento.it',
                    app_metadata: { role: 'trainee', isActive: true },
                    user_metadata: { role: 'admin', firstName: 'Mario', lastName: 'Atleta' },
                }),
            },
            error: null,
        })

        const session = await getSession()

        expect(session?.user.role).toBe('trainee')
    })

    it('does not accept a role that exists only in user_metadata', async () => {
        getUser.mockResolvedValue({
            data: {
                user: makeSupabaseUser({
                    email: 'trainee@zerocento.it',
                    app_metadata: {},
                    user_metadata: { role: 'admin', isActive: true, firstName: 'Mario', lastName: 'Atleta' },
                }),
            },
            error: null,
        })
        prismaMock.user.findUnique.mockResolvedValue({ ...prismaUser, role: 'trainee' } as never)

        const session = await getSession()

        // metadata is not a trustworthy source here: Prisma decides
        expect(prismaMock.user.findUnique).toHaveBeenCalled()
        expect(session?.user.role).toBe('trainee')
    })
})

describe('getSessionIncludingInactive', () => {
    it('builds the session from metadata without touching Prisma, even when inactive', async () => {
        getUser.mockResolvedValue({
            data: {
                user: makeSupabaseUser({
                    email: 'trainer@zerocento.it',
                    app_metadata: { role: 'trainer', isActive: false },
                    user_metadata: { firstName: 'Marco', lastName: 'Trainer' },
                }),
            },
            error: null,
        })

        const session = await getSessionIncludingInactive()

        expect(session?.user.isActive).toBe(false)
        expect(prismaMock.user.findUnique).not.toHaveBeenCalled()
    })

    it('returns the session of an inactive user', async () => {
        getUser.mockResolvedValue({
            data: { user: makeSupabaseUser({ email: 'trainer@zerocento.it', app_metadata: {}, user_metadata: {} }) },
            error: null,
        })
        prismaMock.user.findUnique.mockResolvedValue({ ...prismaUser, isActive: false } as never)

        const session = await getSessionIncludingInactive()

        expect(session?.user.isActive).toBe(false)
    })

    it('returns null when Prisma has no such user', async () => {
        getUser.mockResolvedValue({
            data: { user: makeSupabaseUser({ email: 'ghost@zerocento.it', app_metadata: {}, user_metadata: {} }) },
            error: null,
        })
        prismaMock.user.findUnique.mockResolvedValue(null)

        await expect(getSessionIncludingInactive()).resolves.toBeNull()
    })

    it('returns null when Supabase reports an error', async () => {
        getUser.mockResolvedValue({ data: { user: null }, error: { message: 'jwt expired' } })

        await expect(getSessionIncludingInactive()).resolves.toBeNull()
    })
})
