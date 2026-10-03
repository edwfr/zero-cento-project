import { prisma } from '@/lib/prisma'
import { addDays, recentWindowStart, startOfUtcWeek } from './dates'
import { SESSION_FEEDBACK_SELECT, countSessionsBetween, groupSessions } from './sessions'
import { activeTraineeIds, type DashboardTrainee } from './trainees'

export interface HeaderKpis {
    activeTrainees: number
    totalTrainees: number
    activePrograms: number
    sessionsThisWeek: number
    sessionsLastWeek: number
}

export async function getHeaderKpis(trainerId: string, trainees: DashboardTrainee[], now: Date): Promise<HeaderKpis> {
    const traineeIds = activeTraineeIds(trainees)
    const weekStart = startOfUtcWeek(now)
    const lastWeekStart = addDays(weekStart, -7)
    const activeSince = recentWindowStart(now)

    // lastWeekStart is always on or before activeSince, so one feedback query covers both KPIs
    const [activePrograms, rows] = await Promise.all([
        prisma.trainingProgram.count({ where: { trainerId, status: 'active' } }),
        traineeIds.length === 0
            ? Promise.resolve([])
            : prisma.exerciseFeedback.findMany({
                where: { traineeId: { in: traineeIds }, date: { gte: lastWeekStart } },
                select: SESSION_FEEDBACK_SELECT,
            }),
    ])

    const sessions = groupSessions(rows)
    const activeTrainees = new Set(rows.filter((row) => row.date >= activeSince).map((row) => row.traineeId)).size

    return {
        activeTrainees,
        totalTrainees: traineeIds.length,
        activePrograms,
        sessionsThisWeek: countSessionsBetween(sessions, weekStart, addDays(weekStart, 7)),
        sessionsLastWeek: countSessionsBetween(sessions, lastWeekStart, weekStart),
    }
}
