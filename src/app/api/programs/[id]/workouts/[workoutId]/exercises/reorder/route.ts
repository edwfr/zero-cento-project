import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/lib/api-response'
import { requireRole } from '@/lib/auth'
import { logger } from '@/lib/logger'
import { z } from 'zod'

const reorderSchema = z.object({
    exercises: z.array(
        z.object({
            id: z.string(),
            order: z.number().int().positive(),
        })
    ),
})

/**
 * PATCH /api/programs/[id]/workouts/[workoutId]/exercises/reorder
 * Reorder exercises in a workout
 */
export async function PATCH(
    request: NextRequest,
    { params }: { params: { id: string; workoutId: string } }
) {
    try {
        const session = await requireRole(['admin', 'trainer'])
        const { id: programId, workoutId } = params
        const body = await request.json()

        const validation = reorderSchema.safeParse(body)
        if (!validation.success) {
            return apiError('VALIDATION_ERROR', 'Invalid input', 400, validation.error.errors, 'validation.invalidInput')
        }

        const { exercises } = validation.data

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
                403
            )
        }

        // Verify all exercises belong to this workout
        const exerciseIds = exercises.map((e) => e.id)
        const existingExercises = await prisma.workoutExercise.findMany({
            where: {
                id: { in: exerciseIds },
                workoutId,
            },
        })

        if (existingExercises.length !== exerciseIds.length) {
            return apiError('NOT_FOUND', 'One or more exercises not found in this workout', 404, undefined, 'workout.exercisesNotFound')
        }

        // Update order for each exercise
        await prisma.$transaction(
            exercises.map((exercise) =>
                prisma.workoutExercise.update({
                    where: { id: exercise.id },
                    data: { order: exercise.order },
                })
            )
        )

        // Fetch updated exercises
        const updatedExercises = await prisma.workoutExercise.findMany({
            where: { workoutId },
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
            orderBy: { order: 'asc' },
        })

        logger.info(
            {
                workoutId,
                exerciseCount: exercises.length,
                userId: session.user.id,
            },
            'Workout exercises reordered'
        )

        return apiSuccess({ exercises: updatedExercises })
    } catch (error: any) {
        if (error instanceof Response) return error
        logger.error(
            { error, programId: params.id, workoutId: params.workoutId },
            'Error reordering exercises'
        )
        return apiError('INTERNAL_ERROR', 'Failed to reorder exercises', 500, undefined, 'internal.default')
    }
}
