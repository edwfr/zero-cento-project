import { describe, it, expect } from 'vitest'
import { getCurrentSummaries, getTrainerSubscriptionOverview } from '@/lib/subscription-queries'
import { prismaMock } from '../../helpers/prisma-mock'
import { mockSummaryQueries } from '../../helpers/subscription-mock'

const day = (iso: string) => new Date(`${iso}T00:00:00.000Z`)
const TODAY = day('2026-10-03')

describe('getCurrentSummaries', () => {
    it('returns an empty map without querying when there are no trainees', async () => {
        const result = await getCurrentSummaries([], TODAY)

        expect(result.size).toBe(0)
        expect(prismaMock.subscriptionRenewal.findMany).not.toHaveBeenCalled()
    })

    it('reads the mode from the latest registered renewal of each trainee', async () => {
        mockSummaryQueries()

        await getCurrentSummaries(['t1', 't2'], TODAY)

        expect(prismaMock.subscriptionRenewal.findMany).toHaveBeenCalledWith({
            where: { traineeId: { in: ['t1', 't2'] } },
            orderBy: { createdAt: 'desc' },
            distinct: ['traineeId'],
            select: { traineeId: true, kind: true },
        })
    })

    it('builds a period summary, a programs summary and skips trainees without renewals', async () => {
        mockSummaryQueries({
            latest: [
                { traineeId: 't1', kind: 'period' },
                { traineeId: 't2', kind: 'programs' },
            ],
            totals: [
                { traineeId: 't1', _max: { endDate: day('2026-10-10') }, _sum: { programCount: null } },
                { traineeId: 't2', _max: { endDate: null }, _sum: { programCount: 5 } },
            ],
            usages: [{ traineeId: 't2', _count: { _all: 4 } }],
        })

        const result = await getCurrentSummaries(['t1', 't2', 't3'], TODAY)

        expect(result.get('t1')).toEqual({ kind: 'period', status: 'expiring', endDate: '2026-10-10T00:00:00.000Z', daysLeft: 7 })
        expect(result.get('t2')).toEqual({ kind: 'programs', status: 'expiring', remaining: 1 })
        expect(result.has('t3')).toBe(false)
    })

    it('ignores a leftover package balance when the latest renewal is a period', async () => {
        mockSummaryQueries({
            latest: [{ traineeId: 't1', kind: 'period' }],
            totals: [{ traineeId: 't1', _max: { endDate: day('2026-12-01') }, _sum: { programCount: 5 } }],
            usages: [{ traineeId: 't1', _count: { _all: 2 } }],
        })

        const result = await getCurrentSummaries(['t1'], TODAY)

        expect(result.get('t1')).toMatchObject({ kind: 'period', status: 'active' })
    })

    it('goes into debt when more programs were published than bought', async () => {
        mockSummaryQueries({
            latest: [{ traineeId: 't1', kind: 'programs' }],
            totals: [{ traineeId: 't1', _max: { endDate: null }, _sum: { programCount: 2 } }],
            usages: [{ traineeId: 't1', _count: { _all: 4 } }],
        })

        const result = await getCurrentSummaries(['t1'], TODAY)

        expect(result.get('t1')).toEqual({ kind: 'programs', status: 'expired', remaining: -2 })
    })
})

describe('getTrainerSubscriptionOverview', () => {
    it("builds the overview from the trainer's active trainees only", async () => {
        prismaMock.trainerTrainee.findMany.mockResolvedValue([
            { trainee: { id: 't1', firstName: 'Anna', lastName: 'Rossi' } },
            { trainee: { id: 't2', firstName: 'Luca', lastName: 'Bianchi' } },
        ] as never)
        mockSummaryQueries({
            latest: [{ traineeId: 't1', kind: 'period' }],
            totals: [{ traineeId: 't1', _max: { endDate: day('2026-10-10') }, _sum: { programCount: null } }],
        })

        const overview = await getTrainerSubscriptionOverview('trainer-1', TODAY)

        expect(prismaMock.trainerTrainee.findMany).toHaveBeenCalledWith({
            where: { trainerId: 'trainer-1', trainee: { isActive: true } },
            select: { trainee: { select: { id: true, firstName: true, lastName: true } } },
        })
        expect(overview.withSubscription.map((item) => item.traineeId)).toEqual(['t1'])
        expect(overview.withoutSubscription.map((item) => item.traineeId)).toEqual(['t2'])
        expect(overview.counts.expiring).toBe(1)
    })
})
