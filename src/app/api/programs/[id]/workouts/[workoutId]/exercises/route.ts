import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/lib/api-response'
import { requireRole } from '@/lib/auth'
import { workoutExerciseSchema } from '@/schemas/workout-exercise'
import { logger } from '@/lib/logger'

/**
 * POST /api/programs/[id]/workouts/[workoutId]/exercises
 * Add exercise to workout
 * Validation: program ownership, only if status=draft
 */
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string; workoutId: string }> }
) {
    const { id: programId, workoutId } = await params
    try {
        const session = await requireRole(['admin', 'trainer'])
        const body = await request.json()

        const validation = workoutExerciseSchema.safeParse(body)
        if (!validation.success) {
            return apiError('VALIDATION_ERROR', 'Invalid input', 400, validation.error.errors, 'validation.invalidInput')
        }

        const {
            exerciseId,
            variant,
            order,
            sets,
            reps,
            notes,
            targetRpe,
            weightType,
            weight,
            effectiveWeight,
            restTime,
            isWarmup,
            isSkeletonExercise,
        } = validation.data

        // Verify program exists and check ownership
        const programwithWeeks = await prisma.trainingProgram.findUnique({
            where: { id: programId },
            include: {
                weeks: {
                    include: {
                        workouts: {
                            where: { id: workoutId },
                        },
                    },
                },
            },
        })

        if (!programwithWeeks) {
            return apiError('NOT_FOUND', 'Program not found', 404, undefined, 'program.notFound')
        }

        // Check ownership
        if (session.user.role === 'trainer' && programwithWeeks.trainerId !== session.user.id) {
            return apiError('FORBIDDEN', 'You can only modify your own programs', 403, undefined, 'program.modifyDenied')
        }

        // Check if program is draft
        if (session.user.role !== 'admin' && programwithWeeks.status !== 'draft') {
            return apiError(
                'FORBIDDEN',
                'Cannot modify program: only draft programs can be edited',
                403,
                undefined,
                'program.cannotModifyNonDraft'
            )
        }

        // Verify workout exists in this program
        const workout = programwithWeeks.weeks.flatMap((w: any) => w.workouts).find((w: any) => w.id === workoutId)
        if (!workout) {
            return apiError('NOT_FOUND', 'Workout not found in this program', 404, undefined, 'workout.notFoundInProgram')
        }

        // Verify exercise exists
        const exercise = await prisma.exercise.findUnique({
            where: { id: exerciseId },
        })

        if (!exercise) {
            return apiError('NOT_FOUND', 'Exercise not found', 404, undefined, 'exercise.notFound')
        }

        // If no order provided, add to end
        let finalOrder = order
        if (finalOrder === undefined) {
            const maxOrder = await prisma.workoutExercise.findFirst({
                where: { workoutId },
                orderBy: { order: 'desc' },
                select: { order: true },
            })
            finalOrder = (maxOrder?.order || 0) + 1
        }

        // Create workout exercise
        const workoutExercise = await prisma.workoutExercise.create({
            data: {
                workoutId,
                exerciseId,
                variant: variant || null,
                order: finalOrder,
                sets: sets || 1,
                reps: typeof reps === 'number' ? reps.toString() : reps || '8',
                notes: notes || null,
                targetRpe: targetRpe ?? null,
                weightType: weightType || 'absolute',
                weight: weight ?? null,
                effectiveWeight: effectiveWeight ?? null,
                restTime: restTime || 'm2',
                isWarmup: isWarmup || false,
                isSkeletonExercise: isSkeletonExercise || false,
            },
            include: {
                exercise: {
                    include: {
                        movementPattern: {
                            select: {
                                id: true,
                                name: true,
                            },
                        },
                    },
                },
            },
        })

        logger.info(
            {
                workoutExerciseId: workoutExercise.id,
                workoutId,
                exerciseId,
                userId: session.user.id,
            },
            'Exercise added to workout'
        )

        return apiSuccess({ workoutExercise }, 201)
    } catch (error: any) {
        if (error instanceof Response) return error
        logger.error(
            { error, programId, workoutId },
            'Error adding exercise to workout'
        )
        return apiError('INTERNAL_ERROR', 'Failed to add exercise to workout', 500, undefined, 'internal.default')
    }
}
