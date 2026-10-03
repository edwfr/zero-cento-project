import { prisma } from '@/lib/prisma'
import { KPI_MONTH_DAYS } from './constants'
import { addDays, recentWindowStart, startOfUtcDay, startOfUtcWeek } from './dates'
import { SESSION_FEEDBACK_SELECT, countSessionsBetween, feedbackOfTrainerPrograms, groupSessions } from './sessions'
import { activeTraineeIds, type DashboardTrainee } from './trainees'

export interface HeaderKpis {
    activeTrainees: number
    /** Same 7-day measure, KPI_MONTH_DAYS ago */
    activeTraineesMonthAgo: number
    totalTrainees: number
    activePrograms: number
    /** Programs published by then and not yet completed, KPI_MONTH_DAYS ago */
    activeProgramsMonthAgo: number
    sessionsThisWeek: number
    sessionsLastWeek: number
    /** The exercise library is shared by every trainer */
    libraryExercises: number
    /** Exercises already created KPI_MONTH_DAYS ago */
    libraryExercisesMonthAgo: number
    confirmedSetsThisWeek: number
    confirmedSetsLastWeek: number
}

export async function getHeaderKpis(trainerId: string, trainees: DashboardTrainee[], now: Date): Promise<HeaderKpis> {
    const traineeIds = activeTraineeIds(trainees)
    const monthAgo = addDays(now, -KPI_MONTH_DAYS)
    const countLibrary = () =>
        Promise.all([prisma.exercise.count(), prisma.exercise.count({ where: { createdAt: { lte: monthAgo } } })])

    if (traineeIds.length === 0) {
        const [libraryExercises, libraryExercisesMonthAgo] = await countLibrary()
        return {
            activeTrainees: 0,
            activeTraineesMonthAgo: 0,
            totalTrainees: 0,
            activePrograms: 0,
            activeProgramsMonthAgo: 0,
            sessionsThisWeek: 0,
            sessionsLastWeek: 0,
            libraryExercises,
            libraryExercisesMonthAgo,
            confirmedSetsThisWeek: 0,
            confirmedSetsLastWeek: 0,
        }
    }

    const weekStart = startOfUtcWeek(now)
    const lastWeekStart = addDays(weekStart, -7)
    const nextWeekStart = addDays(weekStart, 7)
    const activeSince = recentWindowStart(now)
    const monthAgoDay = startOfUtcDay(monthAgo)

    const confirmedSetsBetween = (from: Date, to: Date) =>
        prisma.setPerformed.count({
            where: {
                completed: true,
                feedback: { traineeId: { in: traineeIds }, date: { gte: from, lt: to }, ...feedbackOfTrainerPrograms(trainerId) },
            },
        })

    // lastWeekStart is always on or before activeSince, so one feedback query covers both KPIs
    const [
        activePrograms,
        activeProgramsMonthAgo,
        rows,
        traineesActiveMonthAgo,
        [libraryExercises, libraryExercisesMonthAgo],
        confirmedSetsThisWeek,
        confirmedSetsLastWeek,
    ] = await Promise.all([
        prisma.trainingProgram.count({ where: { trainerId, status: 'active', traineeId: { in: traineeIds } } }),
        prisma.trainingProgram.count({
            where: {
                trainerId,
                traineeId: { in: traineeIds },
                status: { in: ['active', 'completed'] },
                publishedAt: { lte: monthAgo },
                OR: [{ completedAt: null }, { completedAt: { gt: monthAgo } }],
            },
        }),
        prisma.exerciseFeedback.findMany({
            where: { traineeId: { in: traineeIds }, date: { gte: lastWeekStart }, ...feedbackOfTrainerPrograms(trainerId) },
            select: SESSION_FEEDBACK_SELECT,
        }),
        // the 7-day window as it was KPI_MONTH_DAYS ago
        prisma.exerciseFeedback.findMany({
            where: {
                traineeId: { in: traineeIds },
                date: { gte: recentWindowStart(monthAgo), lt: addDays(monthAgoDay, 1) },
                ...feedbackOfTrainerPrograms(trainerId),
            },
            select: { traineeId: true },
            distinct: ['traineeId'],
        }),
        countLibrary(),
        confirmedSetsBetween(weekStart, nextWeekStart),
        confirmedSetsBetween(lastWeekStart, weekStart),
    ])

    const sessions = groupSessions(rows)
    const activeTrainees = new Set(rows.filter((row) => row.date >= activeSince).map((row) => row.traineeId)).size

    return {
        activeTrainees,
        activeTraineesMonthAgo: traineesActiveMonthAgo.length,
        totalTrainees: traineeIds.length,
        activePrograms,
        activeProgramsMonthAgo,
        sessionsThisWeek: countSessionsBetween(sessions, weekStart, nextWeekStart),
        sessionsLastWeek: countSessionsBetween(sessions, lastWeekStart, weekStart),
        libraryExercises,
        libraryExercisesMonthAgo,
        confirmedSetsThisWeek,
        confirmedSetsLastWeek,
    }
}
