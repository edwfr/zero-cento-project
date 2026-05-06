import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/lib/api-response'
import { requireRole } from '@/lib/auth'
import { workoutSubmitSchema } from '@/schemas/feedback'
import { logger } from '@/lib/logger'
import { getTodayDateKey } from '@/lib/date-format'
import { cascadeWorkoutCompletion } from '@/lib/completion-service'

/**
 * POST /api/trainee/workouts/[id]/submit
 * Atomic submit of the whole workout: notes + per-exercise (actualRpe + sets[]).
 * One transaction; one ownership check; upserts on (workoutExerciseId, traineeId, date).
 * RBAC: trainee must own the program containing this workout.
 */
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id: workoutId } = await params
    try {
        const session = await requireRole(['trainee'])
        const body = await request.json()

        const parsed = workoutSubmitSchema.safeParse(body)
        if (!parsed.success) {
            return apiError(
                'VALIDATION_ERROR',
                'Invalid input',
                400,
                parsed.error.errors,
                'validation.invalidInput'
            )
        }

        const { traineeNotes, exercises } = parsed.data

        // 1. Single ownership check: workout belongs to a program owned by this trainee.
        //    Also returns the set of valid workoutExercise ids in one query.
        const workout = await prisma.workout.findFirst({
            where: {
                id: workoutId,
                week: { program: { traineeId: session.user.id } },
            },
            select: {
                id: true,
                workoutExercises: { select: { id: true } },
            },
        })

        if (!workout) {
            return apiError(
                'NOT_FOUND',
                'Workout not found',
                404,
                undefined,
                'workout.notFound'
            )
        }

        // 2. Validate every submitted exercise belongs to this workout.
        const validIds = new Set(workout.workoutExercises.map((we) => we.id))
        const invalid = exercises.find((ex) => !validIds.has(ex.workoutExerciseId))
        if (invalid) {
            return apiError(
                'VALIDATION_ERROR',
                'Exercise does not belong to this workout',
                400,
                { workoutExerciseId: invalid.workoutExerciseId },
                'workoutExercise.notInWorkout'
            )
        }

        // 3. Calendar-day key for upsert idempotency (UTC-consistent for multi-timezone safety).
        const today = getTodayDateKey()

        // 4. Single transaction: feedback upserts + WorkoutExercise.isCompleted updates +
        //    Workout.traineeNotes update. Per-exercise notes are NOT touched here.
        //    Slicing first N results gives feedbacks; remaining N are the isCompleted updates.
        const txResults = await prisma.$transaction([
            ...exercises.map((ex) =>
                prisma.exerciseFeedback.upsert({
                    where: {
                        workoutExerciseId_traineeId_date: {
                            workoutExerciseId: ex.workoutExerciseId,
                            traineeId: session.user.id,
                            date: today,
                        },
                    },
                    create: {
                        workoutExerciseId: ex.workoutExerciseId,
                        traineeId: session.user.id,
                        date: today,
                        actualRpe: ex.actualRpe ?? null,
                        setsPerformed: {
                            create: ex.sets.map((s) => ({
                                setNumber: s.setNumber,
                                completed: s.completed,
                                reps: s.reps,
                                weight: s.weight,
                            })),
                        },
                    },
                    update: {
                        actualRpe: ex.actualRpe ?? null,
                        setsPerformed: {
                            deleteMany: {},
                            create: ex.sets.map((s) => ({
                                setNumber: s.setNumber,
                                completed: s.completed,
                                reps: s.reps,
                                weight: s.weight,
                            })),
                        },
                    },
                    select: {
                        id: true,
                        workoutExerciseId: true,
                        actualRpe: true,
                        notes: true,
                        date: true,
                    },
                })
            ),
            ...exercises.map((ex) =>
                prisma.workoutExercise.update({
                    where: { id: ex.workoutExerciseId },
                    data: {
                        isCompleted: ex.sets.length > 0 && ex.sets.every((s) => s.completed),
                    },
                    select: { id: true },
                })
            ),
            prisma.workout.update({
                where: { id: workoutId },
                data: { traineeNotes: traineeNotes ?? null },
                select: { id: true },
            }),
        ])
        const feedbacks = txResults.slice(0, exercises.length)

        // Final submit closes the workout even if some exercises still lack outcomes.
        // Those exercise flags remain false, but the workout/week/program can advance.
        const workoutCascade = await cascadeWorkoutCompletion(workoutId, true)

        logger.info(
            {
                workoutId,
                traineeId: session.user.id,
                count: feedbacks.length,
                workoutCompleted: workoutCascade.workout.isCompleted,
                weekCompleted: workoutCascade.week.isCompleted,
                programStatus: workoutCascade.program.status,
            },
            'Workout submitted'
        )

        return apiSuccess({ feedbacks, workoutCascade }, 200)
    } catch (error: any) {
        if (error instanceof Response) return error
        logger.error({ error, workoutId }, 'Error submitting workout')
        return apiError(
            'INTERNAL_ERROR',
            'Failed to submit workout',
            500,
            undefined,
            'internal.default'
        )
    }
}
