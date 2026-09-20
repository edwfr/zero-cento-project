import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { Prisma } from '@prisma/client'

const withIdParam = (id: string) => ({ params: Promise.resolve({ id }) })

// ────────────────────────────────────────────────────────────────────────────
// Mocks
// ────────────────────────────────────────────────────────────────────────────

vi.mock('@/lib/auth', async () => (await import('../helpers/auth-module-mock')).authModuleMock())

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
import { prismaMock } from '../helpers/prisma-mock'
import { asTrainer, asAdmin, asTrainee, asUnauthenticated, asForbidden } from '../helpers/auth-mock'

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
    return new NextRequest(url, safeOptions as ConstructorParameters<typeof NextRequest>[1])
}

function makeDetailRequest(
    id: string,
    url?: string,
    options?: RequestInit
) {
    const { signal, ...safeOptions } = options || {}
    return new NextRequest(url ?? `http://localhost:3000/api/exercises/${id}`, safeOptions as ConstructorParameters<typeof NextRequest>[1])
}

/** Exercise as the DELETE handler selects it: id + reference counts. */
function makeCountedExercise(
    counts: Partial<{ workoutExercises: number; workoutSkeletons: number; personalRecords: number }> = {}
) {
    return {
        id: EX_ID_1,
        _count: {
            workoutExercises: 0,
            workoutSkeletons: 0,
            personalRecords: 0,
            ...counts,
        },
    }
}

// ────────────────────────────────────────────────────────────────────────────
// GET /api/exercises
// ────────────────────────────────────────────────────────────────────────────

describe('GET /api/exercises', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('returns exercise list with nested movementPattern and muscleGroups', async () => {
        asTrainer()
        prismaMock.exercise.findMany.mockResolvedValue([mockExerciseWithRelations] as never)

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
        asTrainer()
        prismaMock.exercise.findMany.mockResolvedValue(manyExercises as never)

        const req = makeListRequest('http://localhost:3000/api/exercises?limit=20')
        const res = await listExercises(req)
        const body = await res.json()

        expect(res.status).toBe(200)
        expect(body.data.pagination.hasMore).toBe(true)
        expect(body.data.pagination.nextCursor).toBe('ex-uuid-20')
        expect(body.data.items).toHaveLength(20)
    })

    it('returns hasMore=false and nextCursor=null when results fit in one page', async () => {
        asTrainer()
        prismaMock.exercise.findMany.mockResolvedValue([mockExerciseWithRelations] as never)

        const req = makeListRequest()
        const res = await listExercises(req)
        const body = await res.json()

        expect(res.status).toBe(200)
        expect(body.data.pagination.hasMore).toBe(false)
        expect(body.data.pagination.nextCursor).toBeNull()
    })

    it('filters by type=fundamental and passes where clause to prisma', async () => {
        asTrainer()
        prismaMock.exercise.findMany.mockResolvedValue([mockExerciseWithRelations] as never)

        const req = makeListRequest('http://localhost:3000/api/exercises?type=fundamental')
        await listExercises(req)

        expect(prismaMock.exercise.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({ type: 'fundamental' }),
            })
        )
    })

    it('filters by type=postural and passes where clause to prisma', async () => {
        asTrainer()
        prismaMock.exercise.findMany.mockResolvedValue([] as never)

        const req = makeListRequest('http://localhost:3000/api/exercises?type=postural')
        const res = await listExercises(req)

        expect(res.status).toBe(200)
        expect(prismaMock.exercise.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({ type: 'postural' }),
            })
        )
    })

    it('filters by movementPatternId and passes where clause to prisma', async () => {
        asTrainer()
        prismaMock.exercise.findMany.mockResolvedValue([mockExerciseWithRelations] as never)

        const req = makeListRequest(
            `http://localhost:3000/api/exercises?movementPatternId=${MP_ID}`
        )
        await listExercises(req)

        expect(prismaMock.exercise.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({ movementPatternId: MP_ID }),
            })
        )
    })

    it('filters by muscleGroupId using nested some query', async () => {
        asTrainer()
        prismaMock.exercise.findMany.mockResolvedValue([mockExerciseWithRelations] as never)

        const req = makeListRequest(
            `http://localhost:3000/api/exercises?muscleGroupId=${MG_ID_1}`
        )
        await listExercises(req)

        expect(prismaMock.exercise.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({
                    exerciseMuscleGroups: { some: { muscleGroupId: MG_ID_1 } },
                }),
            })
        )
    })

    it('performs case-insensitive search across name and description', async () => {
        asTrainer()
        prismaMock.exercise.findMany.mockResolvedValue([mockExerciseWithRelations] as never)

        const req = makeListRequest('http://localhost:3000/api/exercises?search=squat')
        await listExercises(req)

        expect(prismaMock.exercise.findMany).toHaveBeenCalledWith(
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
        asTrainer()

        const req = makeListRequest('http://localhost:3000/api/exercises?search=x')
        const res = await listExercises(req)

        expect(res.status).toBe(400)
    })

    it('returns 400 when search param is too long (> 100 chars)', async () => {
        asTrainer()

        const longSearch = 'a'.repeat(101)
        const req = makeListRequest(`http://localhost:3000/api/exercises?search=${longSearch}`)
        const res = await listExercises(req)

        expect(res.status).toBe(400)
    })

    it('trainee can list exercises (READ access allowed)', async () => {
        asTrainee()
        prismaMock.exercise.findMany.mockResolvedValue([mockExerciseWithRelations] as never)

        const req = makeListRequest()
        const res = await listExercises(req)

        expect(res.status).toBe(200)
    })

    it('returns 401 when unauthenticated', async () => {
        asUnauthenticated()

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
        asTrainer()
        prismaMock.exercise.findUnique.mockResolvedValue(mockExerciseWithRelations as never)

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

    it('includes the updater in the exercise detail response', async () => {
        asTrainer()
        prismaMock.exercise.findUnique.mockResolvedValue({
            ...mockExerciseWithRelations,
            updatedBy: 'trainer-uuid-2',
            updatedAt: new Date('2026-09-16'),
            updater: { id: 'trainer-uuid-2', firstName: 'Luca', lastName: 'Coach' },
        } as never)

        const req = makeDetailRequest(EX_ID_1)
        const res = await getExercise(req, withIdParam(EX_ID_1))
        const json = await res.json()

        expect(res.status).toBe(200)
        expect(json.data.exercise.updater).toEqual({
            id: 'trainer-uuid-2',
            firstName: 'Luca',
            lastName: 'Coach',
        })
        expect(prismaMock.exercise.findUnique).toHaveBeenCalledWith(
            expect.objectContaining({
                include: expect.objectContaining({
                    updater: { select: { id: true, firstName: true, lastName: true } },
                }),
            })
        )
    })

    it('returns 404 for non-existent exercise', async () => {
        asTrainer()
        prismaMock.exercise.findUnique.mockResolvedValue(null)

        const req = makeDetailRequest(EX_ID_1)
        const res = await getExercise(req, withIdParam(EX_ID_1))

        expect(res.status).toBe(404)
    })

    it('trainee can fetch exercise detail (READ access allowed)', async () => {
        asTrainee()
        prismaMock.exercise.findUnique.mockResolvedValue(mockExerciseWithRelations as never)

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
        asTrainer()
        prismaMock.exercise.findFirst.mockResolvedValue(null) // no duplicate
        prismaMock.movementPattern.findUnique.mockResolvedValue(mockMovementPattern as never)
        prismaMock.muscleGroup.findMany.mockResolvedValue(mockMuscleGroups as never)
        prismaMock.exercise.create.mockResolvedValue({
            ...mockExerciseWithRelations,
            id: 'new-ex-uuid',
            name: 'Romanian Deadlift',
        } as never)

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
        expect(prismaMock.exercise.create).toHaveBeenCalledWith(
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

    it('trainer creates a postural exercise', async () => {
        asTrainer()
        prismaMock.exercise.findFirst.mockResolvedValue(null)
        prismaMock.movementPattern.findUnique.mockResolvedValue(mockMovementPattern as never)
        prismaMock.muscleGroup.findMany.mockResolvedValue(mockMuscleGroups as never)
        prismaMock.exercise.create.mockResolvedValue({
            ...mockExerciseWithRelations,
            id: 'new-postural-uuid',
            name: 'Dead Bug',
            type: 'postural',
        } as never)

        const req = makeListRequest('http://localhost:3000/api/exercises', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...validPayload, name: 'Dead Bug', type: 'postural' }),
        })
        const res = await createExercise(req)
        const body = await res.json()

        expect(res.status).toBe(201)
        expect(body.data.exercise.type).toBe('postural')
        expect(prismaMock.exercise.create).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({ type: 'postural' }),
            })
        )
    })

    it('returns 409 when exercise name already exists', async () => {
        asTrainer()
        prismaMock.exercise.findFirst.mockResolvedValue(mockExerciseWithRelations as never)

        const req = makeListRequest('http://localhost:3000/api/exercises', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...validPayload, name: 'Squat' }),
        })
        const res = await createExercise(req)

        expect(res.status).toBe(409)
    })

    it('returns 404 when movementPattern does not exist', async () => {
        asTrainer()
        prismaMock.exercise.findFirst.mockResolvedValue(null)
        prismaMock.movementPattern.findUnique.mockResolvedValue(null)

        const req = makeListRequest('http://localhost:3000/api/exercises', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(validPayload),
        })
        const res = await createExercise(req)

        expect(res.status).toBe(404)
    })

    it('returns 404 when one or more muscleGroups do not exist', async () => {
        asTrainer()
        prismaMock.exercise.findFirst.mockResolvedValue(null)
        prismaMock.movementPattern.findUnique.mockResolvedValue(mockMovementPattern as never)
        // Return only 1 muscle group instead of 2
        prismaMock.muscleGroup.findMany.mockResolvedValue([mockMuscleGroups[0]] as never)

        const req = makeListRequest('http://localhost:3000/api/exercises', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(validPayload),
        })
        const res = await createExercise(req)

        expect(res.status).toBe(404)
    })

    it('creates an exercise with n muscle groups and no cap on the coefficient total', async () => {
        asTrainer()
        prismaMock.exercise.findFirst.mockResolvedValue(null)
        prismaMock.movementPattern.findUnique.mockResolvedValue(mockMovementPattern as never)

        const extraMuscleGroups = Array.from({ length: 6 }, (_, index) => ({
            id: `22222222-2222-2222-2222-22222222223${index}`,
            name: `Gruppo ${index}`,
            createdBy: 'trainer-uuid-1',
            isActive: true,
            createdAt: new Date(),
        }))
        prismaMock.muscleGroup.findMany.mockResolvedValue([
            ...mockMuscleGroups,
            ...extraMuscleGroups,
        ] as never)

        // 8 muscle groups, total coefficient 6.4 — both the old max of 5 entries
        // and the old total cap of 3.0 are gone.
        const manyMuscleGroups = [
            { muscleGroupId: MG_ID_1, coefficient: 0.8 },
            { muscleGroupId: MG_ID_2, coefficient: 0.8 },
            ...extraMuscleGroups.map((mg) => ({ muscleGroupId: mg.id, coefficient: 0.8 })),
        ]

        prismaMock.exercise.create.mockResolvedValue({
            ...mockExerciseWithRelations,
            id: 'many-groups-uuid',
            name: 'Romanian Deadlift',
        } as never)

        const req = makeListRequest('http://localhost:3000/api/exercises', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...validPayload, muscleGroups: manyMuscleGroups }),
        })
        const res = await createExercise(req)

        expect(res.status).toBe(201)
        expect(prismaMock.exercise.create).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({
                    exerciseMuscleGroups: { create: manyMuscleGroups },
                }),
            })
        )
    })

    it('returns 400 for invalid YouTube URL', async () => {
        asTrainer()

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
        asTrainer()

        const req = makeListRequest('http://localhost:3000/api/exercises', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...validPayload, name: 'AB' }),
        })
        const res = await createExercise(req)

        expect(res.status).toBe(400)
    })

    it('creates an exercise with 0 muscle groups', async () => {
        asTrainer()
        prismaMock.exercise.findFirst.mockResolvedValue(null)
        prismaMock.movementPattern.findUnique.mockResolvedValue(mockMovementPattern as never)
        prismaMock.exercise.create.mockResolvedValue({
            ...mockExerciseWithRelations,
            id: 'no-groups-uuid',
            name: 'Romanian Deadlift',
            exerciseMuscleGroups: [],
        } as never)

        const req = makeListRequest('http://localhost:3000/api/exercises', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...validPayload, muscleGroups: [] }),
        })
        const res = await createExercise(req)
        const body = await res.json()

        expect(res.status).toBe(201)
        expect(body.data.exercise.exerciseMuscleGroups).toEqual([])
        expect(prismaMock.muscleGroup.findMany).not.toHaveBeenCalled()
        expect(prismaMock.exercise.create).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({
                    exerciseMuscleGroups: { create: [] },
                }),
            })
        )
    })

    it('creates an exercise when the muscleGroups field is omitted', async () => {
        asTrainer()
        prismaMock.exercise.findFirst.mockResolvedValue(null)
        prismaMock.movementPattern.findUnique.mockResolvedValue(mockMovementPattern as never)
        prismaMock.exercise.create.mockResolvedValue({
            ...mockExerciseWithRelations,
            id: 'omitted-groups-uuid',
            exerciseMuscleGroups: [],
        } as never)

        const { muscleGroups: _omitted, ...payloadWithoutMuscleGroups } = validPayload
        const req = makeListRequest('http://localhost:3000/api/exercises', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payloadWithoutMuscleGroups),
        })
        const res = await createExercise(req)

        expect(res.status).toBe(201)
        expect(prismaMock.exercise.create).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({
                    exerciseMuscleGroups: { create: [] },
                }),
            })
        )
    })

    it('trainee cannot create exercises (403)', async () => {
        asForbidden()

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
        asTrainer()
        prismaMock.exercise.findUnique.mockResolvedValue(mockExerciseWithRelations as never)
        prismaMock.exercise.findFirst.mockResolvedValue(null) // no name conflict
        prismaMock.movementPattern.findUnique.mockResolvedValue(mockMovementPattern as never)
        prismaMock.muscleGroup.findMany.mockResolvedValue(mockMuscleGroups as never)
        prismaMock.exercise.update.mockResolvedValue({
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
        } as never)

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
        expect(prismaMock.exercise.update).toHaveBeenCalledWith(
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

    it('trainer can clear all muscle groups from an exercise', async () => {
        asTrainer()
        prismaMock.exercise.findUnique.mockResolvedValue(mockExerciseWithRelations as never)
        prismaMock.exercise.findFirst.mockResolvedValue(null)
        prismaMock.movementPattern.findUnique.mockResolvedValue(mockMovementPattern as never)
        prismaMock.exercise.update.mockResolvedValue({
            ...mockExerciseWithRelations,
            name: 'Squat Updated',
            exerciseMuscleGroups: [],
        } as never)

        const req = makeDetailRequest(EX_ID_1, `http://localhost:3000/api/exercises/${EX_ID_1}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...updatePayload, muscleGroups: [] }),
        })
        const res = await updateExercise(req, withIdParam(EX_ID_1))
        const body = await res.json()

        expect(res.status).toBe(200)
        expect(body.data.exercise.exerciseMuscleGroups).toEqual([])
        expect(prismaMock.muscleGroup.findMany).not.toHaveBeenCalled()
        expect(prismaMock.exercise.update).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({
                    exerciseMuscleGroups: { deleteMany: {}, create: [] },
                }),
            })
        )
    })

    it('trainer can assign n muscle groups with no cap on the coefficient total', async () => {
        asTrainer()
        prismaMock.exercise.findUnique.mockResolvedValue(mockExerciseWithRelations as never)
        prismaMock.exercise.findFirst.mockResolvedValue(null)
        prismaMock.movementPattern.findUnique.mockResolvedValue(mockMovementPattern as never)

        const extraMuscleGroups = Array.from({ length: 6 }, (_, index) => ({
            id: `22222222-2222-2222-2222-22222222224${index}`,
            name: `Gruppo ${index}`,
            createdBy: 'trainer-uuid-1',
            isActive: true,
            createdAt: new Date(),
        }))
        prismaMock.muscleGroup.findMany.mockResolvedValue([
            ...mockMuscleGroups,
            ...extraMuscleGroups,
        ] as never)

        // 8 muscle groups, total coefficient 8.0
        const manyMuscleGroups = [
            { muscleGroupId: MG_ID_1, coefficient: 1.0 },
            { muscleGroupId: MG_ID_2, coefficient: 1.0 },
            ...extraMuscleGroups.map((mg) => ({ muscleGroupId: mg.id, coefficient: 1.0 })),
        ]

        prismaMock.exercise.update.mockResolvedValue(mockExerciseWithRelations as never)

        const req = makeDetailRequest(EX_ID_1, `http://localhost:3000/api/exercises/${EX_ID_1}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...updatePayload, muscleGroups: manyMuscleGroups }),
        })
        const res = await updateExercise(req, withIdParam(EX_ID_1))

        expect(res.status).toBe(200)
        expect(prismaMock.exercise.update).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({
                    exerciseMuscleGroups: { deleteMany: {}, create: manyMuscleGroups },
                }),
            })
        )
    })

    it('trainer can update exercise created by another trainer (shared library)', async () => {
        const otherTrainerExercise = {
            ...mockExerciseWithRelations,
            createdBy: 'other-trainer-uuid',
        }
        asTrainer()
        prismaMock.exercise.findUnique.mockResolvedValue(otherTrainerExercise as never)
        prismaMock.exercise.findFirst.mockResolvedValue(null)
        prismaMock.movementPattern.findUnique.mockResolvedValue(mockMovementPattern as never)
        prismaMock.muscleGroup.findMany.mockResolvedValue(mockMuscleGroups as never)
        prismaMock.exercise.update.mockResolvedValue(otherTrainerExercise as never)

        const req = makeDetailRequest(EX_ID_1, `http://localhost:3000/api/exercises/${EX_ID_1}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updatePayload),
        })
        const res = await updateExercise(req, withIdParam(EX_ID_1))

        expect(res.status).toBe(200)
    })

    it('records updatedBy and updatedAt when a trainer updates an exercise', async () => {
        asTrainer()
        prismaMock.exercise.findUnique.mockResolvedValue(mockExerciseWithRelations as never)
        prismaMock.exercise.findFirst.mockResolvedValue(null)
        prismaMock.movementPattern.findUnique.mockResolvedValue(mockMovementPattern as never)
        prismaMock.muscleGroup.findMany.mockResolvedValue(mockMuscleGroups as never)
        prismaMock.exercise.update.mockResolvedValue(mockExerciseWithRelations as never)

        const req = makeDetailRequest(EX_ID_1, `http://localhost:3000/api/exercises/${EX_ID_1}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updatePayload),
        })
        await updateExercise(req, withIdParam(EX_ID_1))

        expect(prismaMock.exercise.update).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({
                    updatedBy: 'trainer-uuid-1',
                    updatedAt: expect.any(Date),
                }),
            })
        )
    })

    it('admin can update any exercise regardless of creator', async () => {
        const otherTrainerExercise = {
            ...mockExerciseWithRelations,
            createdBy: 'other-trainer-uuid',
        }
        asAdmin()
        prismaMock.exercise.findUnique.mockResolvedValue(otherTrainerExercise as never)
        prismaMock.exercise.findFirst.mockResolvedValue(null)
        prismaMock.movementPattern.findUnique.mockResolvedValue(mockMovementPattern as never)
        prismaMock.muscleGroup.findMany.mockResolvedValue(mockMuscleGroups as never)
        prismaMock.exercise.update.mockResolvedValue({
            ...mockExerciseWithRelations,
            name: 'Squat Updated',
        } as never)

        const req = makeDetailRequest(EX_ID_1, `http://localhost:3000/api/exercises/${EX_ID_1}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updatePayload),
        })
        const res = await updateExercise(req, withIdParam(EX_ID_1))

        expect(res.status).toBe(200)
    })

    it('returns 409 when updated name conflicts with an existing exercise', async () => {
        asTrainer()
        prismaMock.exercise.findUnique.mockResolvedValue(mockExerciseWithRelations as never)
        // Simulate name conflict: another exercise already has the new name
        prismaMock.exercise.findFirst.mockResolvedValue(mockAccessoryExercise as never)
        prismaMock.movementPattern.findUnique.mockResolvedValue(mockMovementPattern as never)

        const req = makeDetailRequest(EX_ID_1, `http://localhost:3000/api/exercises/${EX_ID_1}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...updatePayload, name: 'Leg Press' }),
        })
        const res = await updateExercise(req, withIdParam(EX_ID_1))

        expect(res.status).toBe(409)
    })

    it('returns 404 when exercise to update does not exist', async () => {
        asTrainer()
        prismaMock.exercise.findUnique.mockResolvedValue(null)

        const req = makeDetailRequest(EX_ID_1, `http://localhost:3000/api/exercises/${EX_ID_1}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updatePayload),
        })
        const res = await updateExercise(req, withIdParam(EX_ID_1))

        expect(res.status).toBe(404)
    })

    it('trainee cannot update exercises (403)', async () => {
        asForbidden()

        const req = makeDetailRequest(EX_ID_1, `http://localhost:3000/api/exercises/${EX_ID_1}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updatePayload),
        })
        const res = await updateExercise(req, withIdParam(EX_ID_1))

        expect(res.status).toBe(403)
        expect(prismaMock.exercise.update).not.toHaveBeenCalled()
    })
})

// ────────────────────────────────────────────────────────────────────────────
// DELETE /api/exercises/[id]
// ────────────────────────────────────────────────────────────────────────────

describe('DELETE /api/exercises/[id]', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('trainer can delete an exercise with no references', async () => {
        asTrainer()
        prismaMock.exercise.findUnique.mockResolvedValue(makeCountedExercise() as never)
        prismaMock.exercise.delete.mockResolvedValue(mockExerciseWithRelations as never)

        const req = makeDetailRequest(EX_ID_1, `http://localhost:3000/api/exercises/${EX_ID_1}`, {
            method: 'DELETE',
        })
        const res = await deleteExercise(req, withIdParam(EX_ID_1))

        expect(res.status).toBe(200)
        expect(prismaMock.exercise.delete).toHaveBeenCalledWith({ where: { id: EX_ID_1 } })
    })

    it('trainer can delete an unreferenced exercise created by another trainer', async () => {
        asTrainer()
        prismaMock.exercise.findUnique.mockResolvedValue(makeCountedExercise() as never)
        prismaMock.exercise.delete.mockResolvedValue({
            ...mockExerciseWithRelations,
            createdBy: 'other-trainer-uuid',
        } as never)

        const req = makeDetailRequest(EX_ID_1, `http://localhost:3000/api/exercises/${EX_ID_1}`, {
            method: 'DELETE',
        })
        const res = await deleteExercise(req, withIdParam(EX_ID_1))

        expect(res.status).toBe(200)
    })

    it('returns 409 when the exercise is used in a program, whatever its status', async () => {
        asTrainer()
        prismaMock.exercise.findUnique.mockResolvedValue(
            makeCountedExercise({ workoutExercises: 3 }) as never
        )
        prismaMock.workoutExercise.findFirst.mockResolvedValue({
            workout: {
                week: {
                    program: {
                        id: '66666666-6666-6666-6666-666666666662',
                        title: 'Old Program',
                    },
                },
            },
        } as never)

        const req = makeDetailRequest(EX_ID_1, `http://localhost:3000/api/exercises/${EX_ID_1}`, {
            method: 'DELETE',
        })
        const res = await deleteExercise(req, withIdParam(EX_ID_1))
        const json = await res.json()

        expect(res.status).toBe(409)
        expect(json.error.key).toBe('exercise.cannotDeleteReferenced')
        expect(json.error.details.programName).toBe('Old Program')
        expect(json.error.details.workoutExercises).toBe(3)
        expect(prismaMock.exercise.delete).not.toHaveBeenCalled()
    })

    it('returns 409 when the exercise is only referenced by a program skeleton', async () => {
        asTrainer()
        prismaMock.exercise.findUnique.mockResolvedValue(
            makeCountedExercise({ workoutSkeletons: 1 }) as never
        )
        prismaMock.workoutExercise.findFirst.mockResolvedValue(null)

        const req = makeDetailRequest(EX_ID_1, `http://localhost:3000/api/exercises/${EX_ID_1}`, {
            method: 'DELETE',
        })
        const res = await deleteExercise(req, withIdParam(EX_ID_1))
        const json = await res.json()

        expect(res.status).toBe(409)
        expect(json.error.key).toBe('exercise.cannotDeleteReferenced')
        expect(json.error.details.workoutSkeletons).toBe(1)
        expect(prismaMock.exercise.delete).not.toHaveBeenCalled()
    })

    it('returns 409 when the exercise is only referenced by a personal record', async () => {
        asTrainer()
        prismaMock.exercise.findUnique.mockResolvedValue(
            makeCountedExercise({ personalRecords: 2 }) as never
        )
        prismaMock.workoutExercise.findFirst.mockResolvedValue(null)

        const req = makeDetailRequest(EX_ID_1, `http://localhost:3000/api/exercises/${EX_ID_1}`, {
            method: 'DELETE',
        })
        const res = await deleteExercise(req, withIdParam(EX_ID_1))
        const json = await res.json()

        expect(res.status).toBe(409)
        expect(json.error.key).toBe('exercise.cannotDeleteReferenced')
        expect(json.error.details.personalRecords).toBe(2)
        expect(prismaMock.exercise.delete).not.toHaveBeenCalled()
    })

    it('returns 409 (not 500) when the delete races with a new reference (P2003)', async () => {
        asTrainer()
        prismaMock.exercise.findUnique.mockResolvedValue(makeCountedExercise() as never)
        prismaMock.exercise.delete.mockRejectedValue(
            new Prisma.PrismaClientKnownRequestError('Foreign key constraint failed', {
                code: 'P2003',
                clientVersion: '5.0.0',
            }) as never)

        const req = makeDetailRequest(EX_ID_1, `http://localhost:3000/api/exercises/${EX_ID_1}`, {
            method: 'DELETE',
        })
        const res = await deleteExercise(req, withIdParam(EX_ID_1))
        const json = await res.json()

        expect(res.status).toBe(409)
        expect(json.error.key).toBe('exercise.cannotDeleteReferenced')
    })

    it('returns 404 when exercise to delete does not exist', async () => {
        asTrainer()
        prismaMock.exercise.findUnique.mockResolvedValue(null)

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
        asAdmin()
        prismaMock.exercise.findUnique.mockResolvedValue(makeCountedExercise() as never)
        prismaMock.exercise.delete.mockResolvedValue(otherTrainerExercise as never)

        const req = makeDetailRequest(EX_ID_1, `http://localhost:3000/api/exercises/${EX_ID_1}`, {
            method: 'DELETE',
        })
        const res = await deleteExercise(req, withIdParam(EX_ID_1))

        expect(res.status).toBe(200)
    })

    it('trainee cannot delete exercises (403)', async () => {
        asForbidden()

        const req = makeDetailRequest(EX_ID_1, `http://localhost:3000/api/exercises/${EX_ID_1}`, {
            method: 'DELETE',
        })
        const res = await deleteExercise(req, withIdParam(EX_ID_1))

        expect(res.status).toBe(403)
        expect(prismaMock.exercise.delete).not.toHaveBeenCalled()
    })
})

// ────────────────────────────────────────────────────────────────────────────
// Error paths of /api/exercises/[id]
// ────────────────────────────────────────────────────────────────────────────

describe('/api/exercises/[id] — error paths', () => {
    const validPayload = {
        name: 'Squat Updated',
        description: 'Updated description',
        youtubeUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        type: 'fundamental',
        movementPatternId: MP_ID,
        muscleGroups: [{ muscleGroupId: MG_ID_1, coefficient: 1 }],
        notes: [],
    }

    const putRequest = (body: unknown) =>
        makeDetailRequest(EX_ID_1, `http://localhost:3000/api/exercises/${EX_ID_1}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        })

    beforeEach(() => {
        vi.clearAllMocks()
        asTrainer()
    })

    it('returns 401 on the detail endpoint when not authenticated', async () => {
        asUnauthenticated()

        const res = await getExercise(makeDetailRequest(EX_ID_1), withIdParam(EX_ID_1))

        expect(res.status).toBe(401)
        expect(prismaMock.exercise.findUnique).not.toHaveBeenCalled()
    })

    it('returns 500 when the detail query fails', async () => {
        prismaMock.exercise.findUnique.mockRejectedValue(new Error('db down'))

        const res = await getExercise(makeDetailRequest(EX_ID_1), withIdParam(EX_ID_1))
        const json = await res.json()

        expect(res.status).toBe(500)
        expect(json.error.key).toBe('internal.default')
    })

    it('returns 400 when the update payload is invalid', async () => {
        const res = await updateExercise(putRequest({ ...validPayload, name: 'ab' }), withIdParam(EX_ID_1))
        const json = await res.json()

        expect(res.status).toBe(400)
        expect(json.error.key).toBe('validation.invalidInput')
        expect(prismaMock.exercise.update).not.toHaveBeenCalled()
    })

    it('returns 404 when the movement pattern of the update does not exist', async () => {
        prismaMock.exercise.findUnique.mockResolvedValue({ id: EX_ID_1, name: 'Squat Updated' } as never)
        prismaMock.movementPattern.findUnique.mockResolvedValue(null)

        const res = await updateExercise(putRequest(validPayload), withIdParam(EX_ID_1))
        const json = await res.json()

        expect(res.status).toBe(404)
        expect(json.error.key).toBe('movementPattern.notFound')
        expect(prismaMock.exercise.update).not.toHaveBeenCalled()
    })

    it('returns 404 when a muscle group of the update does not exist', async () => {
        prismaMock.exercise.findUnique.mockResolvedValue({ id: EX_ID_1, name: 'Squat Updated' } as never)
        prismaMock.movementPattern.findUnique.mockResolvedValue({ id: MP_ID } as never)
        prismaMock.muscleGroup.findMany.mockResolvedValue([] as never)

        const res = await updateExercise(putRequest(validPayload), withIdParam(EX_ID_1))
        const json = await res.json()

        expect(res.status).toBe(404)
        expect(json.error.key).toBe('muscleGroup.someNotFound')
        expect(prismaMock.exercise.update).not.toHaveBeenCalled()
    })

    it('returns 500 when the update fails', async () => {
        prismaMock.exercise.findUnique.mockResolvedValue({ id: EX_ID_1, name: 'Squat Updated' } as never)
        prismaMock.movementPattern.findUnique.mockResolvedValue({ id: MP_ID } as never)
        prismaMock.muscleGroup.findMany.mockResolvedValue([{ id: MG_ID_1 }] as never)
        prismaMock.exercise.update.mockRejectedValue(new Error('db down'))

        const res = await updateExercise(putRequest(validPayload), withIdParam(EX_ID_1))
        const json = await res.json()

        expect(res.status).toBe(500)
        expect(json.error.key).toBe('internal.default')
    })

    it('reports the conflict without a program name when no workout references it', async () => {
        prismaMock.exercise.findUnique.mockResolvedValue(makeCountedExercise({ personalRecords: 1 }) as never)
        prismaMock.workoutExercise.findFirst.mockResolvedValue(null)

        const res = await deleteExercise(
            makeDetailRequest(EX_ID_1, `http://localhost:3000/api/exercises/${EX_ID_1}`, { method: 'DELETE' }),
            withIdParam(EX_ID_1)
        )
        const json = await res.json()

        expect(res.status).toBe(409)
        expect(json.error.key).toBe('exercise.cannotDeleteReferenced')
        expect(json.error.details).toMatchObject({ personalRecords: 1 })
        expect(json.error.details.programId).toBeUndefined()
        expect(prismaMock.exercise.delete).not.toHaveBeenCalled()
    })

    it('returns 500 when the delete fails for any other reason', async () => {
        prismaMock.exercise.findUnique.mockResolvedValue(makeCountedExercise() as never)
        prismaMock.exercise.delete.mockRejectedValue(new Error('db down'))

        const res = await deleteExercise(
            makeDetailRequest(EX_ID_1, `http://localhost:3000/api/exercises/${EX_ID_1}`, { method: 'DELETE' }),
            withIdParam(EX_ID_1)
        )
        const json = await res.json()

        expect(res.status).toBe(500)
        expect(json.error.key).toBe('internal.default')
    })
})
