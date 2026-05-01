import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/lib/api-response'
import { requireRole } from '@/lib/auth'
import { logger } from '@/lib/logger'
import { computeExerciseStatus } from '@/lib/workout-recap'
import type { ExerciseRecapItem } from '@/lib/workout-recap'

interface RecapRow {
    id: string
    exerciseName: string
    order: number
    targetSets: number
    completedSets: number
    totalSetsPerformed: number
}

export async function GET(
    _request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id: workoutId } = await params

    try {
        const session = await requireRole(['trainee'])

        const rows = await prisma.$queryRaw<RecapRow[]>`
            SELECT
                we.id,
                e.name                                                           AS "exerciseName",
                we.order                                                         AS "order",
                we.sets                                                          AS "targetSets",
                COALESCE(SUM(CASE WHEN sp.completed THEN 1 ELSE 0 END), 0)::int AS "completedSets",
                COUNT(sp.id)::int                                                AS "totalSetsPerformed"
            FROM workout_exercises we
            JOIN workouts w ON w.id = we."workoutId"
            JOIN weeks wk ON wk.id = w."weekId"
            JOIN training_programs tp ON tp.id = wk."programId"
            JOIN exercises e ON e.id = we."exerciseId"
            LEFT JOIN exercise_feedbacks ef ON ef."workoutExerciseId" = we.id
            LEFT JOIN sets_performed sp ON sp."feedbackId" = ef.id
            WHERE we."workoutId" = ${workoutId}
              AND tp."traineeId" = ${session.user.id}
            GROUP BY we.id, e.name, we.order, we.sets
            ORDER BY we.order
        `

        if (rows.length === 0) {
            return apiError('NOT_FOUND', 'Workout not found', 404, undefined, 'workout.notFound')
        }

        const exercises: ExerciseRecapItem[] = rows.map((row) => ({
            id: row.id,
            exerciseName: row.exerciseName,
            order: row.order,
            targetSets: row.targetSets,
            completedSets: row.completedSets,
            status: computeExerciseStatus(row.totalSetsPerformed, row.completedSets, row.targetSets),
        }))

        return apiSuccess({ exercises })
    } catch (error: unknown) {
        if (error instanceof Response) return error
        logger.error({ error, workoutId }, 'Error fetching workout recap')
        return apiError('INTERNAL_ERROR', 'Failed to fetch workout recap', 500, undefined, 'internal.default')
    }
}