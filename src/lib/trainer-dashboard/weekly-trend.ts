import { prisma } from '@/lib/prisma'
import { TREND_WEEKS } from './constants'
import { DAY_MS, addDays, startOfUtcDay, startOfUtcWeek, utcDayKey } from './dates'
import { SESSION_FEEDBACK_SELECT, groupSessions } from './sessions'
import { activeTraineeIds, type DashboardTrainee } from './trainees'

export interface TrendWeek {
    /** Monday of the week, YYYY-MM-DD */
    weekStart: string
    sessions: number
    volumeKg: number
}

const WEEK_MS = 7 * DAY_MS

export async function getWeeklyTrend(trainees: DashboardTrainee[], now: Date): Promise<TrendWeek[]> {
    const firstWeek = addDays(startOfUtcWeek(now), -7 * (TREND_WEEKS - 1))
    const weeks: TrendWeek[] = Array.from({ length: TREND_WEEKS }, (_, index) => ({
        weekStart: utcDayKey(addDays(firstWeek, 7 * index)),
        sessions: 0,
        volumeKg: 0,
    }))

    const traineeIds = activeTraineeIds(trainees)
    if (traineeIds.length === 0) return weeks

    const rows = await prisma.exerciseFeedback.findMany({
        where: { traineeId: { in: traineeIds }, date: { gte: firstWeek } },
        select: {
            ...SESSION_FEEDBACK_SELECT,
            setsPerformed: { where: { completed: true }, select: { reps: true, weight: true } },
        },
    })

    const weekIndex = (date: Date) => Math.floor((startOfUtcDay(date).getTime() - firstWeek.getTime()) / WEEK_MS)
    const bucket = (date: Date) => weeks[weekIndex(date)] as TrendWeek | undefined

    for (const row of rows) {
        const week = bucket(row.date)
        if (week) week.volumeKg += row.setsPerformed.reduce((sum, set) => sum + set.reps * set.weight, 0)
    }
    for (const session of groupSessions(rows)) {
        const week = bucket(new Date(`${session.day}T00:00:00.000Z`))
        if (week) week.sessions += 1
    }

    return weeks.map((week) => ({ ...week, volumeKg: Math.round(week.volumeKg) }))
}
