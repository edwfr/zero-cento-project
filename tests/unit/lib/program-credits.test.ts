import { describe, it, expect } from 'vitest'
import { consumeCreditOnPublish } from '@/lib/program-credits'
import { prismaMock } from '../../helpers/prisma-mock'

const INPUT = { traineeId: 't1', programId: 'prog-1', programTitle: 'Forza A', actorId: 'trainer-1' }

describe('consumeCreditOnPublish', () => {
    it('consumes a credit and logs it when the latest renewal is a package', async () => {
        prismaMock.subscriptionRenewal.findFirst.mockResolvedValue({ kind: 'programs' } as never)

        await expect(consumeCreditOnPublish(prismaMock, INPUT)).resolves.toBe(true)

        expect(prismaMock.subscriptionRenewal.findFirst).toHaveBeenCalledWith({
            where: { traineeId: 't1' },
            orderBy: { createdAt: 'desc' },
            select: { kind: true },
        })
        expect(prismaMock.programCreditUsage.create).toHaveBeenCalledWith({
            data: { traineeId: 't1', programId: 'prog-1', createdBy: 'trainer-1' },
        })
        expect(prismaMock.subscriptionEvent.create).toHaveBeenCalledWith({
            data: expect.objectContaining({
                traineeId: 't1',
                type: 'credit_consumed',
                creditDelta: -1,
                programId: 'prog-1',
                actorId: 'trainer-1',
                details: { programTitle: 'Forza A' },
            }),
        })
    })

    it('does nothing when the latest renewal is a period, even with leftover packages', async () => {
        prismaMock.subscriptionRenewal.findFirst.mockResolvedValue({ kind: 'period' } as never)

        await expect(consumeCreditOnPublish(prismaMock, INPUT)).resolves.toBe(false)

        expect(prismaMock.programCreditUsage.create).not.toHaveBeenCalled()
        expect(prismaMock.subscriptionEvent.create).not.toHaveBeenCalled()
    })

    it('does nothing for a trainee without renewals', async () => {
        prismaMock.subscriptionRenewal.findFirst.mockResolvedValue(null)

        await expect(consumeCreditOnPublish(prismaMock, INPUT)).resolves.toBe(false)

        expect(prismaMock.programCreditUsage.create).not.toHaveBeenCalled()
    })

    it('never checks the balance: a trainee at zero still consumes', async () => {
        prismaMock.subscriptionRenewal.findFirst.mockResolvedValue({ kind: 'programs' } as never)

        await consumeCreditOnPublish(prismaMock, INPUT)

        expect(prismaMock.programCreditUsage.count).not.toHaveBeenCalled()
        expect(prismaMock.programCreditUsage.create).toHaveBeenCalledTimes(1)
    })
})
