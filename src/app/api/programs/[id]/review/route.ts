import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/lib/api-response'
import { requireRole } from '@/lib/auth'
import { logger } from '@/lib/logger'

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
 * - PR aggregation (best weight per exerciseId×reps) is done at DB level
 *   with a single GROUP BY query, replacing three client-side useMemo chains.
 * - Returns pre-computed `estimatedOneRMByExercise` and
 *   `bestWeightByExerciseAndReps` ready for the client to consume directly.
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

        // Step 2 — fetch program tree and best PRs in parallel
        const [program, bestPRRows] = await Promise.all([
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

            // DB-side aggregation: best weight per (exerciseId, reps) combination.
            // Replaces fetchAll → groupBy → reduce chains on the client.
            prisma.$queryRaw<
                Array<{ exerciseId: string; reps: bigint; maxWeight: number }>
            >`
                SELECT
                    "exerciseId",
                    reps,
                    MAX(weight) AS "maxWeight"
                FROM personal_records
                WHERE "traineeId" = ${programMeta.traineeId}
                GROUP BY "exerciseId", reps
            `,
        ])

        if (!program) {
            // Should not happen after ownership check, but guard anyway
            return apiError('NOT_FOUND', 'Program not found', 404, undefined, 'program.notFound')
        }

        // Build pre-aggregated maps — O(n) over the PR rows, done once on server.

        // bestWeightByExerciseAndReps[exerciseId][reps] = maxWeight
        const bestWeightByExerciseAndReps: Record<string, Record<number, number>> = {}
        // estimatedOneRMByExercise[exerciseId] = best estimated 1RM across all rep counts
        const estimatedOneRMByExercise: Record<string, number> = {}

        for (const row of bestPRRows) {
            const exId = row.exerciseId
            const reps = Number(row.reps)
            const weight = Number(row.maxWeight)

            if (!bestWeightByExerciseAndReps[exId]) {
                bestWeightByExerciseAndReps[exId] = {}
            }
            bestWeightByExerciseAndReps[exId][reps] = weight

            const estimated1RM = weight * (1 + reps / 30)
            if (!estimatedOneRMByExercise[exId] || estimated1RM > estimatedOneRMByExercise[exId]) {
                estimatedOneRMByExercise[exId] = estimated1RM
            }
        }

        return apiSuccess({ program, estimatedOneRMByExercise, bestWeightByExerciseAndReps })
    } catch (error: any) {
        if (error instanceof Response) return error
        logger.error({ error, programId }, 'Error fetching program for review')
        return apiError('INTERNAL_ERROR', 'Failed to fetch program review', 500, undefined, 'internal.default')
    }
}
