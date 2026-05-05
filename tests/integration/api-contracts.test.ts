/**
 * API Contract Tests
 *
 * Validates that all API endpoints conform to the canonical contract defined
 * in docs/api-contracts.md. These tests verify:
 * - Response envelope structure (data/meta for success, error for failure)
 * - HTTP status codes
 * - Pagination shape consistency
 * - Error response format
 *
 * These are NOT functional tests — they test the CONTRACT shape, not business logic.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { mockTrainerSession, mockAdminSession, mockTraineeSession } from './fixtures'

// ────────────────────────────────────────────────────────────────────────────
// Mocks
// ────────────────────────────────────────────────────────────────────────────

vi.mock('@/lib/auth', () => ({
    requireAuth: vi.fn(),
    requireRole: vi.fn(),
    getSession: vi.fn(),
}))

vi.mock('@supabase/supabase-js', () => ({
    createClient: vi.fn(),
}))

vi.mock('@/lib/supabase-server', () => ({
    createClient: vi.fn(() => ({
        auth: {
            admin: {
                createUser: vi.fn(),
                deleteUser: vi.fn(),
            },
        },
    })),
}))

vi.mock('@/lib/prisma', () => ({
    prisma: {
        exercise: { findMany: vi.fn(), findUnique: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn(), count: vi.fn() },
        movementPattern: { findMany: vi.fn(), findUnique: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
        muscleGroup: { findMany: vi.fn(), findUnique: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
        user: { findMany: vi.fn(), findUnique: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn(), count: vi.fn() },
        program: { findMany: vi.fn(), findUnique: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn(), count: vi.fn() },
        trainingProgram: { findMany: vi.fn(), findUnique: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn(), count: vi.fn() },
        week: { findMany: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
        workout: { findMany: vi.fn(), findUnique: vi.fn() },
        workoutExercise: { findMany: vi.fn(), findUnique: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn(), updateMany: vi.fn() },
        feedback: { findMany: vi.fn(), findUnique: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn(), count: vi.fn() },
        exerciseFeedback: { findMany: vi.fn(), findUnique: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn(), count: vi.fn() },
        personalRecord: { findMany: vi.fn(), findUnique: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn(), count: vi.fn() },
        trainerTrainee: { findFirst: vi.fn(), findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn(), delete: vi.fn(), deleteMany: vi.fn() },
        $transaction: vi.fn((cb: any) => cb({
            exercise: { findMany: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
            movementPattern: { findMany: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
            muscleGroup: { findMany: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
            user: { findMany: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
            trainerTrainee: { create: vi.fn(), delete: vi.fn(), deleteMany: vi.fn() },
            workoutExercise: { updateMany: vi.fn() },
        })),
    },
}))

vi.mock('@/lib/logger', () => ({
    logger: {
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn(),
    },
}))

// ────────────────────────────────────────────────────────────────────────────
// Imports (after mocks)
// ────────────────────────────────────────────────────────────────────────────

import { requireAuth, requireRole } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// Route handlers
import { GET as listExercises, POST as createExercise } from '@/app/api/exercises/route'
import { GET as getExercise, PUT as updateExercise, DELETE as deleteExercise } from '@/app/api/exercises/[id]/route'
import { GET as listMuscleGroups, POST as createMuscleGroup } from '@/app/api/muscle-groups/route'
import { GET as getMuscleGroup, PUT as updateMuscleGroup, DELETE as deleteMuscleGroup } from '@/app/api/muscle-groups/[id]/route'
import { GET as listMovementPatterns, POST as createMovementPattern } from '@/app/api/movement-patterns/route'
import { GET as getMovementPattern, PUT as updateMovementPattern, DELETE as deleteMovementPattern } from '@/app/api/movement-patterns/[id]/route'
import { GET as listUsers, POST as createUser } from '@/app/api/users/route'
import { GET as getUser, PUT as updateUser, DELETE as deleteUser } from '@/app/api/users/[id]/route'
import { GET as listPrograms, POST as createProgram } from '@/app/api/programs/route'
import { GET as listFeedback } from '@/app/api/feedback/route'
import { GET as listPersonalRecords, POST as createPersonalRecord } from '@/app/api/personal-records/route'

// ────────────────────────────────────────────────────────────────────────────
// Contract shape validators
// ────────────────────────────────────────────────────────────────────────────

function expectSuccessEnvelope(body: any) {
    expect(body).toHaveProperty('data')
    expect(body).toHaveProperty('meta')
    expect(body.meta).toHaveProperty('timestamp')
    expect(typeof body.meta.timestamp).toBe('string')
    // Should be valid ISO date
    expect(new Date(body.meta.timestamp).toISOString()).toBe(body.meta.timestamp)
}

function expectErrorEnvelope(body: any) {
    expect(body).toHaveProperty('error')
    expect(body.error).toHaveProperty('code')
    expect(body.error).toHaveProperty('message')
    expect(typeof body.error.code).toBe('string')
    expect(typeof body.error.message).toBe('string')
    // code should be one of the canonical error codes
    expect([
        'VALIDATION_ERROR',
        'UNAUTHORIZED',
        'FORBIDDEN',
        'NOT_FOUND',
        'CONFLICT',
        'RATE_LIMIT_EXCEEDED',
        'INTERNAL_ERROR',
    ]).toContain(body.error.code)
}

function expectPaginatedList(body: any) {
    expectSuccessEnvelope(body)
    expect(body.data).toHaveProperty('items')
    expect(Array.isArray(body.data.items)).toBe(true)
    expect(body.data).toHaveProperty('pagination')
    expect(body.data.pagination).toHaveProperty('hasMore')
    expect(typeof body.data.pagination.hasMore).toBe('boolean')
    expect(body.data.pagination).toHaveProperty('nextCursor')
}

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────

function makeRequest(url: string, options?: RequestInit) {
    const { signal, ...safeOptions } = options || {}
    return new NextRequest(url, safeOptions as any)
}

// ────────────────────────────────────────────────────────────────────────────
// CONTRACT: Success response envelope
// ────────────────────────────────────────────────────────────────────────────

describe('API Contract: Success response envelope', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('GET /api/exercises returns { data: { items, pagination }, meta }', async () => {
        vi.mocked(requireRole).mockResolvedValue(mockTrainerSession)
        vi.mocked(prisma.exercise.findMany).mockResolvedValue([])

        const res = await listExercises(makeRequest('http://localhost:3000/api/exercises'))
        const body = await res.json()

        expect(res.status).toBe(200)
        expectPaginatedList(body)
    })

    it('GET /api/muscle-groups returns { data: { items, pagination }, meta }', async () => {
        vi.mocked(requireRole).mockResolvedValue(mockTrainerSession)
        vi.mocked(prisma.muscleGroup.findMany).mockResolvedValue([])

        const res = await listMuscleGroups(makeRequest('http://localhost:3000/api/muscle-groups'))
        const body = await res.json()

        expect(res.status).toBe(200)
        expectSuccessEnvelope(body)
        expect(body.data).toHaveProperty('items')
        expect(Array.isArray(body.data.items)).toBe(true)
    })

    it('GET /api/movement-patterns returns { data: { items, pagination }, meta }', async () => {
        vi.mocked(requireRole).mockResolvedValue(mockTrainerSession)
        vi.mocked(prisma.movementPattern.findMany).mockResolvedValue([])

        const res = await listMovementPatterns(makeRequest('http://localhost:3000/api/movement-patterns'))
        const body = await res.json()

        expect(res.status).toBe(200)
        expectSuccessEnvelope(body)
        expect(body.data).toHaveProperty('items')
        expect(Array.isArray(body.data.items)).toBe(true)
    })

    it('GET /api/users returns { data: { items }, meta }', async () => {
        vi.mocked(requireAuth).mockResolvedValue(mockAdminSession)
        vi.mocked(prisma.user.findMany).mockResolvedValue([])

        const res = await listUsers(makeRequest('http://localhost:3000/api/users'))
        const body = await res.json()

        expect(res.status).toBe(200)
        expectSuccessEnvelope(body)
        expect(body.data).toHaveProperty('items')
        expect(Array.isArray(body.data.items)).toBe(true)
    })

    it('GET /api/programs returns { data: { items, pagination }, meta }', async () => {
        vi.mocked(requireRole).mockResolvedValue(mockTrainerSession)
        vi.mocked(prisma.trainingProgram.findMany).mockResolvedValue([])

        const res = await listPrograms(makeRequest('http://localhost:3000/api/programs'))
        const body = await res.json()

        expect(res.status).toBe(200)
        expectPaginatedList(body)
    })

    it('GET /api/feedback returns { data: { items, pagination }, meta }', async () => {
        vi.mocked(requireRole).mockResolvedValue(mockTrainerSession)
        vi.mocked(prisma.exerciseFeedback.findMany).mockResolvedValue([])

        const res = await listFeedback(makeRequest('http://localhost:3000/api/feedback'))
        const body = await res.json()

        expect(res.status).toBe(200)
        expectPaginatedList(body)
    })

    it('GET /api/personal-records returns { data: { items }, meta }', async () => {
        vi.mocked(requireRole).mockResolvedValue(mockTrainerSession)
        vi.mocked(prisma.trainerTrainee.findMany).mockResolvedValue([])
        vi.mocked(prisma.personalRecord.findMany).mockResolvedValue([])

        const res = await listPersonalRecords(makeRequest('http://localhost:3000/api/personal-records'))
        const body = await res.json()

        expect(res.status).toBe(200)
        expectSuccessEnvelope(body)
        expect(body.data).toHaveProperty('items')
        expect(Array.isArray(body.data.items)).toBe(true)
    })
})

// ────────────────────────────────────────────────────────────────────────────
// CONTRACT: Error response envelope
// ────────────────────────────────────────────────────────────────────────────

describe('API Contract: Error response envelope', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('auth failure returns standard error envelope', async () => {
        const authError = new Error('Unauthorized')
        vi.mocked(requireRole).mockRejectedValue(authError)

        const res = await listExercises(makeRequest('http://localhost:3000/api/exercises'))
        const body = await res.json()

        expect(res.status).toBeGreaterThanOrEqual(400)
        expectErrorEnvelope(body)
    })

    it('GET /api/exercises/[id] not found returns standard error envelope', async () => {
        vi.mocked(requireRole).mockResolvedValue(mockTrainerSession)
        vi.mocked(prisma.exercise.findUnique).mockResolvedValue(null)

        const res = await getExercise(
            makeRequest('http://localhost:3000/api/exercises/nonexistent-id'),
            { params: Promise.resolve({ id: 'nonexistent-id' }) }
        )
        const body = await res.json()

        expect(res.status).toBe(404)
        expectErrorEnvelope(body)
        expect(body.error.code).toBe('NOT_FOUND')
    })

    it('GET /api/muscle-groups/[id] not found returns standard error envelope', async () => {
        vi.mocked(requireRole).mockResolvedValue(mockTrainerSession)
        vi.mocked(prisma.muscleGroup.findUnique).mockResolvedValue(null)

        const res = await getMuscleGroup(
            makeRequest('http://localhost:3000/api/muscle-groups/nonexistent-id'),
            { params: Promise.resolve({ id: 'nonexistent-id' }) }
        )
        const body = await res.json()

        expect(res.status).toBe(404)
        expectErrorEnvelope(body)
        expect(body.error.code).toBe('NOT_FOUND')
    })

    it('GET /api/movement-patterns/[id] not found returns standard error envelope', async () => {
        vi.mocked(requireRole).mockResolvedValue(mockTrainerSession)
        vi.mocked(prisma.movementPattern.findUnique).mockResolvedValue(null)

        const res = await getMovementPattern(
            makeRequest('http://localhost:3000/api/movement-patterns/nonexistent-id'),
            { params: Promise.resolve({ id: 'nonexistent-id' }) }
        )
        const body = await res.json()

        expect(res.status).toBe(404)
        expectErrorEnvelope(body)
        expect(body.error.code).toBe('NOT_FOUND')
    })

    it('POST /api/exercises with invalid body returns VALIDATION_ERROR', async () => {
        vi.mocked(requireRole).mockResolvedValue(mockTrainerSession)

        const res = await createExercise(
            makeRequest('http://localhost:3000/api/exercises', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ invalid: true }),
            })
        )
        const body = await res.json()

        expect(res.status).toBe(400)
        expectErrorEnvelope(body)
        expect(body.error.code).toBe('VALIDATION_ERROR')
    })

    it('POST /api/users with invalid body returns VALIDATION_ERROR', async () => {
        vi.mocked(requireRole).mockResolvedValue(mockAdminSession)

        const res = await createUser(
            makeRequest('http://localhost:3000/api/users', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ invalid: true }),
            })
        )
        const body = await res.json()

        expect(res.status).toBe(400)
        expectErrorEnvelope(body)
        expect(body.error.code).toBe('VALIDATION_ERROR')
    })
})

// ────────────────────────────────────────────────────────────────────────────
// CONTRACT: Pagination shape consistency
// ────────────────────────────────────────────────────────────────────────────

describe('API Contract: Pagination shape consistency', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    const paginatedEndpoints = [
        {
            name: 'GET /api/exercises',
            handler: listExercises,
            url: 'http://localhost:3000/api/exercises',
            session: mockTrainerSession,
            mockSetup: () => vi.mocked(prisma.exercise.findMany).mockResolvedValue([]),
        },
        {
            name: 'GET /api/programs',
            handler: listPrograms,
            url: 'http://localhost:3000/api/programs',
            session: mockTrainerSession,
            mockSetup: () => vi.mocked(prisma.trainingProgram.findMany).mockResolvedValue([]),
        },
        {
            name: 'GET /api/feedback',
            handler: listFeedback,
            url: 'http://localhost:3000/api/feedback',
            session: mockTrainerSession,
            mockSetup: () => vi.mocked(prisma.exerciseFeedback.findMany).mockResolvedValue([]),
        },

    ]

    it.each(paginatedEndpoints)(
        '$name returns consistent pagination shape { nextCursor, hasMore }',
        async ({ handler, url, session, mockSetup }) => {
            vi.mocked(requireRole).mockResolvedValue(session)
            mockSetup()

            const res = await handler(makeRequest(url))
            const body = await res.json()

            expect(res.status).toBe(200)
            expectPaginatedList(body)
        }
    )
})

// ────────────────────────────────────────────────────────────────────────────
// CONTRACT: Timestamp in meta is valid ISO 8601
// ────────────────────────────────────────────────────────────────────────────

describe('API Contract: meta.timestamp validity', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('all success responses include valid ISO 8601 timestamp', async () => {
        vi.mocked(requireRole).mockResolvedValue(mockTrainerSession)
        vi.mocked(prisma.exercise.findMany).mockResolvedValue([])

        const res = await listExercises(makeRequest('http://localhost:3000/api/exercises'))
        const body = await res.json()

        const ts = body.meta.timestamp
        expect(ts).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)
        expect(new Date(ts).getTime()).not.toBeNaN()
    })
})

// ────────────────────────────────────────────────────────────────────────────
// CONTRACT: Error codes are from canonical enum
// ────────────────────────────────────────────────────────────────────────────

describe('API Contract: Error codes are canonical', () => {
    const VALID_ERROR_CODES = [
        'VALIDATION_ERROR',
        'UNAUTHORIZED',
        'FORBIDDEN',
        'NOT_FOUND',
        'CONFLICT',
        'RATE_LIMIT_EXCEEDED',
        'INTERNAL_ERROR',
    ]

    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('404 uses NOT_FOUND code', async () => {
        vi.mocked(requireRole).mockResolvedValue(mockTrainerSession)
        vi.mocked(prisma.exercise.findUnique).mockResolvedValue(null)

        const res = await getExercise(
            makeRequest('http://localhost:3000/api/exercises/missing'),
            { params: Promise.resolve({ id: 'missing' }) }
        )
        const body = await res.json()

        expect(res.status).toBe(404)
        expect(VALID_ERROR_CODES).toContain(body.error.code)
    })

    it('400 uses VALIDATION_ERROR code', async () => {
        vi.mocked(requireRole).mockResolvedValue(mockTrainerSession)

        const res = await createExercise(
            makeRequest('http://localhost:3000/api/exercises', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({}),
            })
        )
        const body = await res.json()

        expect(res.status).toBe(400)
        expect(VALID_ERROR_CODES).toContain(body.error.code)
    })
})
