import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/auth', async () => (await import('../helpers/auth-module-mock')).authModuleMock())

vi.mock('@/lib/password-utils', () => ({
    generateSecurePassword: vi.fn().mockReturnValue('TempPass123!'),
    hashPassword: vi.fn().mockResolvedValue('hashed-password'),
}))

vi.mock('@/lib/supabase-server', () => ({
    createClient: vi.fn(() => ({
        auth: {
            admin: {
                createUser: vi.fn().mockResolvedValue({ data: { user: { id: 'supabase-uid' } }, error: null }),
            },
        },
    })),
    createAdminClient: vi.fn(() => ({
        auth: {
            admin: {
                inviteUserByEmail: vi.fn().mockResolvedValue({
                    data: { user: { id: 'supabase-uid' } },
                    error: null,
                }),
                getUserById: vi.fn().mockResolvedValue({
                    data: { user: null },
                    error: null,
                }),
            },
        },
    })),
}))

vi.mock('@/lib/sync-user-metadata', () => ({
    syncUserMetadata: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/lib/logger', () => ({
    logger: {
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn(),
    },
}))

import { GET, POST } from '@/app/api/users/route'
import { GET as getUser, PUT as updateUser } from '@/app/api/users/[id]/route'
import { prismaMock } from '../helpers/prisma-mock'
import { mockTrainerSession, mockAdminSession } from '../helpers/sessions'
import { asTrainer, asAdmin, asUnauthenticated } from '../helpers/auth-mock'
import { requireAuth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { syncUserMetadata } from '@/lib/sync-user-metadata'

const mockUsers = [
    {
        id: 'user-1',
        email: 'mario.rossi@example.com',
        firstName: 'Mario',
        lastName: 'Rossi',
        role: 'trainee',
        isActive: true,
        createdAt: new Date('2026-01-01'),
    },
    {
        id: 'user-2',
        email: 'luigi.verdi@example.com',
        firstName: 'Luigi',
        lastName: 'Verdi',
        role: 'trainer',
        isActive: true,
        createdAt: new Date('2026-01-02'),
    },
]

function makeRequest(url = 'http://localhost:3000/api/users', options?: RequestInit) {
    const { signal, ...safeOptions } = options || {}
    return new NextRequest(url, safeOptions as never)
}

describe('GET /api/users', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('returns all users for admin', async () => {
        asAdmin()
        prismaMock.user.findMany.mockResolvedValue(mockUsers as never)

        const req = makeRequest()
        const res = await GET(req)
        const body = await res.json()

        expect(res.status).toBe(200)
        expect(body.data.items).toHaveLength(2)
        expect(body.data.items[0].email).toBe('mario.rossi@example.com')
    })

    it('filters by role when query param provided', async () => {
        asAdmin()
        prismaMock.user.findMany.mockResolvedValue([mockUsers[1]] as never)

        const req = makeRequest('http://localhost:3000/api/users?role=trainer')
        const res = await GET(req)
        const body = await res.json()

        expect(res.status).toBe(200)
        // Prisma should have been called with role filter (isActive may also be present)
        expect(prismaMock.user.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({ role: 'trainer' }),
            })
        )
    })

    it('returns 401 when not authenticated', async () => {
        const { apiError } = await import('@/lib/api-response')
        vi.mocked(requireAuth).mockRejectedValue(
            Response.json({ error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } }, { status: 401 })
        )

        const req = makeRequest()
        const res = await GET(req)
        expect(res.status).toBe(401)
    })

    it('trainee cannot access user list', async () => {
        vi.mocked(requireAuth).mockResolvedValue({
            ...mockAdminSession,
            user: { ...mockAdminSession.user, role: 'trainee' },
        })

        const req = makeRequest()
        const res = await GET(req)
        expect(res.status).toBe(403)
    })

    it('trainer sees own trainees via TrainerTrainee association', async () => {
        asTrainer()
        prismaMock.trainerTrainee.findMany.mockResolvedValue([
            { trainee: mockUsers[0] },
        ] as never)

        const req = makeRequest()
        const res = await GET(req)
        const body = await res.json()

        expect(res.status).toBe(200)
        expect(body.data.items).toHaveLength(1)
        expect(prismaMock.trainerTrainee.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { trainerId: 'trainer-uuid-1' },
            })
        )
    })

    it('applies filter-first pagination and returns metadata when page/limit are provided', async () => {
        asTrainer()

        const trainees = [
            {
                id: 'trainee-1',
                email: 'active.one@example.com',
                firstName: 'Active',
                lastName: 'One',
                role: 'trainee',
                isActive: true,
                createdAt: new Date('2026-01-03'),
            },
            {
                id: 'trainee-2',
                email: 'inactive.one@example.com',
                firstName: 'Inactive',
                lastName: 'One',
                role: 'trainee',
                isActive: false,
                createdAt: new Date('2026-01-02'),
            },
            {
                id: 'trainee-3',
                email: 'active.two@example.com',
                firstName: 'Active',
                lastName: 'Two',
                role: 'trainee',
                isActive: true,
                createdAt: new Date('2026-01-01'),
            },
        ]

        prismaMock.trainerTrainee.findMany.mockResolvedValue(
            trainees.map((trainee) => ({ trainee })) as never
        )

        const req = makeRequest('http://localhost:3000/api/users?role=trainee&includeInactive=true&status=all&page=2&limit=1')
        const res = await GET(req)
        const body = await res.json()

        expect(res.status).toBe(200)
        expect(body.data.items).toHaveLength(1)
        expect(body.data.pagination).toEqual(
            expect.objectContaining({
                currentPage: 2,
                totalPages: 3,
                totalItems: 3,
                limit: 1,
                hasMore: true,
            })
        )
        expect(body.data.statusCounts).toEqual({
            all: 3,
            active: 2,
            inactive: 1,
        })
    })

    it('returns 400 for invalid page filter', async () => {
        asAdmin()

        const req = makeRequest('http://localhost:3000/api/users?page=0')
        const res = await GET(req)

        expect(res.status).toBe(400)
    })
})

// ─── POST /api/users ──────────────────────────────────────────────────────────

describe('POST /api/users', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('admin creates a trainer user successfully', async () => {
        asAdmin()
        prismaMock.user.findUnique.mockResolvedValue(null)
        prismaMock.user.create.mockResolvedValue({
            id: 'new-user-id',
            email: 'nuovo.trainer@example.com',
            firstName: 'Nuovo',
            lastName: 'Trainer',
            role: 'trainer',
            isActive: true,
        } as never)

        const req = makeRequest('http://localhost:3000/api/users', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: 'nuovo.trainer@example.com',
                firstName: 'Nuovo',
                lastName: 'Trainer',
                role: 'trainer',
            }),
        })

        const res = await POST(req)
        expect(res.status).toBe(201)
        // Authorization data must reach app_metadata (syncUserMetadata), not the
        // invite payload, which only fills user_metadata.
        expect(vi.mocked(syncUserMetadata)).toHaveBeenCalledWith('new-user-id', {
            role: 'trainer',
            isActive: false,
        })
    })

    it('returns 409 when email already exists', async () => {
        asAdmin()
        prismaMock.user.findUnique.mockResolvedValue(mockUsers[0] as never)

        const req = makeRequest('http://localhost:3000/api/users', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: 'mario.rossi@example.com',
                firstName: 'Mario',
                lastName: 'Rossi',
                role: 'trainee',
            }),
        })

        const res = await POST(req)
        expect(res.status).toBe(409)
    })

    it('returns 403 when trying to create an admin user', async () => {
        asAdmin()

        const req = makeRequest('http://localhost:3000/api/users', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: 'new.admin@example.com',
                firstName: 'New',
                lastName: 'Admin',
                role: 'admin',
            }),
        })

        const res = await POST(req)
        expect(res.status).toBe(403)
    })

    it('returns 403 when trainer tries to create another trainer', async () => {
        asTrainer()

        const req = makeRequest('http://localhost:3000/api/users', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: 'another.trainer@example.com',
                firstName: 'Another',
                lastName: 'Trainer',
                role: 'trainer',
            }),
        })

        const res = await POST(req)
        expect(res.status).toBe(403)
    })

    it('returns 400 for invalid email', async () => {
        asAdmin()

        const req = makeRequest('http://localhost:3000/api/users', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: 'not-an-email',
                firstName: 'Test',
                lastName: 'User',
                role: 'trainee',
            }),
        })

        const res = await POST(req)
        expect(res.status).toBe(400)
    })

    it('trainer creates trainee and establishes association', async () => {
        asTrainer()
        prismaMock.user.findUnique.mockResolvedValue(null)
        const createdTrainee = {
            id: 'trainee-new',
            email: 'new.trainee@example.com',
            firstName: 'New',
            lastName: 'Trainee',
            role: 'trainee',
            isActive: true,
        }
        prismaMock.user.create.mockResolvedValue(createdTrainee as never)
        prismaMock.trainerTrainee.create.mockResolvedValue({} as never)

        const req = makeRequest('http://localhost:3000/api/users', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: 'new.trainee@example.com',
                firstName: 'New',
                lastName: 'Trainee',
                role: 'trainee',
            }),
        })

        const res = await POST(req)
        expect(res.status).toBe(201)
        expect(prismaMock.trainerTrainee.create).toHaveBeenCalledWith({
            data: { trainerId: mockTrainerSession.user.id, traineeId: 'trainee-new' },
        })
    })
})

// ─── User detail ──────────────────────────────────────────────────────────────

const DETAIL_ID = 'user-1'

const detailParams = () => ({ params: Promise.resolve({ id: DETAIL_ID }) })

const detailUser = {
    id: DETAIL_ID,
    email: 'mario.rossi@example.com',
    firstName: 'Mario',
    lastName: 'Rossi',
    role: 'trainee',
    isActive: true,
    createdAt: new Date('2026-01-01'),
}

function detailRequest(options?: RequestInit) {
    return makeRequest(`http://localhost:3000/api/users/${DETAIL_ID}`, options)
}

function updateRequest(body: unknown) {
    return detailRequest({
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    })
}

describe('GET /api/users/[id]', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        asAdmin()
        prismaMock.user.findUnique.mockResolvedValue(detailUser as never)
    })

    it('returns the user for an admin without checking associations', async () => {
        const res = await getUser(detailRequest(), detailParams())
        const body = await res.json()

        expect(res.status).toBe(200)
        expect(body.data.user).toMatchObject({ id: DETAIL_ID, email: 'mario.rossi@example.com' })
        expect(prismaMock.trainerTrainee.findFirst).not.toHaveBeenCalled()
    })

    it('returns the user for a trainer who owns the trainee', async () => {
        asTrainer()
        prismaMock.trainerTrainee.findFirst.mockResolvedValue({
            trainerId: mockTrainerSession.user.id,
            traineeId: DETAIL_ID,
        } as never)

        const res = await getUser(detailRequest(), detailParams())

        expect(res.status).toBe(200)
        expect(prismaMock.trainerTrainee.findFirst).toHaveBeenCalledWith({
            where: { trainerId: mockTrainerSession.user.id, traineeId: DETAIL_ID },
        })
    })

    it('returns 403 for a trainer who does not own the trainee', async () => {
        asTrainer()
        prismaMock.trainerTrainee.findFirst.mockResolvedValue(null)

        const res = await getUser(detailRequest(), detailParams())
        const body = await res.json()

        expect(res.status).toBe(403)
        expect(body.error.key).toBe('auth.accessDenied')
    })

    it('returns 404 when the user does not exist', async () => {
        prismaMock.user.findUnique.mockResolvedValue(null)

        const res = await getUser(detailRequest(), detailParams())
        const body = await res.json()

        expect(res.status).toBe(404)
        expect(body.error.key).toBe('user.notFound')
    })

    it('returns 401 when not authenticated', async () => {
        asUnauthenticated()

        const res = await getUser(detailRequest(), detailParams())

        expect(res.status).toBe(401)
        expect(prismaMock.user.findUnique).not.toHaveBeenCalled()
    })

    it('returns 500 when the query fails', async () => {
        prismaMock.user.findUnique.mockRejectedValue(new Error('db down'))

        const res = await getUser(detailRequest(), detailParams())
        const body = await res.json()

        expect(res.status).toBe(500)
        expect(body.error.key).toBe('internal.default')
    })
})

describe('PUT /api/users/[id]', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        asAdmin()
        prismaMock.user.findUnique.mockResolvedValue(detailUser as never)
        prismaMock.user.update.mockResolvedValue({ ...detailUser, firstName: 'Marco' } as never)
    })

    it('updates the name and syncs it to the metadata cache', async () => {
        const res = await updateUser(updateRequest({ firstName: 'Marco' }), detailParams())
        const body = await res.json()

        expect(res.status).toBe(200)
        expect(body.data.user).toMatchObject({ id: DETAIL_ID, firstName: 'Marco' })
        expect(prismaMock.user.update).toHaveBeenCalledWith(
            expect.objectContaining({ where: { id: DETAIL_ID }, data: { firstName: 'Marco' } })
        )
        expect(vi.mocked(syncUserMetadata)).toHaveBeenCalledWith(DETAIL_ID, { firstName: 'Marco' })
    })

    it('syncs the last name too when both change', async () => {
        prismaMock.user.update.mockResolvedValue({ ...detailUser, firstName: 'Marco', lastName: 'Bianchi' } as never)

        await updateUser(updateRequest({ firstName: 'Marco', lastName: 'Bianchi' }), detailParams())

        expect(vi.mocked(syncUserMetadata)).toHaveBeenCalledWith(DETAIL_ID, { firstName: 'Marco', lastName: 'Bianchi' })
    })

    it('skips the metadata sync when no name changes', async () => {
        prismaMock.user.update.mockResolvedValue({ ...detailUser, isActive: false } as never)

        const res = await updateUser(updateRequest({ isActive: false }), detailParams())

        expect(res.status).toBe(200)
        expect(prismaMock.user.update).toHaveBeenCalledWith(
            expect.objectContaining({ where: { id: DETAIL_ID }, data: { isActive: false } })
        )
        expect(vi.mocked(syncUserMetadata)).not.toHaveBeenCalled()
    })

    it('lets a trainer update a trainee they own', async () => {
        asTrainer()
        prismaMock.trainerTrainee.findFirst.mockResolvedValue({
            trainerId: mockTrainerSession.user.id,
            traineeId: DETAIL_ID,
        } as never)

        const res = await updateUser(updateRequest({ firstName: 'Marco' }), detailParams())

        expect(res.status).toBe(200)
        expect(prismaMock.user.update).toHaveBeenCalledWith(
            expect.objectContaining({ where: { id: DETAIL_ID }, data: { firstName: 'Marco' } })
        )
    })

    it('returns 403 for a trainer who does not own the trainee', async () => {
        asTrainer()
        prismaMock.trainerTrainee.findFirst.mockResolvedValue(null)

        const res = await updateUser(updateRequest({ firstName: 'Marco' }), detailParams())
        const body = await res.json()

        expect(res.status).toBe(403)
        expect(body.error.key).toBe('auth.accessDenied')
        expect(prismaMock.user.update).not.toHaveBeenCalled()
    })

    it('forbids a trainer from changing the account status', async () => {
        asTrainer()
        prismaMock.trainerTrainee.findFirst.mockResolvedValue({
            trainerId: mockTrainerSession.user.id,
            traineeId: DETAIL_ID,
        } as never)

        const res = await updateUser(updateRequest({ isActive: false }), detailParams())
        const body = await res.json()

        expect(res.status).toBe(403)
        expect(body.error.key).toBe('user.cannotModifyStatus')
        expect(prismaMock.user.update).not.toHaveBeenCalled()
    })

    it('returns 400 when the email is invalid', async () => {
        const res = await updateUser(updateRequest({ email: 'not-an-email' }), detailParams())
        const body = await res.json()

        expect(res.status).toBe(400)
        expect(body.error.key).toBe('validation.invalidInput')
        expect(prismaMock.user.update).not.toHaveBeenCalled()
    })

    it('returns 404 when the user does not exist', async () => {
        prismaMock.user.findUnique.mockResolvedValue(null)

        const res = await updateUser(updateRequest({ firstName: 'Marco' }), detailParams())
        const body = await res.json()

        expect(res.status).toBe(404)
        expect(body.error.key).toBe('user.notFound')
        expect(prismaMock.user.update).not.toHaveBeenCalled()
    })

    it('returns 401 when not authenticated', async () => {
        asUnauthenticated()

        const res = await updateUser(updateRequest({ firstName: 'Marco' }), detailParams())

        expect(res.status).toBe(401)
        expect(prismaMock.user.update).not.toHaveBeenCalled()
    })

    it('returns 500 when the update fails', async () => {
        prismaMock.user.update.mockRejectedValue(new Error('db down'))

        const res = await updateUser(updateRequest({ firstName: 'Marco' }), detailParams())
        const body = await res.json()

        expect(res.status).toBe(500)
        expect(body.error.key).toBe('internal.default')
    })
})
