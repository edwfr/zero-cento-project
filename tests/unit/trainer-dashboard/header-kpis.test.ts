import { describe, it, expect } from 'vitest'
import { getHeaderKpis } from '@/lib/trainer-dashboard/header-kpis'
import { prismaMock } from '../../helpers/prisma-mock'
import { NOW, TRAINEES, at, day, makeTrainee } from './fixtures'

const feedback = (traineeId: string, workoutId: string, date: string) => ({
    traineeId,
    date: day(date),
    createdAt: at(`${date}T18:00:00`),
    workoutExercise: { workoutId },
})

describe('getHeaderKpis', () => {
    it('counts active trainees, active programs and sessions this week vs last week', async () => {
        prismaMock.trainingProgram.count.mockResolvedValue(3)
        prismaMock.exercise.count.mockResolvedValue(120)
        prismaMock.setPerformed.count.mockResolvedValueOnce(40).mockResolvedValueOnce(25)
        prismaMock.exerciseFeedback.findMany.mockResolvedValue([
            // last week (21–27 Sep), t2 only; 27 Sep is inside the 7-day window
            feedback('t2', 'w1', '2026-09-22'),
            feedback('t2', 'w2', '2026-09-27'),
            // this week (from 28 Sep): two exercises of one session + another session
            feedback('t1', 'w3', '2026-09-30'),
            feedback('t1', 'w3', '2026-09-30'),
            feedback('t1', 'w4', '2026-10-02'),
        ] as never)

        const kpis = await getHeaderKpis('trainer-1', TRAINEES, NOW)

        expect(prismaMock.trainingProgram.count).toHaveBeenCalledWith({
            where: { trainerId: 'trainer-1', status: 'active', traineeId: { in: ['t1', 't2'] } },
        })
        expect(prismaMock.exerciseFeedback.findMany).toHaveBeenCalledWith({
            where: { traineeId: { in: ['t1', 't2'] }, date: { gte: day('2026-09-21') }, workoutExercise: { workout: { week: { program: { trainerId: 'trainer-1' } } } } },
            select: {
                traineeId: true,
                date: true,
                createdAt: true,
                workoutExercise: { select: { workoutId: true } },
            },
        })
        expect(kpis).toEqual({
            activeTrainees: 2,
            totalTrainees: 2,
            activePrograms: 3,
            sessionsThisWeek: 2,
            sessionsLastWeek: 2,
            libraryExercises: 120,
            confirmedSetsThisWeek: 40,
            confirmedSetsLastWeek: 25,
        })
    })

    it('counts confirmed sets of this trainer\'s programs, this week and last week', async () => {
        prismaMock.trainingProgram.count.mockResolvedValue(0)
        prismaMock.exerciseFeedback.findMany.mockResolvedValue([] as never)
        prismaMock.exercise.count.mockResolvedValue(0)
        prismaMock.setPerformed.count.mockResolvedValue(0)

        await getHeaderKpis('trainer-1', TRAINEES, NOW)

        const feedbackOf = (from: string, to: string) => ({
            traineeId: { in: ['t1', 't2'] },
            date: { gte: day(from), lt: day(to) },
            workoutExercise: { workout: { week: { program: { trainerId: 'trainer-1' } } } },
        })
        expect(prismaMock.exercise.count).toHaveBeenCalledWith()
        expect(prismaMock.setPerformed.count).toHaveBeenCalledWith({ where: { completed: true, feedback: feedbackOf('2026-09-28', '2026-10-05') } })
        expect(prismaMock.setPerformed.count).toHaveBeenCalledWith({ where: { completed: true, feedback: feedbackOf('2026-09-21', '2026-09-28') } })
    })

    it('does not count a trainee whose last session is older than the 7-day window as active', async () => {
        prismaMock.trainingProgram.count.mockResolvedValue(1)
        prismaMock.exerciseFeedback.findMany.mockResolvedValue([feedback('t1', 'w1', '2026-09-25')] as never)

        const kpis = await getHeaderKpis('trainer-1', TRAINEES, NOW)

        expect(kpis.activeTrainees).toBe(0)
        expect(kpis.sessionsLastWeek).toBe(1)
    })

    it('only counts the library when the trainer has no active trainees', async () => {
        prismaMock.exercise.count.mockResolvedValue(120)

        const kpis = await getHeaderKpis('trainer-1', [makeTrainee('t9', 'Off', 'Line', false)], NOW)

        expect(prismaMock.trainingProgram.count).not.toHaveBeenCalled()
        expect(prismaMock.exerciseFeedback.findMany).not.toHaveBeenCalled()
        expect(prismaMock.setPerformed.count).not.toHaveBeenCalled()
        expect(kpis).toEqual({
            activeTrainees: 0,
            totalTrainees: 0,
            activePrograms: 0,
            sessionsThisWeek: 0,
            sessionsLastWeek: 0,
            libraryExercises: 120,
            confirmedSetsThisWeek: 0,
            confirmedSetsLastWeek: 0,
        })
    })
})
