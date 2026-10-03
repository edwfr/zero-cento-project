import { prisma } from '@/lib/prisma'
import { LIST_LIMITS } from './constants'
import { recentWindowStart, utcDayKey } from './dates'
import { SESSION_FEEDBACK_SELECT, feedbackOfTrainerPrograms, groupSessions } from './sessions'
import { activeTraineeIds, fullName, initials, type DashboardTrainee } from './trainees'

export interface ActivityItem {
    key: string
    traineeId: string
    traineeName: string
    initials: string
    programId: string
    weekNumber: number
    dayIndex: number
    exerciseCount: number
    lastLoggedAt: Date
    day: string
    hasRecord: boolean
}

export async function getActivityFeed(
    trainerId: string,
    trainees: DashboardTrainee[],
    now: Date,
): Promise<ActivityItem[]> {
    const traineeIds = activeTraineeIds(trainees)
    if (traineeIds.length === 0) return []

    const since = recentWindowStart(now)
    const [rows, records] = await Promise.all([
        prisma.exerciseFeedback.findMany({
            where: { traineeId: { in: traineeIds }, date: { gte: since }, ...feedbackOfTrainerPrograms(trainerId) },
            select: {
                ...SESSION_FEEDBACK_SELECT,
                workoutExercise: {
                    select: {
                        workoutId: true,
                        workout: { select: { dayIndex: true, week: { select: { weekNumber: true, programId: true } } } },
                    },
                },
            },
        }),
        prisma.personalRecord.findMany({
            where: { traineeId: { in: traineeIds }, recordDate: { gte: since } },
            select: { traineeId: true, recordDate: true },
        }),
    ])

    const workouts = new Map(rows.map((row) => [row.workoutExercise.workoutId, row.workoutExercise.workout]))
    const recordDays = new Set(records.map((record) => `${record.traineeId}|${utcDayKey(record.recordDate)}`))
    const byId = new Map(trainees.map((trainee) => [trainee.id, trainee]))

    return groupSessions(rows)
        .slice(0, LIST_LIMITS.feed)
        .flatMap((session) => {
            const workout = workouts.get(session.workoutId)
            const trainee = byId.get(session.traineeId)
            if (!workout || !trainee) return []

            return [{
                key: session.key,
                traineeId: session.traineeId,
                traineeName: fullName(trainee),
                initials: initials(trainee),
                programId: workout.week.programId,
                weekNumber: workout.week.weekNumber,
                dayIndex: workout.dayIndex,
                exerciseCount: session.exerciseCount,
                lastLoggedAt: session.lastLoggedAt,
                day: session.day,
                hasRecord: recordDays.has(`${session.traineeId}|${session.day}`),
            }]
        })
}
