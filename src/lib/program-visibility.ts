import type { Prisma } from '@prisma/client'
import type { ProgramStatus } from '@/lib/program-status'

/**
 * A published (active) program reaches the trainee only from its start date on.
 * Before that it stays invisible to them; trainers and admins always see it.
 *
 * startDate is stored as UTC midnight of the chosen calendar day (publish route),
 * so "today" is the Rome calendar day expressed the same way.
 */
const PROGRAM_TIME_ZONE = 'Europe/Rome'

export function todayInRome(now: Date = new Date()): Date {
    // en-CA formats as YYYY-MM-DD
    const day = new Intl.DateTimeFormat('en-CA', {
        timeZone: PROGRAM_TIME_ZONE,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).format(now)
    return new Date(`${day}T00:00:00Z`)
}

export function isProgramVisibleToTrainee(
    program: { status: ProgramStatus; startDate: Date | null },
    now: Date = new Date()
): boolean {
    if (program.status !== 'active' || !program.startDate) return true
    return program.startDate.getTime() <= todayInRome(now).getTime()
}

/** Prisma filter equivalent of isProgramVisibleToTrainee. */
export function traineeVisibleProgramWhere(now: Date = new Date()): Prisma.TrainingProgramWhereInput {
    return {
        OR: [
            { status: { not: 'active' } },
            { startDate: null },
            { startDate: { lte: todayInRome(now) } },
        ],
    }
}
