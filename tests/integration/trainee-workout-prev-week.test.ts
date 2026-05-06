import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { mockTraineeSession } from './fixtures'

vi.mock('@/lib/auth', () => ({
    requireRole: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
    prisma: {
        $queryRaw: vi.fn(),
    },
}))

vi.mock('@/lib/logger', () => ({
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

import { GET } from '@/app/api/trainee/workouts/[id]/prev-week/route'
import { requireRole } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const withIdParam = (id: string) => ({ params: Promise.resolve({ id }) })

function makeRequest(url = 'http://localhost:3000/api/trainee/workouts/workout-1/prev-week') {
    return new NextRequest(url)
}

describe('GET /api/trainee/workouts/[id]/prev-week', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        vi.mocked(requireRole).mockResolvedValue(mockTraineeSession)
    })

    it('returns grouped exercises and latest feedback sets from previous week', async () => {
        vi.mocked(prisma.$queryRaw).mockResolvedValue([
            {
                weId: 'we-1',
                exerciseName: 'Back Squat',
                order: 1,
                targetSets: 3,
                targetReps: '5',
                setNumber: 1,
                setReps: 5,
                setWeight: 120,
                setCompleted: true,
            },
            {
                weId: 'we-1',
                exerciseName: 'Back Squat',
                order: 1,
                targetSets: 3,
                targetReps: '5',
                setNumber: 2,
                setReps: 5,
                setWeight: 120,
                setCompleted: true,
            },
            {
                weId: 'we-2',
                exerciseName: 'Leg Curl',
                order: 2,
                targetSets: 2,
                targetReps: '12',
                setNumber: null,
                setReps: null,
                setWeight: null,
                setCompleted: null,
            },
        ])

        const res = await GET(makeRequest(), withIdParam('workout-1'))
        const json = await res.json()

        expect(res.status).toBe(200)
        expect(requireRole).toHaveBeenCalledWith(['trainee'])
        expect(prisma.$queryRaw).toHaveBeenCalledTimes(1)
        expect(json.data.exercises).toEqual([
            {
                id: 'we-1',
                exerciseName: 'Back Squat',
                order: 1,
                targetSets: 3,
                targetReps: '5',
                exerciseNote: null,
                sets: [
                    { setNumber: 1, reps: 5, weight: 120, completed: true },
                    { setNumber: 2, reps: 5, weight: 120, completed: true },
                ],
            },
            {
                id: 'we-2',
                exerciseName: 'Leg Curl',
                order: 2,
                targetSets: 2,
                targetReps: '12',
                exerciseNote: null,
                sets: [],
            },
        ])
    })

    it('returns an empty exercises array when previous week does not exist', async () => {
        vi.mocked(prisma.$queryRaw).mockResolvedValue([])

        const res = await GET(makeRequest(), withIdParam('workout-1'))
        const json = await res.json()

        expect(res.status).toBe(200)
        expect(json.data.exercises).toEqual([])
    })

    it('returns upstream auth response when requireRole throws Response', async () => {
        vi.mocked(requireRole).mockRejectedValue(new Response('Unauthorized', { status: 401 }))

        const res = await GET(makeRequest(), withIdParam('workout-1'))

        expect(res.status).toBe(401)
    })
})
