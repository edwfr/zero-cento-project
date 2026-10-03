import { prisma } from '@/lib/prisma'
import { LIST_LIMITS } from './constants'
import { recentWindowStart, startOfUtcDay, wholeDaysBetween } from './dates'
import { activeTraineeIds, fullName, initials, type DashboardTrainee } from './trainees'

export interface InactiveTrainee {
    traineeId: string
    traineeName: string
    initials: string
    /** null when the trainee never logged a session */
    daysSinceLastSession: number | null
}

export interface InactiveTraineesResult {
    items: InactiveTrainee[]
    total: number
}

const EMPTY: InactiveTraineesResult = { items: [], total: 0 }

export async function getInactiveTrainees(trainees: DashboardTrainee[], now: Date): Promise<InactiveTraineesResult> {
    const traineeIds = activeTraineeIds(trainees)
    if (traineeIds.length === 0) return EMPTY

    const programs = await prisma.trainingProgram.findMany({
        where: { traineeId: { in: traineeIds }, status: 'active' },
        select: { traineeId: true },
        distinct: ['traineeId'],
    })
    const withProgram = programs.map((program) => program.traineeId)
    if (withProgram.length === 0) return EMPTY

    const lastSessions = await prisma.exerciseFeedback.groupBy({
        by: ['traineeId'],
        where: { traineeId: { in: withProgram } },
        _max: { date: true },
    })

    const lastByTrainee = new Map(lastSessions.map((row) => [row.traineeId, row._max.date]))
    const byId = new Map(trainees.map((trainee) => [trainee.id, trainee]))
    const today = startOfUtcDay(now)
    const since = recentWindowStart(now)

    const inactive: InactiveTrainee[] = []
    for (const traineeId of withProgram) {
        const last = lastByTrainee.get(traineeId) ?? null
        const trainee = byId.get(traineeId)
        if (!trainee || (last && last >= since)) continue

        inactive.push({
            traineeId,
            traineeName: fullName(trainee),
            initials: initials(trainee),
            daysSinceLastSession: last ? wholeDaysBetween(last, today) : null,
        })
    }

    // never-trained first, then the longest silence; NaN (Infinity − Infinity) falls through to the name
    inactive.sort(
        (left, right) =>
            (right.daysSinceLastSession ?? Infinity) - (left.daysSinceLastSession ?? Infinity) ||
            left.traineeName.localeCompare(right.traineeName),
    )

    return { items: inactive.slice(0, LIST_LIMITS.inactive), total: inactive.length }
}
