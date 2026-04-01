import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/lib/api-response'
import { requireRole } from '@/lib/auth'
import { logger } from '@/lib/logger'
import { z } from 'zod'

const publishSchema = z.object({
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)'),
})

/**
 * POST /api/programs/[id]/publish
 * Publish program (draft → active)
 * Business logic:
 * - Calculate endDate based on durationWeeks
 * - Assign dates to each Week
 * - Validate each Workout has at least 1 WorkoutExercise
 * RBAC: only trainer owner or admin
 */
export async function POST(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const session = await requireRole(['admin', 'trainer'])
        const programId = params.id
        const body = await request.json()

        const validation = publishSchema.safeParse(body)
        if (!validation.success) {
            return apiError('VALIDATION_ERROR', 'Invalid input', 400, validation.error.errors, 'validation.invalidInput')
        }

        const { startDate } = validation.data

        // Verify program exists and check ownership
        const program = await prisma.trainingProgram.findUnique({
            where: { id: programId },
            include: {
                weeks: {
                    include: {
                        workouts: {
                            include: {
                                workoutExercises: true,
                            },
                        },
                    },
                    orderBy: { weekNumber: 'asc' },
                },
            },
        })

        if (!program) {
            return apiError('NOT_FOUND', 'Program not found', 404, undefined, 'program.notFound')
        }

        // Check ownership
        if (session.user.role === 'trainer' && program.trainerId !== session.user.id) {
            return apiError('FORBIDDEN', 'You can only publish your own programs', 403, undefined, 'program.publishDenied')
        }

        // Check if program is draft
        if (program.status !== 'draft') {
            return apiError('VALIDATION_ERROR', 'Program is already published or completed', 400, undefined, 'program.alreadyPublished')
        }

        // Validate: each Workout must have at least 1 WorkoutExercise
        const emptyWorkouts = program.weeks.flatMap((week: any) =>
            week.workouts.filter((workout: any) => workout.workoutExercises.length === 0)
        )

        if (emptyWorkouts.length > 0) {
            return apiError(
                'VALIDATION_ERROR',
                `Cannot publish: ${emptyWorkouts.length} workout(s) have no exercises`,
                400,
                {
                    emptyWorkoutIds: emptyWorkouts.map((w: any) => w.id),
                }
            )
        }

        // Calculate dates
        const startDateObj = new Date(startDate)
        const endDateObj = new Date(startDateObj)
        endDateObj.setDate(endDateObj.getDate() + program.durationWeeks * 7)

        // Update program status and dates
        await prisma.trainingProgram.update({
            where: { id: programId },
            data: {
                status: 'active',
                startDate: startDateObj,
                publishedAt: new Date(),
            },
        })

        // Assign dates to weeks
        for (let i = 0; i < program.weeks.length; i++) {
            const week = program.weeks[i]
            const weekStartDate = new Date(startDateObj)
            weekStartDate.setDate(weekStartDate.getDate() + (week.weekNumber - 1) * 7)

            const weekEndDate = new Date(weekStartDate)
            weekEndDate.setDate(weekEndDate.getDate() + 6)

            await prisma.week.update({
                where: { id: week.id },
                data: {
                    startDate: weekStartDate,
                },
            })
        }

        // Fetch updated program
        const updatedProgram = await prisma.trainingProgram.findUnique({
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
                                        exercise: true,
                                    },
                                    orderBy: { order: 'asc' },
                                },
                            },
                        },
                    },
                    orderBy: { weekNumber: 'asc' },
                },
            },
        })

        logger.info(
            {
                programId,
                traineeId: program.traineeId,
                startDate,
                userId: session.user.id,
            },
            'Program published successfully'
        )

        return apiSuccess({
            program: updatedProgram,
            message: 'Program published successfully',
        })
    } catch (error: any) {
        if (error instanceof Response) return error
        logger.error({ error, programId: params.id }, 'Error publishing program')
        return apiError('INTERNAL_ERROR', 'Failed to publish program', 500, undefined, 'internal.default')
    }
}
