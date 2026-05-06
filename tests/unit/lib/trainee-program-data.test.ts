import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/prisma', () => ({
    prisma: {
        trainingProgram: { findUnique: vi.fn(), findFirst: vi.fn() },
        workout: { findMany: vi.fn() },
        exerciseFeedback: { aggregate: vi.fn(), findMany: vi.fn() },
        setPerformed: { findMany: vi.fn() },
        personalRecord: { findMany: vi.fn() },
        $queryRaw: vi.fn(),
    },
}))

vi.mock('@/lib/logger', () => ({
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

import { prisma } from '@/lib/prisma'
import {
    loadTraineeProgramView,
    loadActiveProgramId,
} from '@/lib/trainee-program-data'

const traineeId = 'trainee-1'

beforeEach(() => {
    vi.clearAllMocks()
    ;(prisma.workout.findMany as any).mockResolvedValue([])
    ;(prisma.$queryRaw as any).mockResolvedValue([])
    ;(prisma.exerciseFeedback.aggregate as any).mockResolvedValue({
        _avg: { actualRpe: null },
        _count: { _all: 0 },
    })
    ;(prisma.exerciseFeedback.findMany as any).mockResolvedValue([])
    ;(prisma.setPerformed.findMany as any).mockResolvedValue([])
    ;(prisma.personalRecord.findMany as any).mockResolvedValue([])
})

describe('loadTraineeProgramView', () => {
    it('returns null when program does not exist', async () => {
        let callCount = 0
        ;(prisma.trainingProgram.findUnique as any).mockImplementation(async () => {
            callCount++
            // Both calls (tree and progress) return null when program doesn't exist
            return null
        })
        const result = await loadTraineeProgramView({ programId: 'p1', traineeId })
        expect(result).toBeNull()
    })

    it('returns null when program belongs to another trainee', async () => {
        ;(prisma.trainingProgram.findUnique as any).mockResolvedValue({
            id: 'p1',
            traineeId: 'other-trainee',
            trainerId: 't1',
            title: 'X',
            startDate: new Date(),
            durationWeeks: 1,
            weeks: [],
            trainer: { firstName: 'A', lastName: 'B' },
            trainee: { firstName: 'C', lastName: 'D' },
        })
        const result = await loadTraineeProgramView({ programId: 'p1', traineeId })
        expect(result).toBeNull()
    })

    it('returns combined { program, progress } for the trainee', async () => {
        ;(prisma.trainingProgram.findUnique as any).mockResolvedValue({
            id: 'p1',
            traineeId,
            trainerId: 't1',
            status: 'active',
            title: 'My Program',
            startDate: new Date('2026-04-01'),
            durationWeeks: 1,
            weeks: [],
            trainer: { firstName: 'A', lastName: 'B' },
            trainee: { firstName: 'C', lastName: 'D' },
        })

        const result = await loadTraineeProgramView({ programId: 'p1', traineeId })
        expect(result).not.toBeNull()
        expect(result!.program.id).toBe('p1')
        expect(result!.progress.programId).toBe('p1')
        expect(result!.progress.totalWorkouts).toBe(0)
    })
})

describe('loadActiveProgramId', () => {
    it('returns the id when active program exists', async () => {
        ;(prisma.trainingProgram.findFirst as any).mockResolvedValue({ id: 'p1' })
        await expect(loadActiveProgramId(traineeId)).resolves.toBe('p1')
    })

    it('returns the preferred id when it is active for the trainee', async () => {
        ;(prisma.trainingProgram.findFirst as any)
            .mockResolvedValueOnce({ id: 'preferred-program' })

        await expect(loadActiveProgramId(traineeId, 'preferred-program')).resolves.toBe('preferred-program')

        expect(prisma.trainingProgram.findFirst).toHaveBeenCalledTimes(1)
        expect(prisma.trainingProgram.findFirst).toHaveBeenCalledWith({
            where: { id: 'preferred-program', traineeId, status: 'active' },
            select: { id: true },
        })
    })

    it('falls back to the default active lookup when preferred id is not active', async () => {
        ;(prisma.trainingProgram.findFirst as any)
            .mockResolvedValueOnce(null)
            .mockResolvedValueOnce({ id: 'fallback-program' })

        await expect(loadActiveProgramId(traineeId, 'stale-program')).resolves.toBe('fallback-program')

        expect(prisma.trainingProgram.findFirst).toHaveBeenNthCalledWith(1, {
            where: { id: 'stale-program', traineeId, status: 'active' },
            select: { id: true },
        })
        expect(prisma.trainingProgram.findFirst).toHaveBeenNthCalledWith(2, {
            where: { traineeId, status: 'active' },
            select: { id: true },
            orderBy: { startDate: 'desc' },
        })
    })

    it('returns null otherwise', async () => {
        ;(prisma.trainingProgram.findFirst as any).mockResolvedValue(null)
        await expect(loadActiveProgramId(traineeId)).resolves.toBeNull()
    })
})

import { loadProgressAggregates } from '@/lib/trainee-program-data'

describe('loadProgressAggregates – SQL uses DISTINCT for exerciseCount', () => {
    beforeEach(() => {
        ;(prisma.trainingProgram.findUnique as any).mockResolvedValue({
            id: 'p1',
            title: 'Test',
            status: 'active',
            startDate: new Date('2026-04-01'),
            durationWeeks: 4,
        })
    })

    it('uses COUNT(DISTINCT we.id) so multiple feedbacks per exercise do not inflate exerciseCount', async () => {
        ;(prisma.workout.findMany as any).mockResolvedValue([])
        ;(prisma.$queryRaw as any).mockResolvedValue([])

        await loadProgressAggregates('p1')

        // Verify the completion SQL uses DISTINCT to avoid overcounting when an exercise
        // has multiple ExerciseFeedback rows (e.g. draft on day 1, final submit on day 2).
        const firstCall = (prisma.$queryRaw as any).mock.calls[0]
        const sqlParts: string[] = Array.from(firstCall[0])
        const sql = sqlParts.join('')
        expect(sql).toContain('COUNT(DISTINCT we."id")')
    })

    it('marks workout as completed when the workout completion flag is true', async () => {
        const workoutId = 'wk-1'
        ;(prisma.workout.findMany as any).mockResolvedValue([{
            id: workoutId,
            dayIndex: 1,
            week: { weekNumber: 1, weekType: 'normal' },
        }])
        ;(prisma.$queryRaw as any)
            .mockResolvedValueOnce([{
                workoutId,
                weekNumber: 1,
                exerciseCount: 1,
                workoutCompleted: true,
                startedFeedbackCount: 0,
            }])
            .mockResolvedValueOnce([{ weekNumber: 1, totalVolume: 0 }])
            .mockResolvedValueOnce([{ weekNumber: 1, avgRpe: null, feedbackCount: 0 }])

        const result = await loadProgressAggregates('p1')

        expect(result.workouts[0].completed).toBe(true)
        expect(result.completedWorkouts).toBe(1)
    })

    it('ignores empty workouts when calculating totals and next workout', async () => {
        ;(prisma.workout.findMany as any).mockResolvedValue([
            {
                id: 'wk-empty',
                dayIndex: 1,
                week: { weekNumber: 1, weekType: 'normal' },
            },
            {
                id: 'wk-real',
                dayIndex: 2,
                week: { weekNumber: 1, weekType: 'normal' },
            },
        ])
        ;(prisma.$queryRaw as any)
            .mockResolvedValueOnce([
                {
                    workoutId: 'wk-empty',
                    weekNumber: 1,
                    exerciseCount: 0,
                    workoutCompleted: false,
                    startedFeedbackCount: 0,
                },
                {
                    workoutId: 'wk-real',
                    weekNumber: 1,
                    exerciseCount: 1,
                    workoutCompleted: false,
                    startedFeedbackCount: 0,
                },
            ])
            .mockResolvedValueOnce([{ weekNumber: 1, totalVolume: 0 }])
            .mockResolvedValueOnce([{ weekNumber: 1, avgRpe: null, feedbackCount: 0 }])

        const result = await loadProgressAggregates('p1')

        expect(result.totalWorkouts).toBe(1)
        expect(result.completedWorkouts).toBe(0)
        expect(result.nextWorkout?.id).toBe('wk-real')
        expect(result.weeklyStats[0]).toMatchObject({
            completedWorkouts: 0,
            totalWorkouts: 1,
        })
    })

    it('returns the first incomplete workout in order even if a later workout is already started', async () => {
        ;(prisma.workout.findMany as any).mockResolvedValue([
            {
                id: 'wk-todo',
                dayIndex: 1,
                week: { weekNumber: 1, weekType: 'normal' },
            },
            {
                id: 'wk-started',
                dayIndex: 2,
                week: { weekNumber: 1, weekType: 'normal' },
            },
        ])
        ;(prisma.$queryRaw as any)
            .mockResolvedValueOnce([
                {
                    workoutId: 'wk-todo',
                    weekNumber: 1,
                    exerciseCount: 1,
                    workoutCompleted: false,
                    startedFeedbackCount: 0,
                },
                {
                    workoutId: 'wk-started',
                    weekNumber: 1,
                    exerciseCount: 1,
                    workoutCompleted: false,
                    startedFeedbackCount: 1,
                },
            ])
            .mockResolvedValueOnce([{ weekNumber: 1, totalVolume: 0 }])
            .mockResolvedValueOnce([{ weekNumber: 1, avgRpe: null, feedbackCount: 1 }])

        const result = await loadProgressAggregates('p1')

        expect(result.nextWorkout?.id).toBe('wk-todo')
        expect(result.nextWorkout?.started).toBe(false)
    })
})
