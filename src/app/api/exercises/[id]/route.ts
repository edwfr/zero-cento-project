import { NextRequest } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/lib/api-response'
import { requireRole } from '@/lib/auth'
import { exerciseSchema } from '@/schemas/exercise'
import { logger } from '@/lib/logger'

/**
 * GET /api/exercises/[id]
 * Get single exercise details
 */
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id: exerciseId } = await params
    try {
        await requireRole(['admin', 'trainer', 'trainee'])

        const exercise = await prisma.exercise.findUnique({
            where: { id: exerciseId },
            include: {
                movementPattern: {
                    select: {
                        id: true,
                        name: true,
                    },
                },
                exerciseMuscleGroups: {
                    include: {
                        muscleGroup: {
                            select: {
                                id: true,
                                name: true,
                            },
                        },
                    },
                    orderBy: {
                        coefficient: 'desc',
                    },
                },
                creator: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                    },
                },
                updater: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                    },
                },
            },
        })

        if (!exercise) {
            return apiError('NOT_FOUND', 'Exercise not found', 404, undefined, 'exercise.notFound')
        }

        return apiSuccess({ exercise })
    } catch (error: any) {
        if (error instanceof Response) return error
        logger.error({ error, exerciseId }, 'Error fetching exercise')
        return apiError('INTERNAL_ERROR', 'Failed to fetch exercise', 500, undefined, 'internal.default')
    }
}

/**
 * PUT /api/exercises/[id]
 * Update exercise (shared library: any trainer or admin can update any exercise).
 * Records updatedBy/updatedAt for audit — createdBy stays as creation audit only.
 */
export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id: exerciseId } = await params
    try {
        const session = await requireRole(['admin', 'trainer'])
        const body = await request.json()

        const validation = exerciseSchema.safeParse(body)
        if (!validation.success) {
            return apiError('VALIDATION_ERROR', 'Invalid input', 400, validation.error.errors, 'validation.invalidInput')
        }

        const { name, description, youtubeUrl, type, movementPatternId, muscleGroups, notes } = validation.data

        // Check if exercise exists
        const existing = await prisma.exercise.findUnique({
            where: { id: exerciseId },
        })

        if (!existing) {
            return apiError('NOT_FOUND', 'Exercise not found', 404, undefined, 'exercise.notFound')
        }

        // Check if new name conflicts with another exercise
        if (name !== existing.name) {
            const nameConflict = await prisma.exercise.findFirst({
                where: {
                    name: {
                        equals: name,
                        mode: 'insensitive',
                    },
                    id: {
                        not: exerciseId,
                    },
                },
            })

            if (nameConflict) {
                return apiError('CONFLICT', 'Exercise with this name already exists', 409, undefined, 'exercise.nameExists')
            }
        }

        // Verify movement pattern exists
        const movementPattern = await prisma.movementPattern.findUnique({
            where: { id: movementPatternId },
        })

        if (!movementPattern) {
            return apiError('NOT_FOUND', 'Movement pattern not found', 404, undefined, 'movementPattern.notFound')
        }

        // Verify all muscle groups exist
        if (muscleGroups.length > 0) {
            const muscleGroupIds = muscleGroups.map((mg) => mg.muscleGroupId)
            const existingMuscleGroups = await prisma.muscleGroup.findMany({
                where: {
                    id: { in: muscleGroupIds },
                },
            })

            if (existingMuscleGroups.length !== muscleGroupIds.length) {
                return apiError('NOT_FOUND', 'One or more muscle groups not found', 404, undefined, 'muscleGroup.someNotFound')
            }

            // Validate coefficients sum (must be between 0.1 and 3.0)
            const totalCoefficient = muscleGroups.reduce((sum, mg) => sum + mg.coefficient, 0)
            if (totalCoefficient < 0.1 || totalCoefficient > 3.0) {
                return apiError(
                    'VALIDATION_ERROR',
                    `Total coefficient must be between 0.1 and 3.0 (got ${totalCoefficient.toFixed(2)})`,
                    400
                )
            }
        }

        // Update exercise with muscle groups (delete old, create new)
        const exercise = await prisma.exercise.update({
            where: { id: exerciseId },
            data: {
                name,
                description,
                youtubeUrl,
                type,
                movementPatternId,
                notes: notes || [],
                updatedBy: session.user.id,
                updatedAt: new Date(),
                exerciseMuscleGroups: {
                    deleteMany: {}, // Delete all existing relationships
                    create: muscleGroups.map((mg) => ({
                        muscleGroupId: mg.muscleGroupId,
                        coefficient: mg.coefficient,
                    })),
                },
            },
            include: {
                movementPattern: {
                    select: {
                        id: true,
                        name: true,
                    },
                },
                exerciseMuscleGroups: {
                    include: {
                        muscleGroup: {
                            select: {
                                id: true,
                                name: true,
                            },
                        },
                    },
                    orderBy: {
                        coefficient: 'desc',
                    },
                },
                creator: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                    },
                },
                updater: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                    },
                },
            },
        })

        logger.info({ exerciseId, userId: session.user.id }, 'Exercise updated successfully')

        return apiSuccess({ exercise })
    } catch (error: any) {
        if (error instanceof Response) return error
        logger.error({ error, exerciseId }, 'Error updating exercise')
        return apiError('INTERNAL_ERROR', 'Failed to update exercise', 500, undefined, 'internal.default')
    }
}

/**
 * DELETE /api/exercises/[id]
 * Delete exercise (shared library: any trainer or admin can delete).
 * Only allowed when the exercise has zero references: WorkoutExercise,
 * WorkoutSkeleton and PersonalRecord all use non-cascade FKs.
 */
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id: exerciseId } = await params
    try {
        const session = await requireRole(['admin', 'trainer'])

        // Single query: existence check + reference counts.
        // No ownership check: the exercise library is shared across all trainers.
        const exercise = await prisma.exercise.findUnique({
            where: { id: exerciseId },
            select: {
                id: true,
                _count: {
                    select: {
                        workoutExercises: true,
                        workoutSkeletons: true,
                        personalRecords: true,
                    },
                },
            },
        })

        if (!exercise) {
            return apiError('NOT_FOUND', 'Exercise not found', 404, undefined, 'exercise.notFound')
        }

        // All three FKs are non-cascade, so any surviving reference would turn
        // the delete into a foreign key violation. Block on every one of them.
        const { workoutExercises, workoutSkeletons, personalRecords } = exercise._count
        const totalReferences = workoutExercises + workoutSkeletons + personalRecords

        if (totalReferences > 0) {
            // Slow path, only on conflict: name one referencing program in the message
            const sample = await prisma.workoutExercise.findFirst({
                where: { exerciseId },
                select: {
                    workout: {
                        select: {
                            week: {
                                select: {
                                    program: { select: { id: true, title: true } },
                                },
                            },
                        },
                    },
                },
            })
            const program = sample?.workout?.week?.program

            return apiError(
                'CONFLICT',
                program
                    ? `Cannot delete exercise: it is referenced by program "${program.title}"`
                    : 'Cannot delete exercise: it is still referenced',
                409,
                {
                    workoutExercises,
                    workoutSkeletons,
                    personalRecords,
                    ...(program ? { programId: program.id, programName: program.title } : {}),
                },
                'exercise.cannotDeleteReferenced'
            )
        }

        // Delete exercise (cascade will delete exerciseMuscleGroups relationships).
        // The count check above is not atomic with this delete: another request can
        // insert a WorkoutExercise/WorkoutSkeleton/PersonalRecord in between, turning
        // this into a foreign key violation (P2003). Catch that narrow race here and
        // report it the same way as the pre-check above, instead of letting it fall
        // through to the generic 500 handler.
        try {
            await prisma.exercise.delete({
                where: { id: exerciseId },
            })
        } catch (deleteError: unknown) {
            if (
                deleteError instanceof Prisma.PrismaClientKnownRequestError &&
                deleteError.code === 'P2003'
            ) {
                logger.warn(
                    { exerciseId, userId: session.user.id },
                    'Exercise delete raced with a new reference; blocking with 409'
                )
                return apiError(
                    'CONFLICT',
                    'Cannot delete exercise: it is still referenced',
                    409,
                    undefined,
                    'exercise.cannotDeleteReferenced'
                )
            }
            throw deleteError
        }

        logger.info({ exerciseId, userId: session.user.id }, 'Exercise deleted successfully')

        return apiSuccess({
            message: 'Exercise deleted successfully',
            messageKey: 'exercise.deletedSuccess',
        })
    } catch (error: any) {
        if (error instanceof Response) return error
        logger.error({ error, exerciseId }, 'Error deleting exercise')
        return apiError('INTERNAL_ERROR', 'Failed to delete exercise', 500, undefined, 'internal.default')
    }
}
