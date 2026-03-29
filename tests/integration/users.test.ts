import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// Mock auth before importing the route
const mockAdminSession = {
    user: {
        id: 'admin-uuid-1',
        email: 'admin@zerocento.it',
        firstName: 'Admin',
        lastName: 'User',
        role: 'admin' as const,
        isActive: true,
    },
    supabaseUser: {} as any,
}

const mockTrainerSession = {
    user: {
        id: 'trainer-uuid-1',
        email: 'trainer@zerocento.it',
        firstName: 'Trainer',
        lastName: 'Test',
        role: 'trainer' as const,
        isActive: true,
    },
    supabaseUser: {} as any,
}

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
    return new NextRequest(url, options)
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
        expect(body.data.users).toHaveLength(2)
        expect(body.data.users[0].email).toBe('mario.rossi@example.com')
    })

    it('filters by role when query param provided', async () => {
        vi.mocked(requireAuth).mockResolvedValue(mockAdminSession)
        vi.mocked(prisma.user.findMany).mockResolvedValue([mockUsers[1]] as any)

        const req = makeRequest('http://localhost:3000/api/users?role=trainer')
        const res = await GET(req)
        const body = await res.json()

        expect(res.status).toBe(200)
        // Prisma should have been called with role filter
        expect(prisma.user.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { role: 'trainer' },
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
})
