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

import {
    getSession,
    getSessionIncludingInactive,
    requireAuth,
    requireRole,
    requireAuthDuringOnboarding,
    isTrainerOwnsTrainee,
    requireTrainerOwnership,
    isTrainerOwnsProgram,
    requireTrainerProgramOwnership,
} from '@/lib/auth'
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

/** The guards throw the Response that apiError builds. */
async function caught(promise: Promise<unknown>): Promise<{ status: number; code: string; key: string }> {
    try {
        await promise
        throw new Error('expected the guard to throw')
    } catch (thrown) {
        const response = thrown as Response
        const body = await response.json()
        return { status: response.status, code: body.error.code, key: body.error.key }
    }
}

describe('requireAuth', () => {
    it('returns the session when authenticated', async () => {
        await expect(requireAuth()).resolves.toMatchObject({ user: { role: 'trainer' } })
    })

    it('throws 401 when there is no session', async () => {
        getUser.mockResolvedValue({ data: { user: null }, error: null })

        expect(await caught(requireAuth())).toEqual({
            status: 401,
            code: 'UNAUTHORIZED',
            key: 'auth.authenticationRequired',
        })
    })
})

describe('requireRole', () => {
    it('accepts a single allowed role', async () => {
        await expect(requireRole('trainer')).resolves.toMatchObject({ user: { role: 'trainer' } })
    })

    it('accepts an array that contains the role', async () => {
        await expect(requireRole(['admin', 'trainer'])).resolves.toMatchObject({ user: { role: 'trainer' } })
    })

    it('throws 403 with the required roles when the role does not match', async () => {
        expect(await caught(requireRole('admin'))).toEqual({
            status: 403,
            code: 'FORBIDDEN',
            key: 'auth.accessDenied',
        })
    })

    it('reports the required roles in the error details', async () => {
        try {
            await requireRole(['admin'])
            throw new Error('expected the guard to throw')
        } catch (thrown) {
            const body = await (thrown as Response).json()
            expect(body.error.details).toEqual({ requiredRoles: ['admin'] })
        }
    })

    it('throws 401, not 403, when there is no session at all', async () => {
        getUser.mockResolvedValue({ data: { user: null }, error: null })

        expect(await caught(requireRole('trainer'))).toMatchObject({ status: 401 })
    })
})

describe('requireAuthDuringOnboarding', () => {
    it('returns the user even when the account is not active yet', async () => {
        prismaMock.user.findUnique.mockResolvedValue({ ...prismaUser, isActive: false } as never)

        const result = await requireAuthDuringOnboarding()

        expect(result.user.isActive).toBe(false)
        expect(result.supabaseUser.id).toBe('supabase-uuid-1')
    })

    it('throws 401 when Supabase has no user', async () => {
        getUser.mockResolvedValue({ data: { user: null }, error: null })

        expect(await caught(requireAuthDuringOnboarding())).toEqual({
            status: 401,
            code: 'UNAUTHORIZED',
            key: 'auth.authenticationRequired',
        })
    })

    it('throws 401 with userNotFound when Prisma has no user', async () => {
        prismaMock.user.findUnique.mockResolvedValue(null)

        expect(await caught(requireAuthDuringOnboarding())).toEqual({
            status: 401,
            code: 'UNAUTHORIZED',
            key: 'user.notFound',
        })
    })
})

describe('isTrainerOwnsTrainee', () => {
    it('queries the association with both ids', async () => {
        prismaMock.trainerTrainee.findFirst.mockResolvedValue({ id: 'assoc-1' } as never)

        await expect(isTrainerOwnsTrainee('trainer-1', 'trainee-1')).resolves.toBe(true)
        expect(prismaMock.trainerTrainee.findFirst).toHaveBeenCalledWith({
            where: { trainerId: 'trainer-1', traineeId: 'trainee-1' },
        })
    })

    it('returns false when there is no association', async () => {
        prismaMock.trainerTrainee.findFirst.mockResolvedValue(null)

        await expect(isTrainerOwnsTrainee('trainer-1', 'trainee-1')).resolves.toBe(false)
    })
})

describe('requireTrainerOwnership', () => {
    it('returns the session when the trainer owns the trainee', async () => {
        prismaMock.trainerTrainee.findFirst.mockResolvedValue({ id: 'assoc-1' } as never)

        await expect(requireTrainerOwnership('trainee-1')).resolves.toMatchObject({ user: { role: 'trainer' } })
    })

    it('throws 403 traineeAccessDenied when the association is missing', async () => {
        prismaMock.trainerTrainee.findFirst.mockResolvedValue(null)

        expect(await caught(requireTrainerOwnership('trainee-1'))).toEqual({
            status: 403,
            code: 'FORBIDDEN',
            key: 'auth.traineeAccessDenied',
        })
    })

    it('throws 403 accessDenied when the caller is not a trainer', async () => {
        getUser.mockResolvedValue({
            data: {
                user: makeSupabaseUser({
                    email: 'admin@zerocento.it',
                    app_metadata: { role: 'admin', isActive: true },
                    user_metadata: { firstName: 'Admin', lastName: 'User' },
                }),
            },
            error: null,
        })

        expect(await caught(requireTrainerOwnership('trainee-1'))).toMatchObject({ key: 'auth.accessDenied' })
        expect(prismaMock.trainerTrainee.findFirst).not.toHaveBeenCalled()
    })
})

describe('isTrainerOwnsProgram', () => {
    it('queries the program with both ids', async () => {
        prismaMock.trainingProgram.findFirst.mockResolvedValue({ id: 'prog-1' } as never)

        await expect(isTrainerOwnsProgram('trainer-1', 'prog-1')).resolves.toBe(true)
        expect(prismaMock.trainingProgram.findFirst).toHaveBeenCalledWith({
            where: { id: 'prog-1', trainerId: 'trainer-1' },
        })
    })

    it('returns false when there is no matching program', async () => {
        prismaMock.trainingProgram.findFirst.mockResolvedValue(null)

        await expect(isTrainerOwnsProgram('trainer-1', 'prog-1')).resolves.toBe(false)
    })
})

describe('requireTrainerProgramOwnership', () => {
    it('returns the session when the trainer owns the program', async () => {
        prismaMock.trainingProgram.findFirst.mockResolvedValue({ id: 'prog-1' } as never)

        await expect(requireTrainerProgramOwnership('prog-1')).resolves.toMatchObject({ user: { role: 'trainer' } })
    })

    it('throws 403 programAccessDenied when there is no matching program', async () => {
        prismaMock.trainingProgram.findFirst.mockResolvedValue(null)

        expect(await caught(requireTrainerProgramOwnership('prog-1'))).toEqual({
            status: 403,
            code: 'FORBIDDEN',
            key: 'auth.programAccessDenied',
        })
    })

    it('throws 403 accessDenied when the caller is not a trainer', async () => {
        getUser.mockResolvedValue({
            data: {
                user: makeSupabaseUser({
                    email: 'admin@zerocento.it',
                    app_metadata: { role: 'admin', isActive: true },
                    user_metadata: { firstName: 'Admin', lastName: 'User' },
                }),
            },
            error: null,
        })

        expect(await caught(requireTrainerProgramOwnership('prog-1'))).toMatchObject({ key: 'auth.accessDenied' })
        expect(prismaMock.trainingProgram.findFirst).not.toHaveBeenCalled()
    })
})
