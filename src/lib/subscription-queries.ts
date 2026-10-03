import { prisma } from '@/lib/prisma'
import { buildSubscriptionOverview, type SubscriptionOverview } from '@/lib/subscriptions'

/**
 * Server-only subscription queries. Kept apart from src/lib/subscriptions.ts so
 * client components can import the pure helpers without pulling in Prisma.
 */

/** Current expiry (MAX endDate) per trainee, in one aggregate query. */
export async function getCurrentEndDates(traineeIds: string[]): Promise<Map<string, Date>> {
    if (traineeIds.length === 0) return new Map()

    const rows = await prisma.subscriptionRenewal.groupBy({
        by: ['traineeId'],
        where: { traineeId: { in: traineeIds } },
        _max: { endDate: true },
    })

    const endDates = new Map<string, Date>()
    for (const row of rows) {
        if (row._max.endDate) endDates.set(row.traineeId, row._max.endDate)
    }
    return endDates
}

/** Subscriptions page and home KPI: the logged-in trainer's active trainees only. */
export async function getTrainerSubscriptionOverview(trainerId: string, today: Date): Promise<SubscriptionOverview> {
    const links = await prisma.trainerTrainee.findMany({
        where: { trainerId, trainee: { isActive: true } },
        select: { trainee: { select: { id: true, firstName: true, lastName: true } } },
    })
    const trainees = links.map((link) => link.trainee)
    const endDates = await getCurrentEndDates(trainees.map((trainee) => trainee.id))
    return buildSubscriptionOverview(trainees, endDates, today)
}
