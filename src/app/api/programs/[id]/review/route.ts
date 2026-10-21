import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/lib/api-response'
import { requireRole } from '@/lib/auth'
import { latestNormalizedOneRMByExercise } from '@/lib/calculations'
import { handleApiError } from '@/lib/api-error-handler'

/**
 * GET /api/programs/[id]/review
 *
 * Dedicated review endpoint that replaces the previous two-step waterfall:
 *   1. GET /api/programs/[id]
 *   2. GET /api/personal-records?traineeId=...
 *
 * Optimisations:
 * - Single HTTP round-trip instead of two sequential calls.
 * - Program and personal records are fetched in parallel (Promise.all).
 * - Returns pre-computed `estimatedOneRMByExercise` (theoretical 1RM of the
 *   most recent PR of each exercise) ready for the client to consume directly.
 *
 * RBAC: trainer owner or admin only.
 */
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id: programId } = await params
    try {
        const session = await requireRole(['admin', 'trainer'])

        // Step 1 — lightweight ownership check (one small query, no joins)
        const programMeta = await prisma.trainingProgram.findFirst({
            where: { id: programId },
            select: { trainerId: true, traineeId: true },
        })

        if (!programMeta) {
            return apiError('NOT_FOUND', 'Program not found', 404, undefined, 'program.notFound')
        }

        if (session.user.role === 'trainer' && programMeta.trainerId !== session.user.id) {
            return apiError('FORBIDDEN', 'You can only view your own programs', 403, undefined, 'program.viewDenied')
        }

        // Step 2 — fetch program tree and the trainee's PRs in parallel
        const [program, records] = await Promise.all([
            prisma.trainingProgram.findUnique({
                where: { id: programId },
                select: {
                    id: true,
                    title: true,
                    startDate: true,
                    status: true,
                    isSbdProgram: true,
                    durationWeeks: true,
                    workoutsPerWeek: true,
                    trainer: {
                        select: { id: true, firstName: true, lastName: true },
                    },
                    trainee: {
                        select: { id: true, firstName: true, lastName: true },
                    },
                    weeks: {
                        orderBy: { weekNumber: 'asc' },
                        select: {
                            id: true,
                            weekNumber: true,
                            weekType: true,
                            workouts: {
                                select: {
                                    id: true,
                                    dayIndex: true,
                                    workoutExercises: {
                                        orderBy: { order: 'asc' },
                                        select: {
                                            id: true,
                                            sets: true,
                                            reps: true,
                                            variant: true,
                                            targetRpe: true,
                                            weightType: true,
                                            weight: true,
                                            effectiveWeight: true,
                                            restTime: true,
                                            isWarmup: true,
                                            isJumpSet: true,
                                            isSuperSet: true,
                                            notes: true,
                                            exercise: {
                                                select: {
                                                    id: true,
                                                    name: true,
                                                    type: true,
                                                    movementPattern: {
                                                        select: {
                                                            id: true,
                                                            name: true,
                                                            movementPatternColors: {
                                                                select: { color: true, trainerId: true },
                                                            },
                                                        },
                                                    },
                                                    exerciseMuscleGroups: {
                                                        select: {
                                                            coefficient: true,
                                                            muscleGroup: {
                                                                select: { id: true, name: true },
                                                            },
                                                        },
                                                    },
                                                },
                                            },
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
            }),

            prisma.personalRecord.findMany({
                where: { traineeId: programMeta.traineeId },
                select: { exerciseId: true, reps: true, weight: true, recordDate: true },
            }),
        ])

        if (!program) {
            // Should not happen after ownership check, but guard anyway
            return apiError('NOT_FOUND', 'Program not found', 404, undefined, 'program.notFound')
        }

        // estimatedOneRMByExercise[exerciseId] = 1RM of the most recent PR
        const estimatedOneRMByExercise = latestNormalizedOneRMByExercise(records)

        return apiSuccess({ program, estimatedOneRMByExercise })
    } catch (error) {
        return handleApiError(error, {
            logMessage: 'Error fetching program for review',
            message: 'Failed to fetch program review',
            key: 'internal.default',
            context: { programId },
        })
    }
}
