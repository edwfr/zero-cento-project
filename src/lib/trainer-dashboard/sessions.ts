import { utcDayKey } from './dates'

/**
 * A session is one (trainee, workout, calendar day) in ExerciseFeedback.
 * WorkoutExercise.isCompleted has no timestamp, so feedback is the reliable
 * record of when training happened: `date` gives the day, `createdAt` the time.
 */
export const SESSION_FEEDBACK_SELECT = {
    traineeId: true,
    date: true,
    createdAt: true,
    workoutExercise: { select: { workoutId: true } },
} as const

/**
 * Feedback filter for workouts of programs this trainer owns. A reassigned trainee
 * keeps programs (and their feedback) under the previous trainer: neither trainer
 * should see the other's.
 */
export function feedbackOfTrainerPrograms(trainerId: string) {
    return { workoutExercise: { workout: { week: { program: { trainerId } } } } }
}

export interface SessionSourceRow {
    traineeId: string
    date: Date
    createdAt: Date
    workoutExercise: { workoutId: string }
}

export interface TrainingSession {
    key: string
    traineeId: string
    workoutId: string
    /** YYYY-MM-DD, from ExerciseFeedback.date */
    day: string
    lastLoggedAt: Date
    exerciseCount: number
}

export function groupSessions(rows: SessionSourceRow[]): TrainingSession[] {
    const sessions = new Map<string, TrainingSession>()

    for (const row of rows) {
        const day = utcDayKey(row.date)
        const workoutId = row.workoutExercise.workoutId
        const key = `${row.traineeId}|${workoutId}|${day}`
        const existing = sessions.get(key)

        if (existing) {
            existing.exerciseCount += 1
            if (row.createdAt > existing.lastLoggedAt) existing.lastLoggedAt = row.createdAt
        } else {
            sessions.set(key, {
                key,
                traineeId: row.traineeId,
                workoutId,
                day,
                lastLoggedAt: row.createdAt,
                exerciseCount: 1,
            })
        }
    }

    return [...sessions.values()].sort((left, right) => right.lastLoggedAt.getTime() - left.lastLoggedAt.getTime())
}

export function countSessionsBetween(sessions: TrainingSession[], from: Date, to: Date): number {
    const fromKey = utcDayKey(from)
    const toKey = utcDayKey(to)
    return sessions.filter((session) => session.day >= fromKey && session.day < toKey).length
}
