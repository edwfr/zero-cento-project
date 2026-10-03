import { prisma } from '@/lib/prisma'
import { HIGH_RPE_THRESHOLD, LIST_LIMITS } from './constants'
import { recentWindowStart } from './dates'
import { activeTraineeIds, fullName, type DashboardTrainee } from './trainees'

export interface RecentFeedbackItem {
    id: string
    traineeName: string
    exerciseName: string
    programId: string
    /** Highest RPE among the feedback and its sets */
    rpe: number | null
    isHighRpe: boolean
    note: string | null
    loggedAt: Date
}

export async function getRecentFeedback(trainees: DashboardTrainee[], now: Date): Promise<RecentFeedbackItem[]> {
    const traineeIds = activeTraineeIds(trainees)
    if (traineeIds.length === 0) return []

    const rows = await prisma.exerciseFeedback.findMany({
        where: {
            traineeId: { in: traineeIds },
            date: { gte: recentWindowStart(now) },
            OR: [
                { notes: { not: null } },
                { actualRpe: { gte: HIGH_RPE_THRESHOLD } },
                { setsPerformed: { some: { actualRpe: { gte: HIGH_RPE_THRESHOLD } } } },
            ],
        },
        orderBy: { createdAt: 'desc' },
        // headroom for blank notes, which can only be filtered after loading
        take: LIST_LIMITS.feedback * 2,
        select: {
            id: true,
            notes: true,
            actualRpe: true,
            createdAt: true,
            trainee: { select: { firstName: true, lastName: true } },
            setsPerformed: { select: { actualRpe: true } },
            workoutExercise: {
                select: {
                    exercise: { select: { name: true } },
                    workout: { select: { week: { select: { programId: true } } } },
                },
            },
        },
    })

    return rows
        .map((row) => {
            const rpeValues = [row.actualRpe, ...row.setsPerformed.map((set) => set.actualRpe)].filter(
                (value): value is number => value !== null,
            )
            const rpe = rpeValues.length > 0 ? Math.max(...rpeValues) : null

            return {
                id: row.id,
                traineeName: fullName(row.trainee),
                exerciseName: row.workoutExercise.exercise.name,
                programId: row.workoutExercise.workout.week.programId,
                rpe,
                isHighRpe: rpe !== null && rpe >= HIGH_RPE_THRESHOLD,
                note: row.notes?.trim() || null,
                loggedAt: row.createdAt,
            }
        })
        .filter((item) => item.note !== null || item.isHighRpe)
        .slice(0, LIST_LIMITS.feedback)
}
