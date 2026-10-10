import type { Prisma, SubscriptionEventType } from '@prisma/client'
import { prisma } from '@/lib/prisma'

/**
 * Append-only history of renewals and program-credit movements, shown to the
 * trainer. Written inside the transaction of the mutation it describes; never
 * updated, never read to compute a balance.
 */

export const EVENT_HISTORY_LIMIT = 100

export interface SubscriptionEventInput {
    traineeId: string
    type: SubscriptionEventType
    actorId: string
    /** +N package, -1 consumed, +1 refunded, signed difference on a package edit/delete */
    creditDelta?: number | null
    renewalId?: string
    programId?: string
    /** Snapshot: the row survives the renewal or program it describes */
    details: Prisma.InputJsonObject
}

export async function logSubscriptionEvent(tx: Prisma.TransactionClient, event: SubscriptionEventInput): Promise<void> {
    await tx.subscriptionEvent.create({
        data: {
            traineeId: event.traineeId,
            type: event.type,
            actorId: event.actorId,
            creditDelta: event.creditDelta ?? null,
            renewalId: event.renewalId ?? null,
            programId: event.programId ?? null,
            details: event.details,
        },
    })
}

export async function listSubscriptionEvents(traineeId: string) {
    const rows = await prisma.subscriptionEvent.findMany({
        where: { traineeId },
        orderBy: { createdAt: 'desc' },
        take: EVENT_HISTORY_LIMIT,
        select: {
            id: true,
            type: true,
            creditDelta: true,
            details: true,
            createdAt: true,
            actor: { select: { firstName: true, lastName: true } },
        },
    })

    return rows.map(({ actor, ...event }) => ({ ...event, actorName: `${actor.firstName} ${actor.lastName}` }))
}
