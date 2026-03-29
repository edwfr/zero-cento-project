import { NextRequest } from 'next/server'
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
    { params }: { params: { id: string } }
) {
    try {
        await requireRole(['admin', 'trainer', 'trainee'])

        const exerciseId = params.id

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
            },
        })

        if (!exercise) {
            return apiError('NOT_FOUND', 'Exercise not found', 404)
        }

        return apiSuccess({ exercise })
    } catch (error: any) {
        if (error instanceof Response) return error
        logger.error({ error, exerciseId: params.id }, 'Error fetching exercise')
        return apiError('INTERNAL_ERROR', 'Failed to fetch exercise', 500)
    }
}

/**
 * PUT /api/exercises/[id]
 * Update exercise (trainer can only update their own exercises, admin can update any)
 */
export async function PUT(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const session = await requireRole(['admin', 'trainer'])
        const exerciseId = params.id
        const body = await request.json()

        const validation = exerciseSchema.safeParse(body)
        if (!validation.success) {
            return apiError('VALIDATION_ERROR', 'Invalid input', 400, validation.error.errors)
        }

        const { name, description, youtubeUrl, type, movementPatternId, muscleGroups, notes } = validation.data

        // Check if exercise exists
        const existing = await prisma.exercise.findUnique({
            where: { id: exerciseId },
        })

        if (!existing) {
            return apiError('NOT_FOUND', 'Exercise not found', 404)
        }

        // Check ownership: trainers can only modify their own exercises, admins can modify any
        if (session.user.role === 'trainer' && existing.createdBy !== session.user.id) {
            return apiError('FORBIDDEN', 'You can only modify exercises you created', 403)
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
                return apiError('CONFLICT', 'Exercise with this name already exists', 409)
            }
        }

        // Verify movement pattern exists
        const movementPattern = await prisma.movementPattern.findUnique({
            where: { id: movementPatternId },
        })

        if (!movementPattern) {
            return apiError('NOT_FOUND', 'Movement pattern not found', 404)
        }

        // Verify all muscle groups exist
        const muscleGroupIds = muscleGroups.map((mg) => mg.muscleGroupId)
        const existingMuscleGroups = await prisma.muscleGroup.findMany({
            where: {
                id: { in: muscleGroupIds },
            },
        })

        if (existingMuscleGroups.length !== muscleGroupIds.length) {
            return apiError('NOT_FOUND', 'One or more muscle groups not found', 404)
        }

        // Validate coefficients sum
        const totalCoefficient = muscleGroups.reduce((sum, mg) => sum + mg.coefficient, 0)
        if (totalCoefficient > 3.0) {
            logger.warn({ totalCoefficient, exerciseName: name }, 'Exercise coefficient sum unusually high')
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
            },
        })

        logger.info({ exerciseId, userId: session.user.id }, 'Exercise updated successfully')

        return apiSuccess({ exercise })
    } catch (error: any) {
        if (error instanceof Response) return error
        logger.error({ error, exerciseId: params.id }, 'Error updating exercise')
        return apiError('INTERNAL_ERROR', 'Failed to update exercise', 500)
    }
}

/**
 * DELETE /api/exercises/[id]
 * Delete exercise (cannot delete if used in active WorkoutExercises)
 */
export async function DELETE(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const session = await requireRole(['admin', 'trainer'])
        const exerciseId = params.id

        // Check if exercise exists
        const exercise = await prisma.exercise.findUnique({
            where: { id: exerciseId },
        })

        if (!exercise) {
            return apiError('NOT_FOUND', 'Exercise not found', 404)
        }

        // Check ownership: trainers can only delete their own exercises, admins can delete any
        if (session.user.role === 'trainer' && exercise.createdBy !== session.user.id) {
            return apiError('FORBIDDEN', 'You can only delete exercises you created', 403)
        }

        // Check if exercise is used in any active programs
        // We need to check if any workout exercises reference this exercise
        // where the week belongs to an active program
        const workoutExercisesWithProgram = await prisma.workoutExercise.findMany({
            where: {
                exerciseId,
            },
            include: {
                workout: {
                    include: {
                        week: {
                            include: {
                                program: {
                                    select: {
                                        id: true,
                                        title: true,
                                        status: true,
                                    },
                                },
                            },
                        },
                    },
                },
            },
        })

        const activeProgram = workoutExercisesWithProgram.find(
            (we) => we.workout.week.program.status === 'active'
        )

        if (activeProgram) {
            return apiError(
                'CONFLICT',
                `Cannot delete exercise: it is used in active program "${activeProgram.workout.week.program.title}"`,
                409,
                {
                    programId: activeProgram.workout.week.program.id,
                    programName: activeProgram.workout.week.program.title,
                }
            )
        }

        // Delete exercise (cascade will delete exerciseMuscleGroups relationships)
        await prisma.exercise.delete({
            where: { id: exerciseId },
        })

        logger.info({ exerciseId, userId: session.user.id }, 'Exercise deleted successfully')

        return apiSuccess({ message: 'Exercise deleted successfully' })
    } catch (error: any) {
        if (error instanceof Response) return error
        logger.error({ error, exerciseId: params.id }, 'Error deleting exercise')
        return apiError('INTERNAL_ERROR', 'Failed to delete exercise', 500)
    }
}
