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

const TRAINER_FILTER = { workoutExercise: { workout: { week: { program: { trainerId: 'trainer-1' } } } } }
const MONTH_AGO = at('2026-09-03T10:00:00')

function arrange({
    rows = [],
    activeMonthAgo = [],
    programs = 0,
    programsMonthAgo = 0,
    library = 0,
    libraryMonthAgo = 0,
    sets = [0, 0],
}: {
    rows?: ReturnType<typeof feedback>[]
    activeMonthAgo?: string[]
    programs?: number
    programsMonthAgo?: number
    library?: number
    libraryMonthAgo?: number
    sets?: [number, number]
}) {
    prismaMock.exerciseFeedback.findMany.mockImplementation(((args: { distinct?: unknown }) =>
        Promise.resolve(args.distinct ? activeMonthAgo.map((traineeId) => ({ traineeId })) : rows)) as never)
    prismaMock.trainingProgram.count.mockImplementation(((args: { where: { status: unknown } }) =>
        Promise.resolve(args.where.status === 'active' ? programs : programsMonthAgo)) as never)
    prismaMock.exercise.count.mockImplementation(((args?: { where?: unknown }) =>
        Promise.resolve(args?.where ? libraryMonthAgo : library)) as never)
    prismaMock.setPerformed.count.mockResolvedValueOnce(sets[0]).mockResolvedValueOnce(sets[1])
}

describe('getHeaderKpis', () => {
    it('counts active trainees, active programs and sessions this week vs last week', async () => {
        arrange({
            programs: 3,
            library: 120,
            sets: [40, 25],
            rows: [
                // last week (21–27 Sep), t2 only; 27 Sep is inside the 7-day window
                feedback('t2', 'w1', '2026-09-22'),
                feedback('t2', 'w2', '2026-09-27'),
                // this week (from 28 Sep): two exercises of one session + another session
                feedback('t1', 'w3', '2026-09-30'),
                feedback('t1', 'w3', '2026-09-30'),
                feedback('t1', 'w4', '2026-10-02'),
            ],
        })

        const kpis = await getHeaderKpis('trainer-1', TRAINEES, NOW)

        expect(prismaMock.trainingProgram.count).toHaveBeenCalledWith({
            where: { trainerId: 'trainer-1', status: 'active', traineeId: { in: ['t1', 't2'] } },
        })
        expect(prismaMock.exerciseFeedback.findMany).toHaveBeenCalledWith({
            where: { traineeId: { in: ['t1', 't2'] }, date: { gte: day('2026-09-21') }, ...TRAINER_FILTER },
            select: {
                traineeId: true,
                date: true,
                createdAt: true,
                workoutExercise: { select: { workoutId: true } },
            },
        })
        expect(kpis).toMatchObject({
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

    it('compares active trainees, active programs and library with 30 days ago', async () => {
        arrange({ activeMonthAgo: ['t1'], programs: 3, programsMonthAgo: 2, library: 120, libraryMonthAgo: 110 })

        const kpis = await getHeaderKpis('trainer-1', TRAINEES, NOW)

        // same 7-day window, shifted back 30 days: 27 Aug – 3 Sep included
        expect(prismaMock.exerciseFeedback.findMany).toHaveBeenCalledWith({
            where: { traineeId: { in: ['t1', 't2'] }, date: { gte: day('2026-08-27'), lt: day('2026-09-04') }, ...TRAINER_FILTER },
            select: { traineeId: true },
            distinct: ['traineeId'],
        })
        expect(prismaMock.trainingProgram.count).toHaveBeenCalledWith({
            where: {
                trainerId: 'trainer-1',
                traineeId: { in: ['t1', 't2'] },
                status: { in: ['active', 'completed'] },
                publishedAt: { lte: MONTH_AGO },
                OR: [{ completedAt: null }, { completedAt: { gt: MONTH_AGO } }],
            },
        })
        expect(prismaMock.exercise.count).toHaveBeenCalledWith({ where: { createdAt: { lte: MONTH_AGO } } })
        expect(kpis).toMatchObject({
            activeTraineesMonthAgo: 1,
            activeProgramsMonthAgo: 2,
            libraryExercises: 120,
            libraryExercisesMonthAgo: 110,
        })
    })

    it('counts confirmed sets of this trainer\'s programs, this week and last week', async () => {
        arrange({})

        await getHeaderKpis('trainer-1', TRAINEES, NOW)

        const feedbackOf = (from: string, to: string) => ({
            traineeId: { in: ['t1', 't2'] },
            date: { gte: day(from), lt: day(to) },
            ...TRAINER_FILTER,
        })
        expect(prismaMock.setPerformed.count).toHaveBeenCalledWith({ where: { completed: true, feedback: feedbackOf('2026-09-28', '2026-10-05') } })
        expect(prismaMock.setPerformed.count).toHaveBeenCalledWith({ where: { completed: true, feedback: feedbackOf('2026-09-21', '2026-09-28') } })
    })

    it('does not count a trainee whose last session is older than the 7-day window as active', async () => {
        arrange({ programs: 1, rows: [feedback('t1', 'w1', '2026-09-25')] })

        const kpis = await getHeaderKpis('trainer-1', TRAINEES, NOW)

        expect(kpis.activeTrainees).toBe(0)
        expect(kpis.sessionsLastWeek).toBe(1)
    })

    it('only counts the library when the trainer has no active trainees', async () => {
        arrange({ library: 120, libraryMonthAgo: 100 })

        const kpis = await getHeaderKpis('trainer-1', [makeTrainee('t9', 'Off', 'Line', false)], NOW)

        expect(prismaMock.trainingProgram.count).not.toHaveBeenCalled()
        expect(prismaMock.exerciseFeedback.findMany).not.toHaveBeenCalled()
        expect(prismaMock.setPerformed.count).not.toHaveBeenCalled()
        expect(kpis).toEqual({
            activeTrainees: 0,
            activeTraineesMonthAgo: 0,
            totalTrainees: 0,
            activePrograms: 0,
            activeProgramsMonthAgo: 0,
            sessionsThisWeek: 0,
            sessionsLastWeek: 0,
            libraryExercises: 120,
            libraryExercisesMonthAgo: 100,
            confirmedSetsThisWeek: 0,
            confirmedSetsLastWeek: 0,
        })
    })
})
