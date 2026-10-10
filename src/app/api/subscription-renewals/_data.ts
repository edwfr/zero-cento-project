import type { Prisma, RenewalKind } from '@prisma/client'
import { addMonthsClamped } from '@/lib/subscriptions'
import type { UpdateRenewalInput } from '@/schemas/subscription-renewal'

/** The columns a renewal row stores, of either kind. */
export interface RenewalColumns {
    kind: RenewalKind
    startDate: Date
    durationMonths: number | null
    endDate: Date | null
    programCount: number | null
}

/** Validated input → stored columns. endDate is computed here, never accepted from the client. */
export function toRenewalColumns(input: UpdateRenewalInput): RenewalColumns {
    if (input.kind === 'programs') {
        return { kind: 'programs', startDate: input.startDate, durationMonths: null, endDate: null, programCount: input.programCount }
    }
    return {
        kind: 'period',
        startDate: input.startDate,
        durationMonths: input.durationMonths,
        endDate: addMonthsClamped(input.startDate, input.durationMonths),
        programCount: null,
    }
}

const isoDay = (date: Date | null) => (date ? date.toISOString().slice(0, 10) : null)

/** What the history keeps of a renewal: it must stay readable after the row is gone. */
export function renewalSnapshot(row: RenewalColumns): Prisma.InputJsonObject {
    if (row.kind === 'programs') return { purchaseDate: isoDay(row.startDate), programCount: row.programCount }
    return { startDate: isoDay(row.startDate), durationMonths: row.durationMonths, endDate: isoDay(row.endDate) }
}
