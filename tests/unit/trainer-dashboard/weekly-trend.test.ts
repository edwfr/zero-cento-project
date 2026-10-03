import { describe, it, expect } from 'vitest'
import { getWeeklyTrend } from '@/lib/trainer-dashboard/weekly-trend'
import { prismaMock } from '../../helpers/prisma-mock'
import { NOW, TRAINEES, at, day, makeTrainee } from './fixtures'

const WEEK_STARTS = ['2026-08-10', '2026-08-17', '2026-08-24', '2026-08-31', '2026-09-07', '2026-09-14', '2026-09-21', '2026-09-28']

const feedback = (workoutId: string, date: string, sets: { reps: number; weight: number }[]) => ({
    traineeId: 't1',
    date: day(date),
    createdAt: at(`${date}T18:00:00`),
    workoutExercise: { workoutId },
    setsPerformed: sets,
})

describe('getWeeklyTrend', () => {
    it('returns 8 empty weeks without querying when there are no active trainees', async () => {
        const weeks = await getWeeklyTrend([makeTrainee('t9', 'Off', 'Line', false)], NOW)

        expect(weeks).toEqual(WEEK_STARTS.map((weekStart) => ({ weekStart, sessions: 0, volumeKg: 0 })))
        expect(prismaMock.exerciseFeedback.findMany).not.toHaveBeenCalled()
    })

    it('buckets sessions and completed-set volume into ISO weeks', async () => {
        prismaMock.exerciseFeedback.findMany.mockResolvedValue([
            // first week
            feedback('w1', '2026-08-10', [{ reps: 5, weight: 100 }]),
            // current week: one session with two exercises + one more session
            feedback('w2', '2026-09-28', [{ reps: 5, weight: 100 }, { reps: 5, weight: 100 }]),
            feedback('w2', '2026-09-28', [{ reps: 10, weight: 20.5 }]),
            // Sunday 4 Oct still belongs to the current week
            feedback('w3', '2026-10-04', []),
        ] as never)

        const weeks = await getWeeklyTrend(TRAINEES, NOW)

        expect(prismaMock.exerciseFeedback.findMany).toHaveBeenCalledWith({
            where: { traineeId: { in: ['t1', 't2'] }, date: { gte: day('2026-08-10') } },
            select: {
                traineeId: true,
                date: true,
                createdAt: true,
                workoutExercise: { select: { workoutId: true } },
                setsPerformed: { where: { completed: true }, select: { reps: true, weight: true } },
            },
        })
        expect(weeks[0]).toEqual({ weekStart: '2026-08-10', sessions: 1, volumeKg: 500 })
        expect(weeks.slice(1, 7).every((week) => week.sessions === 0 && week.volumeKg === 0)).toBe(true)
        expect(weeks[7]).toEqual({ weekStart: '2026-09-28', sessions: 2, volumeKg: 1205 })
    })
})
