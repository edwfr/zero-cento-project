import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/lib/api-response'
import { requireTrainerProgramOwnership } from '@/lib/auth'
import { putSkeletonSchema } from '@/schemas/skeleton'
import { logger } from '@/lib/logger'

/**
 * PUT /api/programs/[id]/skeleton
 * Bulk replace skeleton for a draft program
 * Only trainers can modify; status must be 'draft'
 */
export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id: programId } = await params
    try {
        // 1. Auth + ownership check
        const session = await requireTrainerProgramOwnership(programId)

        // 2. Check program status
        const program = await prisma.trainingProgram.findUnique({
            where: { id: programId },
            select: { id: true, status: true, workoutsPerWeek: true },
        })

        if (!program) {
            return apiError('NOT_FOUND', 'Program not found', 404, undefined, 'program.notFound')
        }

        if (program.status !== 'draft') {
            return apiError(
                'FORBIDDEN',
                'Skeleton can only be modified for draft programs',
                403,
                undefined,
                'program.skeletonEditDenied'
            )
        }

        // 3. Parse and validate input
        const body = await request.json()
        const validation = putSkeletonSchema.safeParse(body)

        if (!validation.success) {
            return apiError(
                'VALIDATION_ERROR',
                'Invalid skeleton payload',
                400,
                validation.error.flatten(),
                'validation.invalidSkeleton'
            )
        }

        const { rows } = validation.data

        // 4. Validate dayIndex range
        for (const row of rows) {
            if (row.dayIndex >= program.workoutsPerWeek) {
                return apiError(
                    'VALIDATION_ERROR',
                    `dayIndex ${row.dayIndex} exceeds workoutsPerWeek ${program.workoutsPerWeek}`,
                    400,
                    undefined,
                    'validation.dayIndexOutOfRange'
                )
            }
        }

        // 5. Verify exercises exist
        if (rows.length > 0) {
            const exerciseIds = [...new Set(rows.map((r) => r.exerciseId))]
            const exercises = await prisma.exercise.findMany({
                where: { id: { in: exerciseIds } },
                select: { id: true },
            })

            if (exercises.length !== exerciseIds.length) {
                return apiError(
                    'NOT_FOUND',
                    'One or more exercises not found',
                    404,
                    undefined,
                    'validation.exerciseNotFound'
                )
            }
        }

        // 6. Bulk replace: delete all + insert new (atomic transaction)
        const skeleton = await prisma.$transaction(async (tx) => {
            // Delete existing skeleton
            await tx.workoutSkeleton.deleteMany({
                where: { programId },
            })

            // Insert new rows
            if (rows.length > 0) {
                await tx.workoutSkeleton.createMany({
                    data: rows.map((row) => ({
                        programId,
                        dayIndex: row.dayIndex,
                        order: row.order,
                        exerciseId: row.exerciseId,
                    })),
                })
            }

            // Fetch back the new skeleton
            return tx.workoutSkeleton.findMany({
                where: { programId },
                select: {
                    id: true,
                    dayIndex: true,
                    order: true,
                    exerciseId: true,
                    createdAt: true,
                },
                orderBy: [{ dayIndex: 'asc' }, { order: 'asc' }],
            })
        })

        return apiSuccess({ skeleton })
    } catch (error: any) {
        if (error instanceof Response) return error
        logger.error({ error, programId }, 'Error updating program skeleton')
        return apiError(
            'INTERNAL_ERROR',
            'Failed to update skeleton',
            500,
            undefined,
            'internal.default'
        )
    }
}
