import { describe, it, expect, type Mock } from 'vitest'
import { getCurrentEndDates, getTrainerSubscriptionOverview } from '@/lib/subscription-queries'
import { prismaMock } from '../../helpers/prisma-mock'

const day = (iso: string) => new Date(`${iso}T00:00:00.000Z`)

// Prisma's groupBy generics defeat the deep mock's typing: treat it as a plain mock
const groupByMock = prismaMock.subscriptionRenewal.groupBy as unknown as Mock

describe('getCurrentEndDates', () => {
    it('returns an empty map without querying when there are no trainees', async () => {
        const result = await getCurrentEndDates([])

        expect(result.size).toBe(0)
        expect(prismaMock.subscriptionRenewal.groupBy).not.toHaveBeenCalled()
    })

    it('maps each trainee to its latest end date, skipping empty aggregates', async () => {
        groupByMock.mockResolvedValue([
            { traineeId: 't1', _max: { endDate: day('2026-12-01') } },
            { traineeId: 't2', _max: { endDate: null } },
        ] as never)

        const result = await getCurrentEndDates(['t1', 't2'])

        expect(prismaMock.subscriptionRenewal.groupBy).toHaveBeenCalledWith({
            by: ['traineeId'],
            where: { traineeId: { in: ['t1', 't2'] } },
            _max: { endDate: true },
        })
        expect(result).toEqual(new Map([['t1', day('2026-12-01')]]))
    })
})

describe('getTrainerSubscriptionOverview', () => {
    it("builds the overview from the trainer's active trainees only", async () => {
        prismaMock.trainerTrainee.findMany.mockResolvedValue([
            { trainee: { id: 't1', firstName: 'Anna', lastName: 'Rossi' } },
            { trainee: { id: 't2', firstName: 'Luca', lastName: 'Bianchi' } },
        ] as never)
        groupByMock.mockResolvedValue([
            { traineeId: 't1', _max: { endDate: day('2026-10-10') } },
        ] as never)

        const overview = await getTrainerSubscriptionOverview('trainer-1', day('2026-10-03'))

        expect(prismaMock.trainerTrainee.findMany).toHaveBeenCalledWith({
            where: { trainerId: 'trainer-1', trainee: { isActive: true } },
            select: { trainee: { select: { id: true, firstName: true, lastName: true } } },
        })
        expect(overview.withSubscription.map((item) => item.traineeId)).toEqual(['t1'])
        expect(overview.withoutSubscription.map((item) => item.traineeId)).toEqual(['t2'])
        expect(overview.counts.expiring).toBe(1)
    })
})
