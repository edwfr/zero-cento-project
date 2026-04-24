import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { mockAdminSession, mockTrainerSession } from './fixtures'

vi.mock('@/lib/auth', () => ({
    requireAuth: vi.fn(),
    requireRole: vi.fn(),
    getSession: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
    prisma: {
        user: {
            findMany: vi.fn(),
            findUnique: vi.fn(),
            create: vi.fn(),
            update: vi.fn(),
            delete: vi.fn(),
            count: vi.fn(),
        },
        trainerTrainee: {
            findMany: vi.fn(),
            create: vi.fn(),
        },
    },
}))

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

vi.mock('@/lib/logger', () => ({
    logger: {
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn(),
    },
}))

import { GET, POST } from '@/app/api/users/route'
import { requireAuth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

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
    return new NextRequest(url, safeOptions as any)
}

describe('GET /api/users', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('returns all users for admin', async () => {
        vi.mocked(requireAuth).mockResolvedValue(mockAdminSession)
        vi.mocked(prisma.user.findMany).mockResolvedValue(mockUsers as any)

        const req = makeRequest()
        const res = await GET(req)
        const body = await res.json()

        expect(res.status).toBe(200)
        expect(body.data.items).toHaveLength(2)
        expect(body.data.items[0].email).toBe('mario.rossi@example.com')
    })

    it('filters by role when query param provided', async () => {
        vi.mocked(requireAuth).mockResolvedValue(mockAdminSession)
        vi.mocked(prisma.user.findMany).mockResolvedValue([mockUsers[1]] as any)

        const req = makeRequest('http://localhost:3000/api/users?role=trainer')
        const res = await GET(req)
        const body = await res.json()

        expect(res.status).toBe(200)
        // Prisma should have been called with role filter (isActive may also be present)
        expect(prisma.user.findMany).toHaveBeenCalledWith(
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
        vi.mocked(requireAuth).mockResolvedValue(mockTrainerSession)
        vi.mocked(prisma.trainerTrainee.findMany).mockResolvedValue([
            { trainee: mockUsers[0] },
        ] as any)

        const req = makeRequest()
        const res = await GET(req)
        const body = await res.json()

        expect(res.status).toBe(200)
        expect(body.data.items).toHaveLength(1)
        expect(prisma.trainerTrainee.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { trainerId: 'trainer-uuid-1' },
            })
        )
    })
})

// ─── POST /api/users ──────────────────────────────────────────────────────────

describe('POST /api/users', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('admin creates a trainer user successfully', async () => {
        vi.mocked(requireAuth).mockResolvedValue(mockAdminSession)
        vi.mocked(prisma.user.findUnique).mockResolvedValue(null)
        vi.mocked(prisma.user.create).mockResolvedValue({
            id: 'new-user-id',
            email: 'nuovo.trainer@example.com',
            firstName: 'Nuovo',
            lastName: 'Trainer',
            role: 'trainer',
            isActive: true,
        } as any)

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
    })

    it('returns 409 when email already exists', async () => {
        vi.mocked(requireAuth).mockResolvedValue(mockAdminSession)
        vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUsers[0] as any)

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
        vi.mocked(requireAuth).mockResolvedValue(mockAdminSession)

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
        vi.mocked(requireAuth).mockResolvedValue(mockTrainerSession)

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
        vi.mocked(requireAuth).mockResolvedValue(mockAdminSession)

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
        vi.mocked(requireAuth).mockResolvedValue(mockTrainerSession)
        vi.mocked(prisma.user.findUnique).mockResolvedValue(null)
        const createdTrainee = {
            id: 'trainee-new',
            email: 'new.trainee@example.com',
            firstName: 'New',
            lastName: 'Trainee',
            role: 'trainee',
            isActive: true,
        }
        vi.mocked(prisma.user.create).mockResolvedValue(createdTrainee as any)
        // Mock for trainerTrainee.create
        const mockTrainerTraineeCreate = vi.fn().mockResolvedValue({})
            ; (prisma as any).trainerTrainee = {
                ...(prisma as any).trainerTrainee,
                create: mockTrainerTraineeCreate,
            }

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
        expect(mockTrainerTraineeCreate).toHaveBeenCalled()
    })
})
