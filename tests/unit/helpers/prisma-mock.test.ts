import { describe, it, expect } from 'vitest'
import { prisma } from '@/lib/prisma'
import { prismaMock } from '../../helpers/prisma-mock'

describe('prisma mock helper', () => {
    it('is the instance returned by @/lib/prisma', () => {
        expect(prisma).toBe(prismaMock)
    })

    it('resolves any model call that the test configures', async () => {
        prismaMock.exercise.findMany.mockResolvedValue([{ id: 'ex-1' }] as never)
        await expect(prisma.exercise.findMany()).resolves.toEqual([{ id: 'ex-1' }])
    })

    it('runs $transaction callbacks against the same mock', async () => {
        prismaMock.exercise.create.mockResolvedValue({ id: 'ex-2' } as never)
        const result = await prisma.$transaction(async (tx) => tx.exercise.create({ data: {} as never }))
        expect(result).toEqual({ id: 'ex-2' })
    })

    it('resolves $transaction arrays', async () => {
        prismaMock.exercise.count.mockResolvedValue(3 as never)
        await expect(prisma.$transaction([prisma.exercise.count()])).resolves.toEqual([3])
    })

    it('starts each test without leftover calls', () => {
        expect(prismaMock.exercise.findMany).not.toHaveBeenCalled()
    })
})
