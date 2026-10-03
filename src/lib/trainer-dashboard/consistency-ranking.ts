import { prisma } from '@/lib/prisma'
import { CONSISTENCY_WEEKS, LIST_LIMITS } from './constants'
import { addDays, startOfUtcDay, utcDayKey, wholeDaysBetween } from './dates'
import { SESSION_FEEDBACK_SELECT, feedbackOfTrainerPrograms, groupSessions } from './sessions'
import { activeTraineeIds, fullName, type DashboardTrainee } from './trainees'

export interface ConsistencyItem {
    traineeId: string
    traineeName: string
    sessions: number
    expected: number
    /** 0..1, capped */
    adherence: number
}

export async function getConsistencyRanking(
    trainerId: string,
    trainees: DashboardTrainee[],
    now: Date,
): Promise<ConsistencyItem[]> {
    const today = startOfUtcDay(now)
    const windowStart = addDays(today, -(7 * CONSISTENCY_WEEKS - 1))
    const activeIds = new Set(activeTraineeIds(trainees))

    const programs = await prisma.trainingProgram.findMany({
        where: { trainerId, status: 'active', startDate: { lte: now } },
        select: { traineeId: true, startDate: true, workoutsPerWeek: true },
        orderBy: { startDate: 'desc' },
    })

    // newest first: the first program seen per trainee is the current one
    const current = new Map<string, { startDate: Date; workoutsPerWeek: number }>()
    for (const program of programs) {
        if (!program.startDate || !activeIds.has(program.traineeId) || current.has(program.traineeId)) continue
        current.set(program.traineeId, { startDate: program.startDate, workoutsPerWeek: program.workoutsPerWeek })
    }
    if (current.size === 0) return []

    const rows = await prisma.exerciseFeedback.findMany({
        where: { traineeId: { in: [...current.keys()] }, date: { gte: windowStart }, ...feedbackOfTrainerPrograms(trainerId) },
        select: SESSION_FEEDBACK_SELECT,
    })
    const sessions = groupSessions(rows)
    const byId = new Map(trainees.map((trainee) => [trainee.id, trainee]))

    const items: ConsistencyItem[] = [...current.entries()].map(([traineeId, program]) => {
        const programStart = startOfUtcDay(program.startDate)
        const from = programStart > windowStart ? programStart : windowStart
        const elapsedWeeks = Math.min(
            CONSISTENCY_WEEKS,
            Math.max(1, Math.ceil((wholeDaysBetween(from, today) + 1) / 7)),
        )
        const expected = program.workoutsPerWeek * elapsedWeeks
        const fromKey = utcDayKey(from)
        // distinct workouts: a workout split over several days, or repeated, counts once
        const done = new Set(
            sessions
                .filter((session) => session.traineeId === traineeId && session.day >= fromKey)
                .map((session) => session.workoutId),
        ).size
        const trainee = byId.get(traineeId)

        return {
            traineeId,
            traineeName: trainee ? fullName(trainee) : '',
            sessions: done,
            expected,
            adherence: expected > 0 ? Math.min(1, done / expected) : 0,
        }
    })

    return items
        .sort(
            (left, right) =>
                right.adherence - left.adherence ||
                right.sessions - left.sessions ||
                left.traineeName.localeCompare(right.traineeName),
        )
        .slice(0, LIST_LIMITS.ranking)
}
