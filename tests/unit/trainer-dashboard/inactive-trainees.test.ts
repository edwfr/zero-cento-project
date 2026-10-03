import { describe, it, expect, type Mock } from 'vitest'
import { getInactiveTrainees } from '@/lib/trainer-dashboard/inactive-trainees'
import { prismaMock } from '../../helpers/prisma-mock'
import { NOW, TRAINEES, day, makeTrainee } from './fixtures'

const groupByMock = prismaMock.exerciseFeedback.groupBy as unknown as Mock

describe('getInactiveTrainees', () => {
    it('returns trainees with an active program and no feedback in the last 7 days, never-trained first', async () => {
        const trainees = [
            ...TRAINEES,
            makeTrainee('t4', 'Bruno', 'Neri'),
            makeTrainee('t5', 'Carla', 'Blu'),
        ]
        prismaMock.trainingProgram.findMany.mockResolvedValue([
            { traineeId: 't1' }, { traineeId: 't2' }, { traineeId: 't4' }, { traineeId: 't5' },
        ] as never)
        groupByMock.mockResolvedValue([
            { traineeId: 't1', _max: { date: day('2026-09-30') } }, // trained 3 days ago → active
            { traineeId: 't2', _max: { date: day('2026-09-20') } }, // 13 days ago
            { traineeId: 't4', _max: { date: day('2026-09-25') } }, // 8 days ago
            // t5 never trained
        ] as never)

        const result = await getInactiveTrainees('trainer-1', trainees, NOW)

        expect(prismaMock.trainingProgram.findMany).toHaveBeenCalledWith({
            where: { trainerId: 'trainer-1', traineeId: { in: ['t1', 't2', 't4', 't5'] }, status: 'active' },
            select: { traineeId: true },
            distinct: ['traineeId'],
        })
        expect(groupByMock).toHaveBeenCalledWith({
            by: ['traineeId'],
            where: { traineeId: { in: ['t1', 't2', 't4', 't5'] }, workoutExercise: { workout: { week: { program: { trainerId: 'trainer-1' } } } } },
            _max: { date: true },
        })
        expect(result).toEqual({
            total: 3,
            items: [
                { traineeId: 't5', traineeName: 'Carla Blu', initials: 'CB', daysSinceLastSession: null },
                { traineeId: 't2', traineeName: 'Luca Bianchi', initials: 'LB', daysSinceLastSession: 13 },
                { traineeId: 't4', traineeName: 'Bruno Neri', initials: 'BN', daysSinceLastSession: 8 },
            ],
        })
    })

    it('treats feedback exactly at the window start (7 days ago) as recent', async () => {
        prismaMock.trainingProgram.findMany.mockResolvedValue([{ traineeId: 't1' }] as never)
        groupByMock.mockResolvedValue([{ traineeId: 't1', _max: { date: day('2026-09-26') } }] as never)

        await expect(getInactiveTrainees('trainer-1', TRAINEES, NOW)).resolves.toEqual({ items: [], total: 0 })
    })

    it('caps the list at 6 but reports the full total', async () => {
        const many = Array.from({ length: 8 }, (_, index) => makeTrainee(`n${index}`, `Name${index}`, 'Z'))
        prismaMock.trainingProgram.findMany.mockResolvedValue(many.map((trainee) => ({ traineeId: trainee.id })) as never)
        groupByMock.mockResolvedValue([] as never)

        const result = await getInactiveTrainees('trainer-1', many, NOW)

        expect(result.total).toBe(8)
        expect(result.items).toHaveLength(6)
        // all "never": alphabetical
        expect(result.items[0].traineeName).toBe('Name0 Z')
    })

    it('does not query feedback when no trainee has an active program', async () => {
        prismaMock.trainingProgram.findMany.mockResolvedValue([] as never)

        await expect(getInactiveTrainees('trainer-1', TRAINEES, NOW)).resolves.toEqual({ items: [], total: 0 })
        expect(groupByMock).not.toHaveBeenCalled()
    })

    it('does not query at all without active trainees', async () => {
        await expect(getInactiveTrainees('trainer-1', [makeTrainee('t9', 'Off', 'Line', false)], NOW)).resolves.toEqual({ items: [], total: 0 })
        expect(prismaMock.trainingProgram.findMany).not.toHaveBeenCalled()
    })
})
