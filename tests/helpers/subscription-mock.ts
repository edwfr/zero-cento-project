import type { Mock } from 'vitest'
import { prismaMock } from './prisma-mock'

interface SummaryQueryRows {
    /** one row per trainee: the kind of the latest registered renewal */
    latest?: { traineeId: string; kind: 'period' | 'programs' }[]
    totals?: { traineeId: string; _max: { endDate: Date | null }; _sum: { programCount: number | null } }[]
    usages?: { traineeId: string; _count: { _all: number } }[]
}

/** Arranges the three aggregate queries behind getCurrentSummaries(). */
export function mockSummaryQueries({ latest = [], totals = [], usages = [] }: SummaryQueryRows = {}): void {
    prismaMock.subscriptionRenewal.findMany.mockResolvedValue(latest as never)
    // Prisma's groupBy generics defeat the deep mock's typing: treat them as plain mocks
    ;(prismaMock.subscriptionRenewal.groupBy as unknown as Mock).mockResolvedValue(totals)
    ;(prismaMock.programCreditUsage.groupBy as unknown as Mock).mockResolvedValue(usages)
}
