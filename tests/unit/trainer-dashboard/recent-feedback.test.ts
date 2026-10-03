import { describe, it, expect } from 'vitest'
import { getRecentFeedback } from '@/lib/trainer-dashboard/recent-feedback'
import { prismaMock } from '../../helpers/prisma-mock'
import { NOW, TRAINEES, at, day, makeTrainee } from './fixtures'

const row = (
    id: string,
    { notes = null, actualRpe = null, setRpes = [] }: { notes?: string | null; actualRpe?: number | null; setRpes?: (number | null)[] },
) => ({
    id,
    notes,
    actualRpe,
    createdAt: at('2026-10-02T18:00:00'),
    trainee: { firstName: 'Anna', lastName: 'Rossi' },
    setsPerformed: setRpes.map((value) => ({ actualRpe: value })),
    workoutExercise: { exercise: { name: 'Squat' }, workout: { week: { programId: 'p1' } } },
})

describe('getRecentFeedback', () => {
    it('loads recent feedback with a note or high RPE, newest first', async () => {
        prismaMock.exerciseFeedback.findMany.mockResolvedValue([] as never)

        await getRecentFeedback('trainer-1', TRAINEES, NOW)

        expect(prismaMock.exerciseFeedback.findMany).toHaveBeenCalledWith({
            where: {
                traineeId: { in: ['t1', 't2'] },
                date: { gte: day('2026-09-26') },
                workoutExercise: { workout: { week: { program: { trainerId: 'trainer-1' } } } },
                OR: [
                    { notes: { not: null } },
                    { actualRpe: { gte: 9 } },
                    { setsPerformed: { some: { actualRpe: { gte: 9 } } } },
                ],
            },
            orderBy: { createdAt: 'desc' },
            take: 20,
            select: {
                id: true,
                notes: true,
                actualRpe: true,
                createdAt: true,
                trainee: { select: { firstName: true, lastName: true } },
                setsPerformed: { select: { actualRpe: true } },
                workoutExercise: {
                    select: {
                        exercise: { select: { name: true } },
                        workout: { select: { week: { select: { programId: true } } } },
                    },
                },
            },
        })
    })

    it('maps rows, trims notes and takes the highest RPE from feedback or sets', async () => {
        prismaMock.exerciseFeedback.findMany.mockResolvedValue([
            row('f1', { notes: '  Dolore al ginocchio  ', actualRpe: 7 }),
            row('f2', { actualRpe: 8, setRpes: [8, 9.5, null] }),
        ] as never)

        await expect(getRecentFeedback('trainer-1', TRAINEES, NOW)).resolves.toEqual([
            {
                id: 'f1', traineeName: 'Anna Rossi', exerciseName: 'Squat', programId: 'p1',
                rpe: 7, isHighRpe: false, note: 'Dolore al ginocchio', loggedAt: at('2026-10-02T18:00:00'),
            },
            {
                id: 'f2', traineeName: 'Anna Rossi', exerciseName: 'Squat', programId: 'p1',
                rpe: 9.5, isHighRpe: true, note: null, loggedAt: at('2026-10-02T18:00:00'),
            },
        ])
    })

    it('drops whitespace-only notes without high RPE, and caps the list at 10', async () => {
        prismaMock.exerciseFeedback.findMany.mockResolvedValue([
            row('blank', { notes: '   ', actualRpe: 6 }),
            ...Array.from({ length: 12 }, (_, index) => row(`n${index}`, { notes: 'ok' })),
        ] as never)

        const items = await getRecentFeedback('trainer-1', TRAINEES, NOW)

        expect(items).toHaveLength(10)
        expect(items.map((item) => item.id)).not.toContain('blank')
    })

    it('does not query without active trainees', async () => {
        await expect(getRecentFeedback('trainer-1', [makeTrainee('t9', 'Off', 'Line', false)], NOW)).resolves.toEqual([])
        expect(prismaMock.exerciseFeedback.findMany).not.toHaveBeenCalled()
    })
})
