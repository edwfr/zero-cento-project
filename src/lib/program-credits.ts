import type { Prisma } from '@prisma/client'
import { logSubscriptionEvent } from '@/lib/subscription-events'

/**
 * Program credits: a trainee on packages spends one program per publish.
 * Every function takes the transaction client of the mutation it belongs to,
 * so the ledger row, the history row and the program change commit together.
 */

export interface PublishCreditInput {
    traineeId: string
    programId: string
    programTitle: string
    actorId: string
}

/**
 * Consumes one credit when the trainee is currently on packages (latest
 * registered renewal). The balance is deliberately not checked: publishing is
 * never blocked, a trainee at zero goes into debt.
 */
export async function consumeCreditOnPublish(tx: Prisma.TransactionClient, input: PublishCreditInput): Promise<boolean> {
    const latest = await tx.subscriptionRenewal.findFirst({
        where: { traineeId: input.traineeId },
        orderBy: { createdAt: 'desc' },
        select: { kind: true },
    })
    if (latest?.kind !== 'programs') return false

    await tx.programCreditUsage.create({
        data: { traineeId: input.traineeId, programId: input.programId, createdBy: input.actorId },
    })
    await logSubscriptionEvent(tx, {
        traineeId: input.traineeId,
        type: 'credit_consumed',
        actorId: input.actorId,
        programId: input.programId,
        creditDelta: -1,
        details: { programTitle: input.programTitle },
    })
    return true
}
