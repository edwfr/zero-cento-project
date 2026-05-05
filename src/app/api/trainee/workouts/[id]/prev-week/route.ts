import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/lib/api-response'
import { requireRole } from '@/lib/auth'
import { logger } from '@/lib/logger'
import type { PrevWeekExerciseItem } from '@/lib/workout-recap'

interface PrevWeekRow {
    weId: string
    exerciseName: string
    order: number
    targetSets: number
    targetReps: string
    setNumber: number | null
    setReps: number | null
    setWeight: number | null
    setCompleted: boolean | null
}

export async function GET(
    _request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id: workoutId } = await params

    try {
        const session = await requireRole(['trainee'])

        const rows = await prisma.$queryRaw<PrevWeekRow[]>`
            WITH source_workout AS (
                SELECT w."dayIndex", wk."weekNumber", wk."programId"
                FROM workouts w
                JOIN weeks wk ON wk.id = w."weekId"
                JOIN training_programs tp ON tp.id = wk."programId"
                WHERE w.id = ${workoutId}
                  AND tp."traineeId" = ${session.user.id}
            ),
            prev_workout AS (
                SELECT w.id
                FROM workouts w
                JOIN weeks wk ON wk.id = w."weekId"
                JOIN source_workout sw ON wk."programId" = sw."programId"
                    AND w."dayIndex" = sw."dayIndex"
                    AND wk."weekNumber" = sw."weekNumber" - 1
                LIMIT 1
            )
            SELECT
                we.id                       AS "weId",
                e.name                      AS "exerciseName",
                we.order                    AS "order",
                we.sets                     AS "targetSets",
                we.reps                     AS "targetReps",
                sp."setNumber"              AS "setNumber",
                sp.reps                     AS "setReps",
                sp.weight                   AS "setWeight",
                sp.completed                AS "setCompleted"
            FROM workout_exercises we
            JOIN prev_workout pw ON we."workoutId" = pw.id
            JOIN exercises e ON e.id = we."exerciseId"
            LEFT JOIN LATERAL (
                SELECT id FROM exercise_feedbacks
                WHERE "workoutExerciseId" = we.id
                  AND "traineeId" = ${session.user.id}
                ORDER BY "updatedAt" DESC
                LIMIT 1
            ) latest_ef ON true
            LEFT JOIN sets_performed sp ON sp."feedbackId" = latest_ef.id
            ORDER BY we.order, sp."setNumber"
        `

        const exerciseMap = new Map<string, PrevWeekExerciseItem>()

        for (const row of rows) {
            if (!exerciseMap.has(row.weId)) {
                exerciseMap.set(row.weId, {
                    id: row.weId,
                    exerciseName: row.exerciseName,
                    order: row.order,
                    targetSets: row.targetSets,
                    targetReps: row.targetReps,
                    sets: [],
                })
            }

            if (row.setNumber !== null && row.setReps !== null && row.setWeight !== null) {
                exerciseMap.get(row.weId)!.sets.push({
                    setNumber: row.setNumber,
                    reps: row.setReps,
                    weight: row.setWeight,
                    completed: row.setCompleted ?? false,
                })
            }
        }

        const exercises = Array.from(exerciseMap.values()).sort((a, b) => a.order - b.order)

        return apiSuccess({ exercises })
    } catch (error: unknown) {
        if (error instanceof Response) return error
        logger.error({ error, workoutId }, 'Error fetching previous week data')
        return apiError('INTERNAL_ERROR', 'Failed to fetch previous week data', 500, undefined, 'internal.default')
    }
}
