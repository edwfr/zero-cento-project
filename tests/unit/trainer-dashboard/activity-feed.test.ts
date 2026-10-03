import { describe, it, expect } from 'vitest'
import { getActivityFeed } from '@/lib/trainer-dashboard/activity-feed'
import { prismaMock } from '../../helpers/prisma-mock'
import { NOW, TRAINEES, at, day, makeTrainee } from './fixtures'

const feedback = (traineeId: string, workoutId: string, date: string, time: string, dayIndex = 1, weekNumber = 2) => ({
    traineeId,
    date: day(date),
    createdAt: at(`${date}T${time}`),
    workoutExercise: { workoutId, workout: { dayIndex, week: { weekNumber, programId: `prog-${traineeId}` } } },
})

describe('getActivityFeed', () => {
    it('queries yesterday and today of feedback and personal records', async () => {
        prismaMock.exerciseFeedback.findMany.mockResolvedValue([] as never)
        prismaMock.personalRecord.findMany.mockResolvedValue([] as never)

        await expect(getActivityFeed('trainer-1', TRAINEES, NOW)).resolves.toEqual([])

        expect(prismaMock.exerciseFeedback.findMany).toHaveBeenCalledWith({
            where: { traineeId: { in: ['t1', 't2'] }, date: { gte: day('2026-10-02') }, workoutExercise: { workout: { week: { program: { trainerId: 'trainer-1' } } } } },
            select: {
                traineeId: true,
                date: true,
                createdAt: true,
                workoutExercise: {
                    select: {
                        workoutId: true,
                        workout: { select: { dayIndex: true, week: { select: { weekNumber: true, programId: true } } } },
                    },
                },
            },
        })
        expect(prismaMock.personalRecord.findMany).toHaveBeenCalledWith({
            where: { traineeId: { in: ['t1', 't2'] }, recordDate: { gte: day('2026-10-02') } },
            select: { traineeId: true, recordDate: true },
        })
    })

    it('turns feedback into sessions with workout details and flags same-day records', async () => {
        prismaMock.exerciseFeedback.findMany.mockResolvedValue([
            feedback('t1', 'w1', '2026-10-03', '08:00:00', 3, 2),
            feedback('t1', 'w1', '2026-10-03', '08:30:00', 3, 2),
            feedback('t2', 'w9', '2026-10-02', '19:00:00', 1, 5),
        ] as never)
        prismaMock.personalRecord.findMany.mockResolvedValue([{ traineeId: 't1', recordDate: at('2026-10-03T08:15:00') }] as never)

        await expect(getActivityFeed('trainer-1', TRAINEES, NOW)).resolves.toEqual([
            {
                key: 't1|w1|2026-10-03', traineeId: 't1', traineeName: 'Anna Rossi', initials: 'AR',
                programId: 'prog-t1', weekNumber: 2, dayIndex: 3, exerciseCount: 2,
                lastLoggedAt: at('2026-10-03T08:30:00'), day: '2026-10-03', hasRecord: true,
            },
            {
                key: 't2|w9|2026-10-02', traineeId: 't2', traineeName: 'Luca Bianchi', initials: 'LB',
                programId: 'prog-t2', weekNumber: 5, dayIndex: 1, exerciseCount: 1,
                lastLoggedAt: at('2026-10-02T19:00:00'), day: '2026-10-02', hasRecord: false,
            },
        ])
    })

    it('returns every session, most recent first, with no cap', async () => {
        prismaMock.exerciseFeedback.findMany.mockResolvedValue(
            Array.from({ length: 20 }, (_, index) => feedback('t1', `w${index}`, '2026-10-02', `${String(index).padStart(2, '0')}:00:00`)) as never,
        )
        prismaMock.personalRecord.findMany.mockResolvedValue([] as never)

        const items = await getActivityFeed('trainer-1', TRAINEES, NOW)

        expect(items).toHaveLength(20)
        expect(items[0].key).toBe('t1|w19|2026-10-02')
    })

    it('does not query without active trainees', async () => {
        await expect(getActivityFeed('trainer-1', [makeTrainee('t9', 'Off', 'Line', false)], NOW)).resolves.toEqual([])
        expect(prismaMock.exerciseFeedback.findMany).not.toHaveBeenCalled()
    })
})
