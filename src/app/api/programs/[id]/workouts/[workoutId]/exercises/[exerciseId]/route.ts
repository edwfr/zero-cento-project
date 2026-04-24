import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/lib/api-response'
import { requireRole } from '@/lib/auth'
import { workoutExerciseSchema } from '@/schemas/workout-exercise'
import { logger } from '@/lib/logger'

/**
 * PUT /api/programs/[id]/workouts/[workoutId]/exercises/[exerciseId]
 * Update workout exercise
 */
export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string; workoutId: string; exerciseId: string }> }
) {
    const { id: programId, workoutId, exerciseId } = await params
    try {
        const session = await requireRole(['admin', 'trainer'])
        const body = await request.json()

        const validation = workoutExerciseSchema.safeParse(body)
        if (!validation.success) {
            return apiError('VALIDATION_ERROR', 'Invalid input', 400, validation.error.errors, 'validation.invalidInput')
        }

        const {
            exerciseId: newExerciseId,
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
        } = validation.data

        // Verify program exists and check ownership
        const program = await prisma.trainingProgram.findUnique({
            where: { id: programId },
        })

        if (!program) {
            return apiError('NOT_FOUND', 'Program not found', 404, undefined, 'program.notFound')
        }

        // Check ownership
        if (session.user.role === 'trainer' && program.trainerId !== session.user.id) {
            return apiError('FORBIDDEN', 'You can only modify your own programs', 403, undefined, 'program.modifyDenied')
        }

        // Check if program is draft
        if (session.user.role !== 'admin' && program.status !== 'draft') {
            return apiError(
                'FORBIDDEN',
                'Cannot modify program: only draft programs can be edited',
                403,
                undefined,
                'program.cannotModifyNonDraft'
            )
        }

        // Verify workout exercise exists
        const existing = await prisma.workoutExercise.findUnique({
            where: { id: exerciseId },
        })

        if (!existing || existing.workoutId !== workoutId) {
            return apiError('NOT_FOUND', 'Workout exercise not found', 404, undefined, 'workoutExercise.notFound')
        }

        // Verify new exercise exists if changing
        if (newExerciseId && newExerciseId !== existing.exerciseId) {
            const exercise = await prisma.exercise.findUnique({
                where: { id: newExerciseId },
            })

            if (!exercise) {
                return apiError('NOT_FOUND', 'Exercise not found', 404, undefined, 'exercise.notFound')
            }
        }

        // Update workout exercise
        const workoutExercise = await prisma.workoutExercise.update({
            where: { id: exerciseId },
            data: {
                ...(newExerciseId && { exerciseId: newExerciseId }),
                ...(variant !== undefined && { variant }),
                ...(order !== undefined && { order }),
                ...(sets !== undefined && { sets }),
                ...(reps !== undefined && { reps: typeof reps === 'number' ? reps.toString() : reps }),
                ...(notes !== undefined && { notes }),
                ...(targetRpe !== undefined && { targetRpe }),
                ...(weightType !== undefined && { weightType }),
                ...(weight !== undefined && { weight }),
                ...(effectiveWeight !== undefined && { effectiveWeight }),
                ...(restTime !== undefined && { restTime }),
                ...(isWarmup !== undefined && { isWarmup }),
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
                workoutExerciseId: exerciseId,
                workoutId,
                userId: session.user.id,
            },
            'Workout exercise updated'
        )

        return apiSuccess({ workoutExercise })
    } catch (error: any) {
        if (error instanceof Response) return error
        logger.error(
            { error, programId, workoutId, exerciseId },
            'Error updating workout exercise'
        )
        return apiError('INTERNAL_ERROR', 'Failed to update workout exercise', 500, undefined, 'internal.default')
    }
}

/**
 * DELETE /api/programs/[id]/workouts/[workoutId]/exercises/[exerciseId]
 * Remove exercise from workout
 * Recalculates orderIndex of other exercises
 */
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string; workoutId: string; exerciseId: string }> }
) {
    const { id: programId, workoutId, exerciseId } = await params
    try {
        const session = await requireRole(['admin', 'trainer'])

        // Verify program exists and check ownership
        const programCheck = await prisma.trainingProgram.findUnique({
            where: { id: programId },
        })

        if (!programCheck) {
            return apiError('NOT_FOUND', 'Program not found', 404, undefined, 'program.notFound')
        }

        // Check ownership
        if (session.user.role === 'trainer' && programCheck.trainerId !== session.user.id) {
            return apiError('FORBIDDEN', 'You can only modify your own programs', 403, undefined, 'program.modifyDenied')
        }

        // Check if program is draft
        if (session.user.role !== 'admin' && programCheck.status !== 'draft') {
            return apiError(
                'FORBIDDEN',
                'Cannot modify program: only draft programs can be edited',
                403,
                undefined,
                'program.cannotModifyNonDraft'
            )
        }

        // Verify workout exercise exists
        const existing = await prisma.workoutExercise.findUnique({
            where: { id: exerciseId },
        })

        if (!existing || existing.workoutId !== workoutId) {
            return apiError('NOT_FOUND', 'Workout exercise not found', 404, undefined, 'workoutExercise.notFound')
        }

        // Delete workout exercise
        await prisma.workoutExercise.delete({
            where: { id: exerciseId },
        })

        // Recalculate order for remaining exercises
        const remainingExercises = await prisma.workoutExercise.findMany({
            where: { workoutId },
            orderBy: { order: 'asc' },
        })

        // Update order to be sequential (1, 2, 3, ...) in a single transaction
        if (remainingExercises.length > 0) {
            await prisma.$transaction(
                remainingExercises.map((exercise, i) =>
                    prisma.workoutExercise.update({
                        where: { id: exercise.id },
                        data: { order: i + 1 },
                    })
                )
            )
        }

        logger.info(
            {
                workoutExerciseId: exerciseId,
                workoutId,
                userId: session.user.id,
            },
            'Exercise removed from workout'
        )

        return apiSuccess({
            message: 'Exercise removed from workout successfully',
            messageKey: 'workoutExercise.removedSuccess',
        })
    } catch (error: any) {
        if (error instanceof Response) return error
        logger.error(
            { error, programId, workoutId, exerciseId },
            'Error removing exercise from workout'
        )
        return apiError('INTERNAL_ERROR', 'Failed to remove exercise from workout', 500, undefined, 'internal.default')
    }
}
