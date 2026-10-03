import { describe, it, expect } from 'vitest'
import { activeTraineeIds, fullName, getTrainerTrainees, initials } from '@/lib/trainer-dashboard/trainees'
import { prismaMock } from '../../helpers/prisma-mock'
import { TRAINEES } from './fixtures'

describe('getTrainerTrainees', () => {
    it("loads the trainer's trainees with their active flag in one query", async () => {
        prismaMock.trainerTrainee.findMany.mockResolvedValue([
            { trainee: TRAINEES[0] },
            { trainee: TRAINEES[2] },
        ] as never)

        const result = await getTrainerTrainees('trainer-1')

        expect(prismaMock.trainerTrainee.findMany).toHaveBeenCalledWith({
            where: { trainerId: 'trainer-1' },
            select: { trainee: { select: { id: true, firstName: true, lastName: true, isActive: true } } },
        })
        expect(result).toEqual([TRAINEES[0], TRAINEES[2]])
    })
})

describe('trainee helpers', () => {
    it('activeTraineeIds drops deactivated trainees', () => {
        expect(activeTraineeIds(TRAINEES)).toEqual(['t1', 't2'])
    })

    it('fullName and initials', () => {
        expect(fullName(TRAINEES[0])).toBe('Anna Rossi')
        expect(initials(TRAINEES[0])).toBe('AR')
        expect(initials({ firstName: 'élodie', lastName: '' })).toBe('É')
    })
})
