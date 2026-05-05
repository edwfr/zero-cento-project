import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { mockTrainerSession, mockTraineeSession } from './fixtures'

const withIdParam = (id: string) => ({ params: Promise.resolve({ id }) })

// ─── Mocks ───────────────────────────────────────────────────────────────────

vi.mock('@/lib/auth', () => ({
    requireRole: vi.fn(),
    requireAuth: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
    prisma: {
        workoutExercise: {
            findFirst: vi.fn(),
            update: vi.fn(),
        },
        $transaction: vi.fn((fn: any) => fn({
            workoutExercise: {
                findFirst: vi.fn(),
                update: vi.fn(),
                count: vi.fn(),
            },
            workout: {
                findUnique: vi.fn(),
                count: vi.fn(),
            },
            week: {
                findUnique: vi.fn(),
                count: vi.fn(),
            },
            trainingProgram: {
                findUnique: vi.fn(),
                update: vi.fn(),
            },
        })),
    },
}))

vi.mock('@/lib/completion-service', () => ({
    cascadeCompletion: vi.fn(),
}))

import { PATCH } from '@/app/api/trainee/workout-exercises/[id]/complete/route'
import { requireRole } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { cascadeCompletion } from '@/lib/completion-service'

// ─── Fixture UUIDs ────────────────────────────────────────────────────────────

const UUIDS = {
    we: '11111111-1111-1111-1111-111111111111',
    workout: '22222222-2222-2222-2222-222222222222',
    week: '33333333-3333-3333-3333-333333333333',
    program: '44444444-4444-4444-4444-444444444444',
}

// File-specific session for unauthorized trainee
const mockTraineeOtherSession = {
    user: {
        id: 'trainee-uuid-2',
        email: 'luigi@zerocento.it',
        firstName: 'Luigi',
        lastName: 'Atleta',
        role: 'trainee' as const,
        isActive: true,
    },
    supabaseUser: {} as any,
}

const mockCascadeResult = {
    workoutExercise: { id: UUIDS.we, isCompleted: true },
    workout: { id: UUIDS.workout, isCompleted: true },
    week: { id: UUIDS.week, weekNumber: 1, isCompleted: true },
    program: { id: UUIDS.program, status: 'completed' as const },
}

const mockWorkoutExercise = {
    id: UUIDS.we,
    workoutId: UUIDS.workout,
    workout: {
        id: UUIDS.workout,
        weekId: UUIDS.week,
        week: {
            id: UUIDS.week,
            programId: UUIDS.program,
            program: {
                id: UUIDS.program,
                traineeId: 'trainee-uuid-1',
                status: 'active' as const,
            },
        },
    },
}

// Helper to build a NextRequest
function makeRequest(url = `http://localhost:3000/api/trainee/workout-exercises/${UUIDS.we}/complete`, options?: RequestInit) {
    const { signal, ...safeOptions } = options || {}
    return new NextRequest(url, safeOptions as any)
}

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/trainee/workout-exercises/[id]/complete
// ─────────────────────────────────────────────────────────────────────────────

describe('PATCH /api/trainee/workout-exercises/[id]/complete', () => {
    beforeEach(() => {
        vi.clearAllMocks()

        // Default: ownership check passes unless a test overrides it.
        vi.mocked(prisma.workoutExercise.findFirst).mockResolvedValue({ id: UUIDS.we } as any)
        vi.mocked(cascadeCompletion).mockResolvedValue(mockCascadeResult)
    })

    it('returns 200 OK with cascade result when exercise is marked complete', async () => {
        vi.mocked(requireRole).mockResolvedValue(mockTraineeSession)

        const req = makeRequest(
            `http://localhost:3000/api/trainee/workout-exercises/${UUIDS.we}/complete`,
            {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ isCompleted: true }),
            }
        )

        const res = await PATCH(req, withIdParam(UUIDS.we))
        const body = await res.json()

        expect(res.status).toBe(200)
        expect(body.data).toEqual(mockCascadeResult)
    })

    it('returns 400 when validation fails (missing isCompleted)', async () => {
        vi.mocked(requireRole).mockResolvedValue(mockTraineeSession)

        const req = makeRequest(
            `http://localhost:3000/api/trainee/workout-exercises/${UUIDS.we}/complete`,
            {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({}), // Missing isCompleted
            }
        )

        const res = await PATCH(req, withIdParam(UUIDS.we))
        const body = await res.json()

        expect(res.status).toBe(400)
        expect(body.error.code).toBe('VALIDATION_ERROR')
    })

    it('returns 400 when isCompleted is not a boolean', async () => {
        vi.mocked(requireRole).mockResolvedValue(mockTraineeSession)

        const req = makeRequest(
            `http://localhost:3000/api/trainee/workout-exercises/${UUIDS.we}/complete`,
            {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ isCompleted: 'yes' }), // Invalid type
            }
        )

        const res = await PATCH(req, withIdParam(UUIDS.we))
        const body = await res.json()

        expect(res.status).toBe(400)
        expect(body.error.code).toBe('VALIDATION_ERROR')
    })

    it('returns 401 when not authenticated', async () => {
        vi.mocked(requireRole).mockRejectedValue(
            new Response(JSON.stringify({ error: { code: 'UNAUTHORIZED' } }), {
                status: 401,
                headers: { 'Content-Type': 'application/json' },
            })
        )

        const req = makeRequest(
            `http://localhost:3000/api/trainee/workout-exercises/${UUIDS.we}/complete`,
            {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ isCompleted: true }),
            }
        )

        const res = await PATCH(req, withIdParam(UUIDS.we))

        expect(res.status).toBe(401)
    })

    it('returns 403 when trainee does not own the exercise', async () => {
        vi.mocked(requireRole).mockResolvedValue(mockTraineeOtherSession)

        vi.mocked(prisma.workoutExercise.findFirst).mockResolvedValue(null) // Different trainee

        const req = makeRequest(
            `http://localhost:3000/api/trainee/workout-exercises/${UUIDS.we}/complete`,
            {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ isCompleted: true }),
            }
        )

        const res = await PATCH(req, withIdParam(UUIDS.we))
        const body = await res.json()

        expect(res.status).toBe(404)
        expect(body.error.code).toBe('NOT_FOUND')
    })

    it('returns 404 when workout exercise not found', async () => {
        vi.mocked(requireRole).mockResolvedValue(mockTraineeSession)

        vi.mocked(prisma.workoutExercise.findFirst).mockResolvedValue(null)

        const req = makeRequest(
            `http://localhost:3000/api/trainee/workout-exercises/${UUIDS.we}/complete`,
            {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ isCompleted: true }),
            }
        )

        const res = await PATCH(req, withIdParam(UUIDS.we))
        const body = await res.json()

        expect(res.status).toBe(404)
        expect(body.error.code).toBe('NOT_FOUND')
    })

    it('handles toggle from true to false (de-completion)', async () => {
        vi.mocked(requireRole).mockResolvedValue(mockTraineeSession)

        const mockDecompletionResult = {
            workoutExercise: { id: UUIDS.we, isCompleted: false },
            workout: { id: UUIDS.workout, isCompleted: false },
            week: { id: UUIDS.week, weekNumber: 1, isCompleted: false },
            program: { id: UUIDS.program, status: 'active' as const },
        }
        vi.mocked(cascadeCompletion).mockResolvedValue(mockDecompletionResult)

        const req = makeRequest(
            `http://localhost:3000/api/trainee/workout-exercises/${UUIDS.we}/complete`,
            {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ isCompleted: false }),
            }
        )

        const res = await PATCH(req, withIdParam(UUIDS.we))
        const body = await res.json()

        expect(res.status).toBe(200)
        expect(body.data.workoutExercise.isCompleted).toBe(false)
        expect(body.data.program.status).toBe('active')
    })

    it('performs ownership check before updating', async () => {
        vi.mocked(requireRole).mockResolvedValue(mockTraineeSession)

        const verifyCall = vi.fn().mockResolvedValue(mockWorkoutExercise)
        vi.mocked(prisma.workoutExercise.findFirst).mockImplementation(verifyCall)

        const req = makeRequest(
            `http://localhost:3000/api/trainee/workout-exercises/${UUIDS.we}/complete`,
            {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ isCompleted: true }),
            }
        )

        await PATCH(req, withIdParam(UUIDS.we))

        // Verify ownership was checked with nested query
        expect(verifyCall).toHaveBeenCalledWith({
            where: {
                id: UUIDS.we,
                workout: {
                    week: {
                        program: {
                            traineeId: 'trainee-uuid-1',
                        },
                    },
                },
            },
            select: { id: true },
        })
    })
})
