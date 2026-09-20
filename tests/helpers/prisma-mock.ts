import { mockDeep, mockReset, type DeepMockProxy } from 'vitest-mock-extended'
import type { PrismaClient } from '@prisma/client'

export const prismaMock: DeepMockProxy<PrismaClient> = mockDeep<PrismaClient>()

/**
 * $transaction has two shapes in Prisma:
 *   - interactive: $transaction(async (tx) => ...)  -> run the callback against the same mock
 *   - batch:       $transaction([p1, p2])           -> resolve the array in order
 */
function installTransaction(): void {
    prismaMock.$transaction.mockImplementation(((arg: unknown) => {
        if (typeof arg === 'function') {
            return (arg as (tx: DeepMockProxy<PrismaClient>) => unknown)(prismaMock)
        }
        return Promise.all(arg as Promise<unknown>[])
    }) as never)
}

installTransaction()

/** Clears every recorded call and re-installs $transaction (mockReset wipes it). */
export function resetPrismaMock(): void {
    mockReset(prismaMock)
    installTransaction()
}
