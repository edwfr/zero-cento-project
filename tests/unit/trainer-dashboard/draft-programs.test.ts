import { describe, it, expect } from 'vitest'
import { getDraftPrograms } from '@/lib/trainer-dashboard/draft-programs'
import { prismaMock } from '../../helpers/prisma-mock'
import { NOW, TRAINEES, at, makeTrainee } from './fixtures'

const draft = (id: string, firstName: string, createdAt: string) => ({
    id,
    title: `Bozza ${id}`,
    createdAt: at(createdAt),
    trainee: { firstName, lastName: 'X' },
})

describe('getDraftPrograms', () => {
    it('queries the drafts of active trainees, newest first', async () => {
        prismaMock.trainingProgram.findMany.mockResolvedValue([] as never)

        await expect(getDraftPrograms('trainer-1', TRAINEES, NOW)).resolves.toEqual([])

        expect(prismaMock.trainingProgram.findMany).toHaveBeenCalledWith({
            where: { trainerId: 'trainer-1', status: 'draft', traineeId: { in: ['t1', 't2'] } },
            select: { id: true, title: true, createdAt: true, trainee: { select: { firstName: true, lastName: true } } },
            orderBy: { createdAt: 'desc' },
        })
    })

    it('counts calendar days since creation: 0 today, 1 yesterday', async () => {
        prismaMock.trainingProgram.findMany.mockResolvedValue([
            draft('p1', 'Anna', '2026-10-03T08:00:00'),
            draft('p2', 'Luca', '2026-10-02T23:30:00'),
            draft('p3', 'Sara', '2026-09-20T09:00:00'),
        ] as never)

        await expect(getDraftPrograms('trainer-1', TRAINEES, NOW)).resolves.toEqual([
            { programId: 'p1', traineeName: 'Anna X', programTitle: 'Bozza p1', daysSinceCreated: 0 },
            { programId: 'p2', traineeName: 'Luca X', programTitle: 'Bozza p2', daysSinceCreated: 1 },
            { programId: 'p3', traineeName: 'Sara X', programTitle: 'Bozza p3', daysSinceCreated: 13 },
        ])
    })

    it('does not query without active trainees', async () => {
        await expect(getDraftPrograms('trainer-1', [makeTrainee('t9', 'Off', 'Line', false)], NOW)).resolves.toEqual([])
        expect(prismaMock.trainingProgram.findMany).not.toHaveBeenCalled()
    })
})
