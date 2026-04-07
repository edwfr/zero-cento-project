import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/lib/api-response'
import { requireRole } from '@/lib/auth'
import { createProgramSchema } from '@/schemas/program'
import { logger } from '@/lib/logger'
import { calculateEffectiveWeight } from '@/lib/calculations'

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

        let resolvedProgram = program

        if (session.user.role === 'trainee') {
            const weeksWithResolvedWeights = await Promise.all(
                program.weeks.map(async (week) => ({
                    ...week,
                    workouts: await Promise.all(
                        week.workouts.map(async (workout) => ({
                            ...workout,
                            workoutExercises: await Promise.all(
                                workout.workoutExercises.map(async (workoutExercise) => {
                                    if (typeof workoutExercise.effectiveWeight === 'number') {
                                        return workoutExercise
                                    }

                                    if (workoutExercise.weightType === 'absolute') {
                                        return {
                                            ...workoutExercise,
                                            effectiveWeight: workoutExercise.weight,
                                        }
                                    }

                                    try {
                                        const effectiveWeight = await calculateEffectiveWeight(
                                            workoutExercise,
                                            session.user.id
                                        )

                                        return {
                                            ...workoutExercise,
                                            effectiveWeight,
                                        }
                                    } catch (calculationError: unknown) {
                                        logger.warn(
                                            {
                                                programId,
                                                workoutExerciseId: workoutExercise.id,
                                                error: calculationError instanceof Error
                                                    ? calculationError.message
                                                    : String(calculationError),
                                            },
                                            'Failed to resolve effective weight while fetching program details'
                                        )

                                        return {
                                            ...workoutExercise,
                                            effectiveWeight: null,
                                        }
                                    }
                                })
                            ),
                        }))
                    ),
                }))
            )

            resolvedProgram = {
                ...program,
                weeks: weeksWithResolvedWeights,
            }
        }

        return apiSuccess({ program: resolvedProgram })
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
                weeks: {
                    include: {
                        workouts: {
                            select: {
                                id: true,
                                dayIndex: true,
                            },
                        },
                    },
                    orderBy: {
                        weekNumber: 'asc',
                    },
                },
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

        const targetDurationWeeks = durationWeeks ?? existing.durationWeeks
        const targetWorkoutsPerWeek = workoutsPerWeek ?? existing.workoutsPerWeek
        const existingWeeksCount = existing.weeks.length
        const maxExistingWorkoutsPerWeek = existing.weeks.reduce(
            (max, week) => Math.max(max, week.workouts.length),
            0
        )

        if (targetDurationWeeks < existingWeeksCount) {
            return apiError(
                'VALIDATION_ERROR',
                `Cannot reduce durationWeeks below existing configured weeks (${existingWeeksCount})`,
                400,
                undefined,
                'validation.invalidInput'
            )
        }

        if (targetWorkoutsPerWeek < maxExistingWorkoutsPerWeek) {
            return apiError(
                'VALIDATION_ERROR',
                `Cannot reduce workoutsPerWeek below existing configured workouts (${maxExistingWorkoutsPerWeek})`,
                400,
                undefined,
                'validation.invalidInput'
            )
        }

        // Update metadata and keep relational structure aligned to declared duration/workouts.
        const program = await prisma.$transaction(async (tx) => {
            await tx.trainingProgram.update({
                where: { id: programId },
                data: {
                    ...(title !== undefined && { title }),
                    ...(traineeId !== undefined && { traineeId }),
                    ...(isSbdProgram !== undefined && { isSbdProgram }),
                    ...(durationWeeks !== undefined && { durationWeeks }),
                    ...(workoutsPerWeek !== undefined && { workoutsPerWeek }),
                },
            })

            let weeks = await tx.week.findMany({
                where: { programId },
                include: {
                    workouts: {
                        select: {
                            id: true,
                            dayIndex: true,
                        },
                    },
                },
                orderBy: {
                    weekNumber: 'asc',
                },
            })

            if (weeks.length < targetDurationWeeks) {
                const existingWeekNumbers = new Set(weeks.map((week) => week.weekNumber))
                const weeksToCreate: Array<{ programId: string; weekNumber: number }> = []

                for (let weekNumber = 1; weekNumber <= targetDurationWeeks; weekNumber += 1) {
                    if (!existingWeekNumbers.has(weekNumber)) {
                        weeksToCreate.push({
                            programId,
                            weekNumber,
                        })
                    }
                }

                if (weeksToCreate.length > 0) {
                    await tx.week.createMany({
                        data: weeksToCreate,
                    })

                    weeks = await tx.week.findMany({
                        where: { programId },
                        include: {
                            workouts: {
                                select: {
                                    id: true,
                                    dayIndex: true,
                                },
                            },
                        },
                        orderBy: {
                            weekNumber: 'asc',
                        },
                    })
                }
            }

            for (const week of weeks) {
                const existingWorkoutDayIndexes = new Set(
                    week.workouts.map((workout) => workout.dayIndex)
                )
                const workoutsToCreate: Array<{ weekId: string; dayIndex: number }> = []

                for (let dayIndex = 1; dayIndex <= targetWorkoutsPerWeek; dayIndex += 1) {
                    if (!existingWorkoutDayIndexes.has(dayIndex)) {
                        workoutsToCreate.push({
                            weekId: week.id,
                            dayIndex,
                        })
                    }
                }

                if (workoutsToCreate.length > 0) {
                    await tx.workout.createMany({
                        data: workoutsToCreate,
                    })
                }
            }

            return tx.trainingProgram.findUnique({
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
                            workouts: true,
                        },
                        orderBy: {
                            weekNumber: 'asc',
                        },
                    },
                },
            })
        })

        if (!program) {
            return apiError('NOT_FOUND', 'Program not found', 404, undefined, 'program.notFound')
        }

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
