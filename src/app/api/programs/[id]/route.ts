import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/lib/api-response'
import { requireRole } from '@/lib/auth'
import { createProgramSchema } from '@/schemas/program'
import { logger } from '@/lib/logger'

/**
 * GET /api/programs/[id]
 * Get program details with full nested structure
 * Includes: weeks → workouts → workoutExercises → exercise
 */
export async function GET(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const session = await requireRole(['admin', 'trainer', 'trainee'])
        const programId = params.id

        const program = await prisma.trainingProgram.findUnique({
            where: { id: programId },
            include: {
                trainer: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                    },
                },
                trainee: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                    },
                },
                weeks: {
                    include: {
                        workouts: {
                            include: {
                                workoutExercises: {
                                    include: {
                                        exercise: {
                                            include: {
                                                movementPattern: {
                                                    select: {
                                                        id: true,
                                                        name: true,
                                                        movementPatternColors: {
                                                            select: {
                                                                color: true,
                                                                trainerId: true,
                                                            },
                                                        },
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
                                                },
                                            },
                                        },
                                    },
                                    orderBy: {
                                        order: 'asc',
                                    },
                                },
                            },
                        },
                    },
                    orderBy: {
                        weekNumber: 'asc',
                    },
                },
            },
        })

        if (!program) {
            return apiError('NOT_FOUND', 'Program not found', 404, undefined, 'program.notFound')
        }

        // RBAC: Check access
        if (session.user.role === 'trainer' && program.trainerId !== session.user.id) {
            return apiError('FORBIDDEN', 'You can only view your own programs', 403, undefined, 'program.viewDenied')
        }

        if (session.user.role === 'trainee' && program.traineeId !== session.user.id) {
            return apiError('FORBIDDEN', 'You can only view programs assigned to you', 403, undefined, 'program.viewAssignedDenied')
        }

        return apiSuccess({ program })
    } catch (error: any) {
        if (error instanceof Response) return error
        logger.error({ error, programId: params.id }, 'Error fetching program')
        return apiError('INTERNAL_ERROR', 'Failed to fetch program', 500, undefined, 'internal.default')
    }
}

/**
 * PUT /api/programs/[id]
 * Update program
 * Immutability: only if status=draft (trainer) or admin override
 */
export async function PUT(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const session = await requireRole(['admin', 'trainer'])
        const programId = params.id
        const body = await request.json()

        const validation = createProgramSchema.partial().safeParse(body)
        if (!validation.success) {
            return apiError('VALIDATION_ERROR', 'Invalid input', 400, validation.error.errors, 'validation.invalidInput')
        }

        const { title, traineeId, isSbdProgram, durationWeeks, workoutsPerWeek } = validation.data

        // Check if program exists
        const existing = await prisma.trainingProgram.findUnique({
            where: { id: programId },
            include: {
                weeks: true,
            },
        })

        if (!existing) {
            return apiError('NOT_FOUND', 'Program not found', 404, undefined, 'program.notFound')
        }

        // RBAC: Check ownership
        if (session.user.role === 'trainer' && existing.trainerId !== session.user.id) {
            return apiError('FORBIDDEN', 'You can only modify your own programs', 403, undefined, 'program.modifyDenied')
        }

        // Immutability check: only draft programs can be modified (unless admin)
        if (session.user.role !== 'admin' && existing.status !== 'draft') {
            return apiError(
                'FORBIDDEN',
                'Cannot modify program: only draft programs can be edited',
                403
            )
        }

        // Verify trainee exists and is a trainee role (if traineeId is being updated)
        if (traineeId) {
            const trainee = await prisma.user.findUnique({
                where: { id: traineeId },
            })

            if (!trainee) {
                return apiError('NOT_FOUND', 'Trainee not found', 404, undefined, 'trainee.notFound')
            }

            if (trainee.role !== 'trainee') {
                return apiError('VALIDATION_ERROR', 'User must have trainee role', 400, undefined, 'validation.userMustBeTrainee')
            }

            // If trainer, verify they own/manage this trainee via TrainerTrainee
            if (session.user.role === 'trainer') {
                const trainerRelation = await prisma.trainerTrainee.findFirst({
                    where: {
                        trainerId: session.user.id,
                        traineeId,
                    },
                })
                if (!trainerRelation) {
                    return apiError('FORBIDDEN', 'You can only assign programs to your own trainees', 403, undefined, 'program.assignDenied')
                }
            }
        }

        // Update program (basic fields only, weeks/workouts handled separately)
        const program = await prisma.trainingProgram.update({
            where: { id: programId },
            data: {
                ...(title && { title }),
                ...(traineeId && { traineeId }),
                ...(isSbdProgram !== undefined && { isSbdProgram }),
                ...(durationWeeks !== undefined && { durationWeeks }),
                ...(workoutsPerWeek !== undefined && { workoutsPerWeek }),
            },
            include: {
                trainer: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                    },
                },
                trainee: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                    },
                },
                weeks: {
                    include: {
                        workouts: true,
                    },
                    orderBy: {
                        weekNumber: 'asc',
                    },
                },
            },
        })

        logger.info({ programId, userId: session.user.id }, 'Program updated successfully')

        return apiSuccess({ program })
    } catch (error: any) {
        if (error instanceof Response) return error
        logger.error({ error, programId: params.id }, 'Error updating program')
        return apiError('INTERNAL_ERROR', 'Failed to update program', 500, undefined, 'internal.default')
    }
}

/**
 * DELETE /api/programs/[id]
 * Delete program
 * Only if status=draft, admin can delete any status
 */
export async function DELETE(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const session = await requireRole(['admin', 'trainer'])
        const programId = params.id

        // Check if program exists
        const program = await prisma.trainingProgram.findUnique({
            where: { id: programId },
        })

        if (!program) {
            return apiError('NOT_FOUND', 'Program not found', 404, undefined, 'program.notFound')
        }

        // RBAC: Check ownership
        if (session.user.role === 'trainer' && program.trainerId !== session.user.id) {
            return apiError('FORBIDDEN', 'You can only delete your own programs', 403, undefined, 'program.deleteDenied')
        }

        // Check status: only draft can be deleted (unless admin)
        if (session.user.role !== 'admin' && program.status !== 'draft') {
            return apiError(
                'FORBIDDEN',
                'Cannot delete program: only draft programs can be deleted',
                403
            )
        }

        // Delete program (cascade will delete weeks, workouts, workoutExercises)
        await prisma.trainingProgram.delete({
            where: { id: programId },
        })

        logger.info({ programId, userId: session.user.id }, 'Program deleted successfully')

        return apiSuccess({ message: 'Program deleted successfully' })
    } catch (error: any) {
        if (error instanceof Response) return error
        logger.error({ error, programId: params.id }, 'Error deleting program')
        return apiError('INTERNAL_ERROR', 'Failed to delete program', 500, undefined, 'internal.default')
    }
}
