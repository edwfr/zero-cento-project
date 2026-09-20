import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const mockAdminSession = {
    user: {
        id: 'admin-uuid-1',
        email: 'admin@zerocento.it',
        firstName: 'Admin',
        lastName: 'User',
        role: 'admin' as const,
        isActive: true,
    },
    supabaseUser: {} as never,
}

const mockTrainerSession = {
    user: {
        id: 'trainer-uuid-1',
        email: 'trainer@zerocento.it',
        firstName: 'Marco',
        lastName: 'Trainer',
        role: 'trainer' as const,
        isActive: true,
    },
    supabaseUser: {} as never,
}

vi.mock('@/lib/auth', async () => (await import('../helpers/auth-module-mock')).authModuleMock())

vi.mock('@/lib/logger', () => ({
    logger: {
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn(),
    },
}))

import { GET as getMovementPatterns, POST as postMovementPattern } from '@/app/api/movement-patterns/route'
import { GET as getMuscleGroups, POST as postMuscleGroup } from '@/app/api/muscle-groups/route'
import { prismaMock } from '../helpers/prisma-mock'
import { mockTrainerSession, mockAdminSession } from '../helpers/sessions'
import { asTrainer, asAdmin, asUnauthenticated } from '../helpers/auth-mock'

function makeRequest(url: string, options?: RequestInit) {
    const { signal, ...safeOptions } = options || {}
    return new NextRequest(url, safeOptions as never)
}

// ─── Movement Patterns ────────────────────────────────────────────────────────

describe('GET /api/movement-patterns', () => {
    beforeEach(() => { vi.clearAllMocks() })

    const mockPatterns = [
        { id: 'mp-1', name: 'Spinta Orizzontale', isActive: true, creator: { firstName: 'Marco', lastName: 'T' } },
        { id: 'mp-2', name: 'Tirata Verticale', isActive: true, creator: { firstName: 'Marco', lastName: 'T' } },
    ]

    it('returns active movement patterns for authenticated user', async () => {
        asTrainer()
        prismaMock.movementPattern.findMany.mockResolvedValue(mockPatterns as never)

        const req = makeRequest('http://localhost:3000/api/movement-patterns')
        const res = await getMovementPatterns(req)
        const body = await res.json()

        expect(res.status).toBe(200)
        expect(body.data.items).toHaveLength(2)
    })

    it('includes inactive patterns when includeInactive=true', async () => {
        asAdmin()
        prismaMock.movementPattern.findMany.mockResolvedValue(mockPatterns as never)

        const req = makeRequest('http://localhost:3000/api/movement-patterns?includeInactive=true')
        await getMovementPatterns(req)

        expect(prismaMock.movementPattern.findMany).toHaveBeenCalledWith(
            expect.objectContaining({ where: undefined })
        )
    })

    it('returns 401 when not authenticated', async () => {asUnauthenticated()

        const req = makeRequest('http://localhost:3000/api/movement-patterns')
        const res = await getMovementPatterns(req)
        expect(res.status).toBe(401)
    })
})

describe('POST /api/movement-patterns', () => {
    beforeEach(() => { vi.clearAllMocks() })

    it('creates a new movement pattern as trainer', async () => {
        asTrainer()
        prismaMock.movementPattern.findUnique.mockResolvedValue(null)
        prismaMock.movementPattern.create.mockResolvedValue({
            id: 'mp-new',
            name: 'Squat Pattern',
            isActive: true,
        } as never)

        const req = makeRequest('http://localhost:3000/api/movement-patterns', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: 'Squat Pattern' }),
        })

        const res = await postMovementPattern(req)
        expect(res.status).toBe(201)
    })

    it('returns 409 when pattern name already exists', async () => {
        asTrainer()
        prismaMock.movementPattern.findUnique.mockResolvedValue({
            id: 'existing', name: 'Squat Pattern',
        } as never)

        const req = makeRequest('http://localhost:3000/api/movement-patterns', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: 'Squat Pattern' }),
        })

        const res = await postMovementPattern(req)
        expect(res.status).toBe(409)
    })

    it('returns 400 for validation error (name too short)', async () => {
        asTrainer()

        const req = makeRequest('http://localhost:3000/api/movement-patterns', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: 'X' }),
        })

        const res = await postMovementPattern(req)
        expect(res.status).toBe(400)
    })
})

// ─── Muscle Groups ────────────────────────────────────────────────────────────

describe('GET /api/muscle-groups', () => {
    beforeEach(() => { vi.clearAllMocks() })

    const mockGroups = [
        { id: 'mg-1', name: 'Pettorali', isActive: true, creator: { firstName: 'Marco', lastName: 'T' } },
        { id: 'mg-2', name: 'Dorsali', isActive: true, creator: { firstName: 'Marco', lastName: 'T' } },
    ]

    it('returns active muscle groups for authenticated user', async () => {
        asTrainer()
        prismaMock.muscleGroup.findMany.mockResolvedValue(mockGroups as never)

        const req = makeRequest('http://localhost:3000/api/muscle-groups')
        const res = await getMuscleGroups(req)
        const body = await res.json()

        expect(res.status).toBe(200)
        expect(body.data.items).toHaveLength(2)
    })

    it('includes inactive groups when includeInactive=true', async () => {
        asAdmin()
        prismaMock.muscleGroup.findMany.mockResolvedValue(mockGroups as never)

        const req = makeRequest('http://localhost:3000/api/muscle-groups?includeInactive=true')
        await getMuscleGroups(req)

        expect(prismaMock.muscleGroup.findMany).toHaveBeenCalledWith(
            expect.objectContaining({ where: undefined })
        )
    })

    it('returns 401 when not authenticated', async () => {asUnauthenticated()

        const req = makeRequest('http://localhost:3000/api/muscle-groups')
        const res = await getMuscleGroups(req)
        expect(res.status).toBe(401)
    })
})

describe('POST /api/muscle-groups', () => {
    beforeEach(() => { vi.clearAllMocks() })

    it('creates a new muscle group as trainer', async () => {
        asTrainer()
        prismaMock.muscleGroup.findUnique.mockResolvedValue(null)
        prismaMock.muscleGroup.create.mockResolvedValue({
            id: 'mg-new',
            name: 'Quadricipiti',
            isActive: true,
        } as never)

        const req = makeRequest('http://localhost:3000/api/muscle-groups', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: 'Quadricipiti' }),
        })

        const res = await postMuscleGroup(req)
        expect(res.status).toBe(201)
    })

    it('returns 409 when group name already exists', async () => {
        asTrainer()
        prismaMock.muscleGroup.findUnique.mockResolvedValue({
            id: 'existing', name: 'Quadricipiti',
        } as never)

        const req = makeRequest('http://localhost:3000/api/muscle-groups', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: 'Quadricipiti' }),
        })

        const res = await postMuscleGroup(req)
        expect(res.status).toBe(409)
    })

    it('returns 400 for validation error (name too short)', async () => {
        asTrainer()

        const req = makeRequest('http://localhost:3000/api/muscle-groups', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: 'X' }),
        })

        const res = await postMuscleGroup(req)
        expect(res.status).toBe(400)
    })
})
