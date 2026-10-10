import { describe, it, expect } from 'vitest'
import { EVENT_HISTORY_LIMIT, listSubscriptionEvents, logSubscriptionEvent } from '@/lib/subscription-events'
import { prismaMock } from '../../helpers/prisma-mock'

describe('logSubscriptionEvent', () => {
    it('writes the event through the given transaction client', async () => {
        await logSubscriptionEvent(prismaMock, {
            traineeId: 't1',
            type: 'credit_consumed',
            actorId: 'trainer-1',
            programId: 'prog-1',
            creditDelta: -1,
            details: { programTitle: 'Forza A' },
        })

        expect(prismaMock.subscriptionEvent.create).toHaveBeenCalledWith({
            data: {
                traineeId: 't1',
                type: 'credit_consumed',
                actorId: 'trainer-1',
                creditDelta: -1,
                renewalId: null,
                programId: 'prog-1',
                details: { programTitle: 'Forza A' },
            },
        })
    })
})

describe('listSubscriptionEvents', () => {
    it('returns the newest events with the actor name, capped', async () => {
        prismaMock.subscriptionEvent.findMany.mockResolvedValue([
            {
                id: 'e1',
                type: 'package_created',
                creditDelta: 5,
                details: { purchaseDate: '2026-10-01', programCount: 5 },
                createdAt: new Date('2026-10-01T10:00:00.000Z'),
                actor: { firstName: 'Marco', lastName: 'Trainer' },
            },
        ] as never)

        const events = await listSubscriptionEvents('t1')

        expect(prismaMock.subscriptionEvent.findMany).toHaveBeenCalledWith({
            where: { traineeId: 't1' },
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
        expect(events).toEqual([
            {
                id: 'e1',
                type: 'package_created',
                creditDelta: 5,
                details: { purchaseDate: '2026-10-01', programCount: 5 },
                createdAt: new Date('2026-10-01T10:00:00.000Z'),
                actorName: 'Marco Trainer',
            },
        ])
    })
})
