import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { mockTrainerSession, mockAdminSession, mockTraineeSession } from './fixtures'

const withIdParam = (id: string) => ({ params: Promise.resolve({ id }) })

// ────────────────────────────────────────────────────────────────────────────
// Mocks
// ────────────────────────────────────────────────────────────────────────────

vi.mock('@/lib/auth', () => ({
    requireAuth: vi.fn(),
    requireRole: vi.fn(),
    getSession: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
    prisma: {
        exercise: {
            findMany: vi.fn(),
            findUnique: vi.fn(),
            findFirst: vi.fn(),
            create: vi.fn(),
            update: vi.fn(),
            delete: vi.fn(),
            count: vi.fn(),
        },
        movementPattern: {
            findUnique: vi.fn(),
        },
        muscleGroup: {
            findMany: vi.fn(),
        },
        workoutExercise: {
            findMany: vi.fn(),
        },
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

import { GET as listExercises, POST as createExercise } from '@/app/api/exercises/route'
import { GET as getExercise, PUT as updateExercise, DELETE as deleteExercise } from '@/app/api/exercises/[id]/route'
import { requireRole } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// ────────────────────────────────────────────────────────────────────────────
// Fixture data  (all IDs are valid UUIDs to pass schema validation)
// ────────────────────────────────────────────────────────────────────────────

// Fixed UUIDs used consistently across all fixtures
const MP_ID = '11111111-1111-1111-1111-111111111111'
const MG_ID_1 = '22222222-2222-2222-2222-222222222221'
const MG_ID_2 = '22222222-2222-2222-2222-222222222222'
const EX_ID_1 = '33333333-3333-3333-3333-333333333331'
const EX_ID_2 = '33333333-3333-3333-3333-333333333332'

const mockMovementPattern = {
    id: MP_ID,
    name: 'Hip Hinge',
    description: "Movimenti che coinvolgono la cerniera dell'anca",
    createdBy: 'trainer-uuid-1',
    isActive: true,
    createdAt: new Date('2026-01-01'),
}

const mockMuscleGroups = [
    {
        id: MG_ID_1,
        name: 'Quadricipiti',
        description: 'Parte anteriore della coscia',
        createdBy: 'trainer-uuid-1',
        isActive: true,
        createdAt: new Date('2026-01-01'),
    },
    {
        id: MG_ID_2,
        name: 'Glutei',
        description: 'Muscoli glutei',
        createdBy: 'trainer-uuid-1',
        isActive: true,
        createdAt: new Date('2026-01-01'),
    },
]

/** Exercise with all relations populated (as Prisma would return it) */
const mockExerciseWithRelations = {
    id: EX_ID_1,
    name: 'Squat',
    description: 'Back squat with barbell',
    youtubeUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    type: 'fundamental',
    movementPatternId: MP_ID,
    notes: ['Keep chest up', 'Drive knees out'],
    createdBy: 'trainer-uuid-1',
    createdAt: new Date('2026-01-15'),
    movementPattern: { id: MP_ID, name: 'Hip Hinge' },
    exerciseMuscleGroups: [
        {
            id: '44444444-4444-4444-4444-444444444441',
            exerciseId: EX_ID_1,
            muscleGroupId: MG_ID_1,
            coefficient: 0.6,
            muscleGroup: { id: MG_ID_1, name: 'Quadricipiti' },
        },
        {
            id: '44444444-4444-4444-4444-444444444442',
            exerciseId: EX_ID_1,
            muscleGroupId: MG_ID_2,
            coefficient: 0.4,
            muscleGroup: { id: MG_ID_2, name: 'Glutei' },
        },
    ],
    creator: { firstName: 'Marco', lastName: 'Trainer' },
}

const mockAccessoryExercise = {
    id: EX_ID_2,
    name: 'Leg Press',
    description: 'Machine leg press',
    youtubeUrl: 'https://www.youtube.com/watch?v=abc123456789',
    type: 'accessory',
    movementPatternId: MP_ID,
    notes: [],
    createdBy: 'trainer-uuid-1',
    createdAt: new Date('2026-01-20'),
    movementPattern: { id: MP_ID, name: 'Hip Hinge' },
    exerciseMuscleGroups: [
        {
            id: '44444444-4444-4444-4444-444444444443',
            exerciseId: EX_ID_2,
            muscleGroupId: MG_ID_1,
            coefficient: 0.9,
            muscleGroup: { id: MG_ID_1, name: 'Quadricipiti' },
        },
    ],
    creator: { firstName: 'Marco', lastName: 'Trainer' },
}

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────

function makeListRequest(url = 'http://localhost:3000/api/exercises', options?: RequestInit) {
    const { signal, ...safeOptions } = options || {}
    return new NextRequest(url, safeOptions as any)
}

function makeDetailRequest(
    id: string,
    url?: string,
    options?: RequestInit
) {
    const { signal, ...safeOptions } = options || {}
    return new NextRequest(url ?? `http://localhost:3000/api/exercises/${id}`, safeOptions as any)
}

// ────────────────────────────────────────────────────────────────────────────
// GET /api/exercises
// ────────────────────────────────────────────────────────────────────────────

describe('GET /api/exercises', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('returns exercise list with nested movementPattern and muscleGroups', async () => {
        vi.mocked(requireRole).mockResolvedValue(mockTrainerSession)
        vi.mocked(prisma.exercise.findMany).mockResolvedValue([mockExerciseWithRelations] as any)

        const req = makeListRequest()
        const res = await listExercises(req)
        const body = await res.json()

        expect(res.status).toBe(200)
        const item = body.data.items[0]
        expect(item.id).toBe(EX_ID_1)
        expect(item.movementPattern).toEqual({ id: MP_ID, name: 'Hip Hinge' })
        expect(item.exerciseMuscleGroups).toHaveLength(2)
        expect(item.exerciseMuscleGroups[0].muscleGroup.name).toBe('Quadricipiti')
        expect(item.exerciseMuscleGroups[0].coefficient).toBe(0.6)
    })

    it('returns pagination metadata (nextCursor + hasMore)', async () => {
        // Return limit+1 exercises to simulate "has more"
        const manyExercises = Array.from({ length: 21 }, (_, i) => ({
            ...mockExerciseWithRelations,
            id: `ex-uuid-${i + 1}`,
            name: `Squat ${i + 1}`,
        }))
        vi.mocked(requireRole).mockResolvedValue(mockTrainerSession)
        vi.mocked(prisma.exercise.findMany).mockResolvedValue(manyExercises as any)

        const req = makeListRequest('http://localhost:3000/api/exercises?limit=20')
        const res = await listExercises(req)
        const body = await res.json()

        expect(res.status).toBe(200)
        expect(body.data.pagination.hasMore).toBe(true)
        expect(body.data.pagination.nextCursor).toBe('ex-uuid-20')
        expect(body.data.items).toHaveLength(20)
    })

    it('returns hasMore=false and nextCursor=null when results fit in one page', async () => {
        vi.mocked(requireRole).mockResolvedValue(mockTrainerSession)
        vi.mocked(prisma.exercise.findMany).mockResolvedValue([mockExerciseWithRelations] as any)

        const req = makeListRequest()
        const res = await listExercises(req)
        const body = await res.json()

        expect(res.status).toBe(200)
        expect(body.data.pagination.hasMore).toBe(false)
        expect(body.data.pagination.nextCursor).toBeNull()
    })

    it('filters by type=fundamental and passes where clause to prisma', async () => {
        vi.mocked(requireRole).mockResolvedValue(mockTrainerSession)
        vi.mocked(prisma.exercise.findMany).mockResolvedValue([mockExerciseWithRelations] as any)

        const req = makeListRequest('http://localhost:3000/api/exercises?type=fundamental')
        await listExercises(req)

        expect(prisma.exercise.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({ type: 'fundamental' }),
            })
        )
    })

    it('filters by movementPatternId and passes where clause to prisma', async () => {
        vi.mocked(requireRole).mockResolvedValue(mockTrainerSession)
        vi.mocked(prisma.exercise.findMany).mockResolvedValue([mockExerciseWithRelations] as any)

        const req = makeListRequest(
            `http://localhost:3000/api/exercises?movementPatternId=${MP_ID}`
        )
        await listExercises(req)

        expect(prisma.exercise.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({ movementPatternId: MP_ID }),
            })
        )
    })

    it('filters by muscleGroupId using nested some query', async () => {
        vi.mocked(requireRole).mockResolvedValue(mockTrainerSession)
        vi.mocked(prisma.exercise.findMany).mockResolvedValue([mockExerciseWithRelations] as any)

        const req = makeListRequest(
            `http://localhost:3000/api/exercises?muscleGroupId=${MG_ID_1}`
        )
        await listExercises(req)

        expect(prisma.exercise.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({
                    exerciseMuscleGroups: { some: { muscleGroupId: MG_ID_1 } },
                }),
            })
        )
    })

    it('performs case-insensitive search across name and description', async () => {
        vi.mocked(requireRole).mockResolvedValue(mockTrainerSession)
        vi.mocked(prisma.exercise.findMany).mockResolvedValue([mockExerciseWithRelations] as any)

        const req = makeListRequest('http://localhost:3000/api/exercises?search=squat')
        await listExercises(req)

        expect(prisma.exercise.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({
                    OR: [
                        { name: { contains: 'squat', mode: 'insensitive' } },
                        { description: { contains: 'squat', mode: 'insensitive' } },
                    ],
                }),
            })
        )
    })

    it('returns 400 when search param is too short (< 2 chars)', async () => {
        vi.mocked(requireRole).mockResolvedValue(mockTrainerSession)

        const req = makeListRequest('http://localhost:3000/api/exercises?search=x')
        const res = await listExercises(req)

        expect(res.status).toBe(400)
    })

    it('returns 400 when search param is too long (> 100 chars)', async () => {
        vi.mocked(requireRole).mockResolvedValue(mockTrainerSession)

        const longSearch = 'a'.repeat(101)
        const req = makeListRequest(`http://localhost:3000/api/exercises?search=${longSearch}`)
        const res = await listExercises(req)

        expect(res.status).toBe(400)
    })

    it('trainee can list exercises (READ access allowed)', async () => {
        vi.mocked(requireRole).mockResolvedValue(mockTraineeSession)
        vi.mocked(prisma.exercise.findMany).mockResolvedValue([mockExerciseWithRelations] as any)

        const req = makeListRequest()
        const res = await listExercises(req)

        expect(res.status).toBe(200)
    })

    it('returns 401 when unauthenticated', async () => {
        vi.mocked(requireRole).mockRejectedValue(
            Response.json({ error: { code: 'UNAUTHORIZED' } }, { status: 401 })
        )

        const req = makeListRequest()
        const res = await listExercises(req)

        expect(res.status).toBe(401)
    })
})

// ────────────────────────────────────────────────────────────────────────────
// GET /api/exercises/[id]
// ────────────────────────────────────────────────────────────────────────────

describe('GET /api/exercises/[id]', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('returns single exercise with all nested relations', async () => {
        vi.mocked(requireRole).mockResolvedValue(mockTrainerSession)
        vi.mocked(prisma.exercise.findUnique).mockResolvedValue(mockExerciseWithRelations as any)

        const req = makeDetailRequest(EX_ID_1)
        const res = await getExercise(req, withIdParam(EX_ID_1))
        const body = await res.json()

        expect(res.status).toBe(200)
        const ex = body.data.exercise
        expect(ex.id).toBe(EX_ID_1)
        expect(ex.name).toBe('Squat')
        expect(ex.type).toBe('fundamental')
        // movementPattern relation
        expect(ex.movementPattern.id).toBe(MP_ID)
        expect(ex.movementPattern.name).toBe('Hip Hinge')
        // muscleGroups relation
        expect(ex.exerciseMuscleGroups).toHaveLength(2)
        expect(ex.exerciseMuscleGroups[0].muscleGroup).toBeDefined()
        expect(ex.exerciseMuscleGroups[0].coefficient).toBeDefined()
        // creator relation
        expect(ex.creator.firstName).toBe('Marco')
        expect(ex.creator.lastName).toBe('Trainer')
        // notes array
        expect(ex.notes).toContain('Keep chest up')
    })

    it('returns 404 for non-existent exercise', async () => {
        vi.mocked(requireRole).mockResolvedValue(mockTrainerSession)
        vi.mocked(prisma.exercise.findUnique).mockResolvedValue(null)

        const req = makeDetailRequest(EX_ID_1)
        const res = await getExercise(req, withIdParam(EX_ID_1))

        expect(res.status).toBe(404)
    })

    it('trainee can fetch exercise detail (READ access allowed)', async () => {
        vi.mocked(requireRole).mockResolvedValue(mockTraineeSession)
        vi.mocked(prisma.exercise.findUnique).mockResolvedValue(mockExerciseWithRelations as any)

        const req = makeDetailRequest(EX_ID_1)
        const res = await getExercise(req, withIdParam(EX_ID_1))

        expect(res.status).toBe(200)
    })
})

// ────────────────────────────────────────────────────────────────────────────
// POST /api/exercises
// ────────────────────────────────────────────────────────────────────────────

describe('POST /api/exercises', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    const validPayload = {
        name: 'Romanian Deadlift',
        description: 'Hip hinge exercise with barbell',
        youtubeUrl: 'https://www.youtube.com/watch?v=abc123456789',
        type: 'fundamental',
        movementPatternId: MP_ID,
        muscleGroups: [
            { muscleGroupId: MG_ID_1, coefficient: 0.5 },
            { muscleGroupId: MG_ID_2, coefficient: 0.5 },
        ],
        notes: ['Keep back straight'],
    }

    it('trainer creates exercise with movement pattern and muscle group relations', async () => {
        vi.mocked(requireRole).mockResolvedValue(mockTrainerSession)
        vi.mocked(prisma.exercise.findFirst).mockResolvedValue(null) // no duplicate
        vi.mocked(prisma.movementPattern.findUnique).mockResolvedValue(mockMovementPattern as any)
        vi.mocked(prisma.muscleGroup.findMany).mockResolvedValue(mockMuscleGroups as any)
        vi.mocked(prisma.exercise.create).mockResolvedValue({
            ...mockExerciseWithRelations,
            id: 'new-ex-uuid',
            name: 'Romanian Deadlift',
        } as any)

        const req = makeListRequest('http://localhost:3000/api/exercises', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(validPayload),
        })
        const res = await createExercise(req)
        const body = await res.json()

        expect(res.status).toBe(201)
        expect(body.data.exercise.name).toBe('Romanian Deadlift')
        // Verify prisma.create was called with nested muscleGroups
        expect(prisma.exercise.create).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({
                    createdBy: 'trainer-uuid-1',
                    exerciseMuscleGroups: {
                        create: [
                            { muscleGroupId: MG_ID_1, coefficient: 0.5 },
                            { muscleGroupId: MG_ID_2, coefficient: 0.5 },
                        ],
                    },
                }),
            })
        )
    })

    it('returns 409 when exercise name already exists', async () => {
        vi.mocked(requireRole).mockResolvedValue(mockTrainerSession)
        vi.mocked(prisma.exercise.findFirst).mockResolvedValue(mockExerciseWithRelations as any)

        const req = makeListRequest('http://localhost:3000/api/exercises', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...validPayload, name: 'Squat' }),
        })
        const res = await createExercise(req)

        expect(res.status).toBe(409)
    })

    it('returns 404 when movementPattern does not exist', async () => {
        vi.mocked(requireRole).mockResolvedValue(mockTrainerSession)
        vi.mocked(prisma.exercise.findFirst).mockResolvedValue(null)
        vi.mocked(prisma.movementPattern.findUnique).mockResolvedValue(null)

        const req = makeListRequest('http://localhost:3000/api/exercises', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(validPayload),
        })
        const res = await createExercise(req)

        expect(res.status).toBe(404)
    })

    it('returns 404 when one or more muscleGroups do not exist', async () => {
        vi.mocked(requireRole).mockResolvedValue(mockTrainerSession)
        vi.mocked(prisma.exercise.findFirst).mockResolvedValue(null)
        vi.mocked(prisma.movementPattern.findUnique).mockResolvedValue(mockMovementPattern as any)
        // Return only 1 muscle group instead of 2
        vi.mocked(prisma.muscleGroup.findMany).mockResolvedValue([mockMuscleGroups[0]] as any)

        const req = makeListRequest('http://localhost:3000/api/exercises', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(validPayload),
        })
        const res = await createExercise(req)

        expect(res.status).toBe(404)
    })

    it('returns 400 when total coefficient exceeds 3.0', async () => {
        vi.mocked(requireRole).mockResolvedValue(mockTrainerSession)
        vi.mocked(prisma.exercise.findFirst).mockResolvedValue(null)
        vi.mocked(prisma.movementPattern.findUnique).mockResolvedValue(mockMovementPattern as any)
        // Return 3 muscle groups to allow building a payload whose total > 3.0
        const thirdMG = { id: '22222222-2222-2222-2222-222222222223', name: 'Bicipiti', createdBy: 'trainer-uuid-1', isActive: true, createdAt: new Date() }
        vi.mocked(prisma.muscleGroup.findMany).mockResolvedValue([...mockMuscleGroups, thirdMG] as any)

        // 1.0 + 1.0 + 1.1 = 3.1 > 3.0  — schema allows each ≤ 1.0, so use a split across more entries
        // Since per-item max is 1.0, to get total > 3.0 we need at least 4 entries
        // (4 × 0.8 = 3.2). Use 4 muscle groups.
        const fourthMG = { id: '22222222-2222-2222-2222-222222222224', name: 'Tricipiti', createdBy: 'trainer-uuid-1', isActive: true, createdAt: new Date() }
        vi.mocked(prisma.muscleGroup.findMany).mockResolvedValue([...mockMuscleGroups, thirdMG, fourthMG] as any)

        const overPayload = {
            ...validPayload,
            muscleGroups: [
                { muscleGroupId: MG_ID_1, coefficient: 1.0 },
                { muscleGroupId: MG_ID_2, coefficient: 1.0 },
                { muscleGroupId: '22222222-2222-2222-2222-222222222223', coefficient: 1.0 },
                { muscleGroupId: '22222222-2222-2222-2222-222222222224', coefficient: 0.5 },
            ],
        }
        // Total = 3.5 > 3.0 — route should return 400
        const req = makeListRequest('http://localhost:3000/api/exercises', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(overPayload),
        })
        const res = await createExercise(req)

        expect(res.status).toBe(400)
    })

    it('returns 400 for invalid YouTube URL', async () => {
        vi.mocked(requireRole).mockResolvedValue(mockTrainerSession)

        const req = makeListRequest('http://localhost:3000/api/exercises', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                ...validPayload,
                youtubeUrl: 'https://www.vimeo.com/12345',
            }),
        })
        const res = await createExercise(req)

        expect(res.status).toBe(400)
    })

    it('returns 400 when name is too short (< 3 chars)', async () => {
        vi.mocked(requireRole).mockResolvedValue(mockTrainerSession)

        const req = makeListRequest('http://localhost:3000/api/exercises', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...validPayload, name: 'AB' }),
        })
        const res = await createExercise(req)

        expect(res.status).toBe(400)
    })

    it('returns 400 when muscleGroups array is empty', async () => {
        vi.mocked(requireRole).mockResolvedValue(mockTrainerSession)

        const req = makeListRequest('http://localhost:3000/api/exercises', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...validPayload, muscleGroups: [] }),
        })
        const res = await createExercise(req)

        expect(res.status).toBe(400)
    })

    it('trainee cannot create exercises (403)', async () => {
        vi.mocked(requireRole).mockRejectedValue(
            Response.json({ error: { code: 'FORBIDDEN' } }, { status: 403 })
        )

        const req = makeListRequest('http://localhost:3000/api/exercises', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(validPayload),
        })
        const res = await createExercise(req)

        expect(res.status).toBe(403)
    })
})

// ────────────────────────────────────────────────────────────────────────────
// PUT /api/exercises/[id]
// ────────────────────────────────────────────────────────────────────────────

describe('PUT /api/exercises/[id]', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    const updatePayload = {
        name: 'Squat Updated',
        description: 'Updated description',
        youtubeUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        type: 'fundamental',
        movementPatternId: MP_ID,
        muscleGroups: [
            { muscleGroupId: MG_ID_1, coefficient: 0.7 },
            { muscleGroupId: MG_ID_2, coefficient: 0.3 },
        ],
        notes: ['Keep chest up', 'Updated note'],
    }

    it('trainer can update their own exercise (replaces muscleGroups)', async () => {
        vi.mocked(requireRole).mockResolvedValue(mockTrainerSession)
        vi.mocked(prisma.exercise.findUnique).mockResolvedValue(mockExerciseWithRelations as any)
        vi.mocked(prisma.exercise.findFirst).mockResolvedValue(null) // no name conflict
        vi.mocked(prisma.movementPattern.findUnique).mockResolvedValue(mockMovementPattern as any)
        vi.mocked(prisma.muscleGroup.findMany).mockResolvedValue(mockMuscleGroups as any)
        vi.mocked(prisma.exercise.update).mockResolvedValue({
            ...mockExerciseWithRelations,
            name: 'Squat Updated',
            exerciseMuscleGroups: [
                {
                    id: '44444444-4444-4444-4444-444444444441',
                    exerciseId: EX_ID_1,
                    muscleGroupId: MG_ID_1,
                    coefficient: 0.7,
                    muscleGroup: { id: MG_ID_1, name: 'Quadricipiti' },
                },
                {
                    id: '44444444-4444-4444-4444-444444444442',
                    exerciseId: EX_ID_1,
                    muscleGroupId: MG_ID_2,
                    coefficient: 0.3,
                    muscleGroup: { id: MG_ID_2, name: 'Glutei' },
                },
            ],
        } as any)

        const req = makeDetailRequest(EX_ID_1, `http://localhost:3000/api/exercises/${EX_ID_1}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updatePayload),
        })
        const res = await updateExercise(req, withIdParam(EX_ID_1))
        const body = await res.json()

        expect(res.status).toBe(200)
        expect(body.data.exercise.name).toBe('Squat Updated')
        // Verify deleteMany + create pattern (all muscleGroups replaced atomically)
        expect(prisma.exercise.update).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({
                    exerciseMuscleGroups: expect.objectContaining({
                        deleteMany: {},
                        create: expect.arrayContaining([
                            { muscleGroupId: MG_ID_1, coefficient: 0.7 },
                        ]),
                    }),
                }),
            })
        )
    })

    it('trainer cannot update exercise created by another trainer (403)', async () => {
        const otherTrainerExercise = {
            ...mockExerciseWithRelations,
            createdBy: 'other-trainer-uuid',
        }
        vi.mocked(requireRole).mockResolvedValue(mockTrainerSession)
        vi.mocked(prisma.exercise.findUnique).mockResolvedValue(otherTrainerExercise as any)

        const req = makeDetailRequest(EX_ID_1, `http://localhost:3000/api/exercises/${EX_ID_1}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updatePayload),
        })
        const res = await updateExercise(req, withIdParam(EX_ID_1))

        expect(res.status).toBe(403)
    })

    it('admin can update any exercise regardless of creator', async () => {
        const otherTrainerExercise = {
            ...mockExerciseWithRelations,
            createdBy: 'other-trainer-uuid',
        }
        vi.mocked(requireRole).mockResolvedValue(mockAdminSession)
        vi.mocked(prisma.exercise.findUnique).mockResolvedValue(otherTrainerExercise as any)
        vi.mocked(prisma.exercise.findFirst).mockResolvedValue(null)
        vi.mocked(prisma.movementPattern.findUnique).mockResolvedValue(mockMovementPattern as any)
        vi.mocked(prisma.muscleGroup.findMany).mockResolvedValue(mockMuscleGroups as any)
        vi.mocked(prisma.exercise.update).mockResolvedValue({
            ...mockExerciseWithRelations,
            name: 'Squat Updated',
        } as any)

        const req = makeDetailRequest(EX_ID_1, `http://localhost:3000/api/exercises/${EX_ID_1}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updatePayload),
        })
        const res = await updateExercise(req, withIdParam(EX_ID_1))

        expect(res.status).toBe(200)
    })

    it('returns 409 when updated name conflicts with an existing exercise', async () => {
        vi.mocked(requireRole).mockResolvedValue(mockTrainerSession)
        vi.mocked(prisma.exercise.findUnique).mockResolvedValue(mockExerciseWithRelations as any)
        // Simulate name conflict: another exercise already has the new name
        vi.mocked(prisma.exercise.findFirst).mockResolvedValue(mockAccessoryExercise as any)
        vi.mocked(prisma.movementPattern.findUnique).mockResolvedValue(mockMovementPattern as any)

        const req = makeDetailRequest(EX_ID_1, `http://localhost:3000/api/exercises/${EX_ID_1}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...updatePayload, name: 'Leg Press' }),
        })
        const res = await updateExercise(req, withIdParam(EX_ID_1))

        expect(res.status).toBe(409)
    })

    it('returns 404 when exercise to update does not exist', async () => {
        vi.mocked(requireRole).mockResolvedValue(mockTrainerSession)
        vi.mocked(prisma.exercise.findUnique).mockResolvedValue(null)

        const req = makeDetailRequest(EX_ID_1, `http://localhost:3000/api/exercises/${EX_ID_1}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updatePayload),
        })
        const res = await updateExercise(req, withIdParam(EX_ID_1))

        expect(res.status).toBe(404)
    })
})

// ────────────────────────────────────────────────────────────────────────────
// DELETE /api/exercises/[id]
// ────────────────────────────────────────────────────────────────────────────

describe('DELETE /api/exercises/[id]', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('trainer can delete their own exercise when not in active program', async () => {
        vi.mocked(requireRole).mockResolvedValue(mockTrainerSession)
        vi.mocked(prisma.exercise.findUnique).mockResolvedValue(mockExerciseWithRelations as any)
        vi.mocked(prisma.workoutExercise.findMany).mockResolvedValue([]) // not used anywhere
        vi.mocked(prisma.exercise.delete).mockResolvedValue(mockExerciseWithRelations as any)

        const req = makeDetailRequest(EX_ID_1, `http://localhost:3000/api/exercises/${EX_ID_1}`, {
            method: 'DELETE',
        })
        const res = await deleteExercise(req, withIdParam(EX_ID_1))

        expect(res.status).toBe(200)
        expect(prisma.exercise.delete).toHaveBeenCalledWith({ where: { id: EX_ID_1 } })
    })

    it('returns 409 when exercise is used in an active program', async () => {
        vi.mocked(requireRole).mockResolvedValue(mockTrainerSession)
        vi.mocked(prisma.exercise.findUnique).mockResolvedValue(mockExerciseWithRelations as any)
        // Simulate exercise used in an active program
        vi.mocked(prisma.workoutExercise.findMany).mockResolvedValue([
            {
                id: '55555555-5555-5555-5555-555555555551',
                exerciseId: EX_ID_1,
                workout: {
                    week: {
                        program: {
                            id: '66666666-6666-6666-6666-666666666661',
                            title: 'Powerlifting Block 1',
                            status: 'active',
                        },
                    },
                },
            },
        ] as any)

        const req = makeDetailRequest(EX_ID_1, `http://localhost:3000/api/exercises/${EX_ID_1}`, {
            method: 'DELETE',
        })
        const res = await deleteExercise(req, withIdParam(EX_ID_1))

        expect(res.status).toBe(409)
    })

    it('allows deleting exercise used only in completed/draft programs', async () => {
        vi.mocked(requireRole).mockResolvedValue(mockTrainerSession)
        vi.mocked(prisma.exercise.findUnique).mockResolvedValue(mockExerciseWithRelations as any)
        // Exercise used in a completed program — deletion should be allowed
        vi.mocked(prisma.workoutExercise.findMany).mockResolvedValue([
            {
                id: '55555555-5555-5555-5555-555555555552',
                exerciseId: EX_ID_1,
                workout: {
                    week: {
                        program: {
                            id: '66666666-6666-6666-6666-666666666662',
                            title: 'Old Program',
                            status: 'completed',
                        },
                    },
                },
            },
        ] as any)
        vi.mocked(prisma.exercise.delete).mockResolvedValue(mockExerciseWithRelations as any)

        const req = makeDetailRequest(EX_ID_1, `http://localhost:3000/api/exercises/${EX_ID_1}`, {
            method: 'DELETE',
        })
        const res = await deleteExercise(req, withIdParam(EX_ID_1))

        expect(res.status).toBe(200)
    })

    it('trainer cannot delete exercise created by another trainer (403)', async () => {
        const otherTrainerExercise = {
            ...mockExerciseWithRelations,
            createdBy: 'other-trainer-uuid',
        }
        vi.mocked(requireRole).mockResolvedValue(mockTrainerSession)
        vi.mocked(prisma.exercise.findUnique).mockResolvedValue(otherTrainerExercise as any)

        const req = makeDetailRequest(EX_ID_1, `http://localhost:3000/api/exercises/${EX_ID_1}`, {
            method: 'DELETE',
        })
        const res = await deleteExercise(req, withIdParam(EX_ID_1))

        expect(res.status).toBe(403)
    })

    it('returns 404 when exercise to delete does not exist', async () => {
        vi.mocked(requireRole).mockResolvedValue(mockTrainerSession)
        vi.mocked(prisma.exercise.findUnique).mockResolvedValue(null)

        const req = makeDetailRequest(EX_ID_1, `http://localhost:3000/api/exercises/${EX_ID_1}`, {
            method: 'DELETE',
        })
        const res = await deleteExercise(req, withIdParam(EX_ID_1))

        expect(res.status).toBe(404)
    })

    it('admin can delete exercise created by any trainer', async () => {
        const otherTrainerExercise = {
            ...mockExerciseWithRelations,
            createdBy: 'other-trainer-uuid',
        }
        vi.mocked(requireRole).mockResolvedValue(mockAdminSession)
        vi.mocked(prisma.exercise.findUnique).mockResolvedValue(otherTrainerExercise as any)
        vi.mocked(prisma.workoutExercise.findMany).mockResolvedValue([])
        vi.mocked(prisma.exercise.delete).mockResolvedValue(otherTrainerExercise as any)

        const req = makeDetailRequest(EX_ID_1, `http://localhost:3000/api/exercises/${EX_ID_1}`, {
            method: 'DELETE',
        })
        const res = await deleteExercise(req, withIdParam(EX_ID_1))

        expect(res.status).toBe(200)
    })
})
