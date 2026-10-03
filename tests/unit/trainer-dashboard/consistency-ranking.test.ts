import { describe, it, expect } from 'vitest'
import { getConsistencyRanking } from '@/lib/trainer-dashboard/consistency-ranking'
import { prismaMock } from '../../helpers/prisma-mock'
import { NOW, TRAINEES, at, day, makeTrainee } from './fixtures'

const program = (traineeId: string, startDate: string, workoutsPerWeek: number) => ({
    traineeId,
    startDate: day(startDate),
    workoutsPerWeek,
})

const sessionOn = (traineeId: string, workoutId: string, date: string) => ({
    traineeId,
    date: day(date),
    createdAt: at(`${date}T18:00:00`),
    workoutExercise: { workoutId },
})

const trainees = [...TRAINEES, makeTrainee('t4', 'Bruno', 'Neri')]

describe('getConsistencyRanking', () => {
    it('queries active started programs and the last 28 days of feedback', async () => {
        prismaMock.trainingProgram.findMany.mockResolvedValue([program('t1', '2026-08-01', 3)] as never)
        prismaMock.exerciseFeedback.findMany.mockResolvedValue([] as never)

        await getConsistencyRanking('trainer-1', trainees, NOW)

        expect(prismaMock.trainingProgram.findMany).toHaveBeenCalledWith({
            where: { trainerId: 'trainer-1', status: 'active', startDate: { lte: NOW } },
            select: { traineeId: true, startDate: true, workoutsPerWeek: true },
            orderBy: { startDate: 'desc' },
        })
        expect(prismaMock.exerciseFeedback.findMany).toHaveBeenCalledWith({
            where: { traineeId: { in: ['t1'] }, date: { gte: day('2026-09-06') } },
            select: {
                traineeId: true,
                date: true,
                createdAt: true,
                workoutExercise: { select: { workoutId: true } },
            },
        })
    })

    it('computes adherence over 4 weeks, or over the elapsed weeks for a recent program, capped at 100%', async () => {
        prismaMock.trainingProgram.findMany.mockResolvedValue([
            program('t1', '2026-08-01', 3), // full window: expected 12
            program('t2', '2026-09-24', 2), // started 10 days ago: 2 weeks → expected 4
            program('t3', '2026-08-01', 3), // deactivated trainee → ignored
            program('t4', '2026-08-01', 1), // expected 4, over-delivers
        ] as never)
        prismaMock.exerciseFeedback.findMany.mockResolvedValue([
            ...['w1', 'w2', 'w3', 'w4', 'w5', 'w6'].map((workoutId, index) => sessionOn('t1', workoutId, `2026-09-${10 + index}`)),
            sessionOn('t1', 'old', '2026-09-05'), // before the window: the query would not return it, and it is ignored anyway
            sessionOn('t2', 'w1', '2026-09-23'), // before t2's program start → ignored
            sessionOn('t2', 'w2', '2026-09-25'),
            sessionOn('t2', 'w3', '2026-10-01'),
            sessionOn('t2', 'w4', '2026-10-02'),
            ...['a', 'b', 'c', 'd', 'e'].map((workoutId, index) => sessionOn('t4', workoutId, `2026-09-2${index}`)),
        ] as never)

        await expect(getConsistencyRanking('trainer-1', trainees, NOW)).resolves.toEqual([
            { traineeId: 't4', traineeName: 'Bruno Neri', sessions: 5, expected: 4, adherence: 1 },
            { traineeId: 't2', traineeName: 'Luca Bianchi', sessions: 3, expected: 4, adherence: 0.75 },
            { traineeId: 't1', traineeName: 'Anna Rossi', sessions: 6, expected: 12, adherence: 0.5 },
        ])
    })

    it('uses only the most recently started active program per trainee', async () => {
        prismaMock.trainingProgram.findMany.mockResolvedValue([
            program('t1', '2026-09-28', 4), // newest first (orderBy startDate desc)
            program('t1', '2026-06-01', 2),
        ] as never)
        prismaMock.exerciseFeedback.findMany.mockResolvedValue([sessionOn('t1', 'w1', '2026-09-29')] as never)

        await expect(getConsistencyRanking('trainer-1', trainees, NOW)).resolves.toEqual([
            { traineeId: 't1', traineeName: 'Anna Rossi', sessions: 1, expected: 4, adherence: 0.25 },
        ])
    })

    it('keeps the top 5 and breaks ties by sessions then name', async () => {
        const many = Array.from({ length: 7 }, (_, index) => makeTrainee(`n${index}`, `Name${index}`, 'Z'))
        prismaMock.trainingProgram.findMany.mockResolvedValue(many.map((trainee) => program(trainee.id, '2026-08-01', 0)) as never)
        prismaMock.exerciseFeedback.findMany.mockResolvedValue([] as never)

        const items = await getConsistencyRanking('trainer-1', many, NOW)

        expect(items).toHaveLength(5)
        expect(items.every((item) => item.adherence === 0)).toBe(true)
        expect(items.map((item) => item.traineeName)).toEqual(['Name0 Z', 'Name1 Z', 'Name2 Z', 'Name3 Z', 'Name4 Z'])
    })

    it('skips the feedback query when no active trainee has a started program', async () => {
        prismaMock.trainingProgram.findMany.mockResolvedValue([program('t3', '2026-08-01', 3)] as never)

        await expect(getConsistencyRanking('trainer-1', trainees, NOW)).resolves.toEqual([])
        expect(prismaMock.exerciseFeedback.findMany).not.toHaveBeenCalled()
    })
})
