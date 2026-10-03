import { describe, it, expect, beforeEach, vi } from 'vitest'
import { prismaMock } from '../../helpers/prisma-mock'
import { findPendingActivationIds } from '@/lib/user-status-events'

describe('findPendingActivationIds', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('returns the users without an activated event', async () => {
        prismaMock.userStatusEvent.findMany.mockResolvedValue([{ userId: 'u-2' }] as never)

        const result = await findPendingActivationIds(['u-1', 'u-2', 'u-3'])

        expect(result).toEqual(new Set(['u-1', 'u-3']))
        expect(prismaMock.userStatusEvent.findMany).toHaveBeenCalledWith({
            where: { userId: { in: ['u-1', 'u-2', 'u-3'] }, type: 'activated' },
            select: { userId: true },
            distinct: ['userId'],
        })
    })

    it('skips the query when there are no inactive users', async () => {
        const result = await findPendingActivationIds([])

        expect(result).toEqual(new Set())
        expect(prismaMock.userStatusEvent.findMany).not.toHaveBeenCalled()
    })
})
