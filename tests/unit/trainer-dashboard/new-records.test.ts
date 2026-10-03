import { describe, it, expect } from 'vitest'
import { getNewRecords } from '@/lib/trainer-dashboard/new-records'
import { prismaMock } from '../../helpers/prisma-mock'
import { NOW, TRAINEES, day, makeTrainee } from './fixtures'

const record = (id: string, traineeId: string, exerciseId: string, reps: number, weight: number, date: string) => ({
    id,
    traineeId,
    exerciseId,
    reps,
    weight,
    recordDate: day(date),
    trainee: { firstName: 'Anna', lastName: 'Rossi' },
    exercise: { name: exerciseId === 'e1' ? 'Squat' : 'Panca' },
})

describe('getNewRecords', () => {
    it('loads this week records and compares them with the previous best of the same lift and reps', async () => {
        prismaMock.personalRecord.findMany
            .mockResolvedValueOnce([
                record('r1', 't1', 'e1', 1, 142.5, '2026-10-02'),
                record('r2', 't1', 'e2', 5, 80, '2026-09-30'),
            ] as never)
            .mockResolvedValueOnce([
                { traineeId: 't1', exerciseId: 'e1', reps: 1, weight: 130, recordDate: day('2026-06-01') },
                { traineeId: 't1', exerciseId: 'e1', reps: 1, weight: 137.4, recordDate: day('2026-08-01') },
                // same lift, different reps: not comparable
                { traineeId: 't1', exerciseId: 'e2', reps: 3, weight: 85, recordDate: day('2026-08-01') },
            ] as never)

        const items = await getNewRecords(TRAINEES, NOW)

        expect(prismaMock.personalRecord.findMany).toHaveBeenNthCalledWith(1, {
            where: { traineeId: { in: ['t1', 't2'] }, recordDate: { gte: day('2026-09-26') } },
            orderBy: { recordDate: 'desc' },
            take: 6,
            select: {
                id: true,
                traineeId: true,
                exerciseId: true,
                reps: true,
                weight: true,
                recordDate: true,
                trainee: { select: { firstName: true, lastName: true } },
                exercise: { select: { name: true } },
            },
        })
        expect(prismaMock.personalRecord.findMany).toHaveBeenNthCalledWith(2, {
            where: {
                OR: [
                    { traineeId: 't1', exerciseId: 'e1', reps: 1, recordDate: { lt: day('2026-10-02') } },
                    { traineeId: 't1', exerciseId: 'e2', reps: 5, recordDate: { lt: day('2026-09-30') } },
                ],
            },
            select: { traineeId: true, exerciseId: true, reps: true, weight: true, recordDate: true },
        })
        expect(items).toEqual([
            { id: 'r1', traineeName: 'Anna Rossi', exerciseName: 'Squat', reps: 1, weight: 142.5, recordDate: day('2026-10-02'), deltaKg: 5.1 },
            { id: 'r2', traineeName: 'Anna Rossi', exerciseName: 'Panca', reps: 5, weight: 80, recordDate: day('2026-09-30'), deltaKg: null },
        ])
    })

    it('skips the comparison query when there are no new records', async () => {
        prismaMock.personalRecord.findMany.mockResolvedValueOnce([] as never)

        await expect(getNewRecords(TRAINEES, NOW)).resolves.toEqual([])
        expect(prismaMock.personalRecord.findMany).toHaveBeenCalledTimes(1)
    })

    it('does not query without active trainees', async () => {
        await expect(getNewRecords([makeTrainee('t9', 'Off', 'Line', false)], NOW)).resolves.toEqual([])
        expect(prismaMock.personalRecord.findMany).not.toHaveBeenCalled()
    })
})
