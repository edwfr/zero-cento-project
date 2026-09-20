import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/auth', async () => (await import('../helpers/auth-module-mock')).authModuleMock())

vi.mock('@/lib/logger', () => ({
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

import { GET as getReports } from '@/app/api/programs/[id]/reports/route'
import { prismaMock } from '../helpers/prisma-mock'
import { asTrainer, asAdmin, asTrainee, asUnauthenticated } from '../helpers/auth-mock'
import { mockTrainerSession, mockTraineeSession, makeTraineeSession } from '../helpers/sessions'
import { callArg } from '../helpers/call-args'

const PROGRAM_ID = '55555555-5555-5555-5555-555555555551'
const MG_ID = '22222222-2222-2222-2222-222222222221'
const MP_ID = '11111111-1111-1111-1111-111111111111'

const withIdParam = (id: string) => ({ params: Promise.resolve({ id }) })

const makeRequest = () =>
    new NextRequest(`http://localhost:3000/api/programs/${PROGRAM_ID}/reports`)

/** One exercise with the relations the report walks. */
const makeWorkoutExercise = (overrides: Record<string, unknown> = {}) => ({
    id: 'we-1',
    sets: 3,
    reps: '5',
    weight: 100,
    effectiveWeight: 100,
    isWarmup: false,
    exercise: {
        id: 'ex-1',
        name: 'Back Squat',
        type: 'fundamental',
        movementPattern: { id: MP_ID, name: 'Squat Pattern' },
        exerciseMuscleGroups: [{ coefficient: 1, muscleGroup: { id: MG_ID, name: 'Quadricipiti' } }],
    },
    exerciseFeedbacks: [{
        actualRpe: 8,
        setsPerformed: [
            { reps: 5, weight: 100, completed: true },
            { reps: 5, weight: 100, completed: true },
        ],
    }],
    ...overrides,
})

const makeProgram = (workoutExercises: unknown[] = [makeWorkoutExercise()]) => ({
    id: PROGRAM_ID,
    title: 'Blocco Forza',
    trainerId: mockTrainerSession.user.id,
    traineeId: mockTraineeSession.user.id,
    trainee: { id: mockTraineeSession.user.id, firstName: 'Mario', lastName: 'Atleta' },
    weeks: [{
        weekNumber: 1,
        workouts: [{ id: 'wk-1', dayIndex: 0, workoutExercises }],
    }],
})

describe('GET /api/programs/[id]/reports', () => {
    beforeEach(() => {
        asTrainer()
        prismaMock.trainingProgram.findUnique.mockResolvedValue(makeProgram() as never)
        prismaMock.personalRecord.findMany.mockResolvedValue([
            { exerciseId: 'ex-1', reps: 1, weight: 150, exercise: { id: 'ex-1', name: 'Back Squat' } },
        ] as never)
    })

    it('returns the four report sections for the owning trainer', async () => {
        const res = await getReports(makeRequest(), withIdParam(PROGRAM_ID))
        const body = callArg(await res.json())

        expect(res.status).toBe(200)
        expect(body.data).toMatchObject({ programId: PROGRAM_ID, programName: 'Blocco Forza' })
        expect(body.data).toHaveProperty('sbd')
        expect(body.data).toHaveProperty('muscleGroups')
        expect(body.data).toHaveProperty('movementPatterns')
        expect(body.data).toHaveProperty('rpeDistribution')
    })

    it('attributes squat work to the squat slot of the SBD report', async () => {
        const res = await getReports(makeRequest(), withIdParam(PROGRAM_ID))
        const body = await res.json()

        expect(body.data.sbd.squat.trainingSets).toBe(2)
        expect(body.data.sbd.squat.volume).toBe(1000)
    })

    it('ignores warmup sets in the SBD report', async () => {
        prismaMock.trainingProgram.findUnique.mockResolvedValue(
            makeProgram([makeWorkoutExercise({ isWarmup: true })]) as never
        )

        const res = await getReports(makeRequest(), withIdParam(PROGRAM_ID))
        const body = await res.json()

        expect(body.data.sbd.squat.trainingSets).toBe(0)
    })

    it('leaves the SBD report empty for an exercise that is not a competition lift', async () => {
        prismaMock.trainingProgram.findUnique.mockResolvedValue(
            makeProgram([makeWorkoutExercise({
                exercise: { ...makeWorkoutExercise().exercise, name: 'Leg Extension' },
            })]) as never
        )

        const res = await getReports(makeRequest(), withIdParam(PROGRAM_ID))
        const body = await res.json()

        expect(body.data.sbd.squat.trainingSets).toBe(0)
        expect(body.data.sbd.bench.trainingSets).toBe(0)
        expect(body.data.sbd.deadlift.trainingSets).toBe(0)
    })

    it('reports the muscle groups and movement patterns it met', async () => {
        const res = await getReports(makeRequest(), withIdParam(PROGRAM_ID))
        const body = await res.json()

        expect(body.data.muscleGroups).toContainEqual(
            expect.objectContaining({ muscleGroupId: MG_ID, muscleGroupName: 'Quadricipiti', percentage: 100 })
        )
        expect(body.data.movementPatterns).toContainEqual(
            expect.objectContaining({ movementPatternId: MP_ID, movementPatternName: 'Squat Pattern' })
        )
    })

    it('buckets the recorded RPE and reports its share', async () => {
        const res = await getReports(makeRequest(), withIdParam(PROGRAM_ID))
        const body = await res.json()

        const bucket = body.data.rpeDistribution.find((item: { range: string }) => item.range === '8.0-8.5')
        expect(bucket.count).toBe(2)
        expect(bucket.percentage).toBe(100)
    })

    it('reports zero percentages when nothing was performed', async () => {
        prismaMock.trainingProgram.findUnique.mockResolvedValue(
            makeProgram([makeWorkoutExercise({ exerciseFeedbacks: [] })]) as never
        )

        const res = await getReports(makeRequest(), withIdParam(PROGRAM_ID))
        const body = await res.json()

        expect(body.data.rpeDistribution.every((item: { percentage: number }) => item.percentage === 0)).toBe(true)
    })

    it('handles a program without weeks', async () => {
        prismaMock.trainingProgram.findUnique.mockResolvedValue({ ...makeProgram(), weeks: [] } as never)

        const res = await getReports(makeRequest(), withIdParam(PROGRAM_ID))

        expect(res.status).toBe(200)
    })

    it('returns 404 when the program does not exist', async () => {
        prismaMock.trainingProgram.findUnique.mockResolvedValue(null)

        const res = await getReports(makeRequest(), withIdParam(PROGRAM_ID))
        const body = await res.json()

        expect(res.status).toBe(404)
        expect(body.error.key).toBe('program.notFound')
    })

    it('returns 403 when the trainer does not own the program', async () => {
        prismaMock.trainingProgram.findUnique.mockResolvedValue({
            ...makeProgram(), trainerId: 'trainer-other',
        } as never)

        const res = await getReports(makeRequest(), withIdParam(PROGRAM_ID))
        const body = await res.json()

        expect(res.status).toBe(403)
        expect(body.error.key).toBe('program.viewDenied')
    })

    it('returns 403 when the trainee is not the one the program is assigned to', async () => {
        asTrainee(makeTraineeSession({ id: 'trainee-other' }))

        const res = await getReports(makeRequest(), withIdParam(PROGRAM_ID))
        const body = await res.json()

        expect(res.status).toBe(403)
        expect(body.error.key).toBe('program.viewAssignedDenied')
    })

    it('lets the assigned trainee read the report', async () => {
        asTrainee()

        const res = await getReports(makeRequest(), withIdParam(PROGRAM_ID))

        expect(res.status).toBe(200)
    })

    it('lets an admin read any report', async () => {
        asAdmin()
        prismaMock.trainingProgram.findUnique.mockResolvedValue({
            ...makeProgram(), trainerId: 'trainer-other',
        } as never)

        const res = await getReports(makeRequest(), withIdParam(PROGRAM_ID))

        expect(res.status).toBe(200)
    })

    it('returns 401 when the caller is not authenticated', async () => {
        asUnauthenticated()

        const res = await getReports(makeRequest(), withIdParam(PROGRAM_ID))

        expect(res.status).toBe(401)
        expect(prismaMock.trainingProgram.findUnique).not.toHaveBeenCalled()
    })

    it('returns 500 when the query fails', async () => {
        prismaMock.trainingProgram.findUnique.mockRejectedValue(new Error('db down'))

        const res = await getReports(makeRequest(), withIdParam(PROGRAM_ID))
        const body = await res.json()

        expect(res.status).toBe(500)
        expect(body.error.key).toBe('internal.default')
    })
})
