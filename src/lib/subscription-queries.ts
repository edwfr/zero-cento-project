import { prisma } from '@/lib/prisma'
import { buildSubscriptionOverview, resolveSummary, type SubscriptionOverview, type SubscriptionSummary } from '@/lib/subscriptions'

/**
 * Server-only subscription queries. Kept apart from src/lib/subscriptions.ts so
 * client components can import the pure helpers without pulling in Prisma.
 */

/**
 * Current summary per trainee. Three aggregate queries whatever the number of
 * trainees: latest renewal (mode), totals (expiry + purchased programs), usages.
 * Trainees without renewals are absent from the map.
 */
export async function getCurrentSummaries(traineeIds: string[], today: Date): Promise<Map<string, SubscriptionSummary>> {
    if (traineeIds.length === 0) return new Map()

    const where = { traineeId: { in: traineeIds } }
    const [latest, totals, usages] = await Promise.all([
        prisma.subscriptionRenewal.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            distinct: ['traineeId'],
            select: { traineeId: true, kind: true },
        }),
        prisma.subscriptionRenewal.groupBy({
            by: ['traineeId'],
            where,
            _max: { endDate: true },
            _sum: { programCount: true },
        }),
        prisma.programCreditUsage.groupBy({ by: ['traineeId'], where, _count: { _all: true } }),
    ])

    const totalsByTrainee = new Map(totals.map((row) => [row.traineeId, row]))
    const usedByTrainee = new Map(usages.map((row) => [row.traineeId, row._count._all]))

    const summaries = new Map<string, SubscriptionSummary>()
    for (const { traineeId, kind } of latest) {
        const total = totalsByTrainee.get(traineeId)
        const summary = resolveSummary(
            {
                mode: kind,
                endDate: total?._max.endDate ?? null,
                purchased: total?._sum.programCount ?? 0,
                used: usedByTrainee.get(traineeId) ?? 0,
            },
            today
        )
        if (summary) summaries.set(traineeId, summary)
    }
    return summaries
}

/** Subscriptions page and home alerts: the logged-in trainer's active trainees only. */
export async function getTrainerSubscriptionOverview(trainerId: string, today: Date): Promise<SubscriptionOverview> {
    const links = await prisma.trainerTrainee.findMany({
        where: { trainerId, trainee: { isActive: true } },
        select: { trainee: { select: { id: true, firstName: true, lastName: true } } },
    })
    const trainees = links.map((link) => link.trainee)
    const summaries = await getCurrentSummaries(trainees.map((trainee) => trainee.id), today)
    return buildSubscriptionOverview(trainees, summaries)
}
