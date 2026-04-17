import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/lib/api-response'
import { requireRole } from '@/lib/auth'
import { logger } from '@/lib/logger'
import { z } from 'zod'

const completeSchema = z.object({
    completionReason: z.string().max(500).optional(),
})

/**
 * POST /api/programs/[id]/complete
 * Manually mark a program as completed
 * Business logic:
 * - Set status to 'completed'
 * - Set completedAt timestamp
 * - Optionally save completionReason
 * RBAC: only trainer owner or admin
 */
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id: programId } = await params
    try {
        const session = await requireRole(['admin', 'trainer'])
        const body = await request.json()

        const validation = completeSchema.safeParse(body)
        if (!validation.success) {
            return apiError('VALIDATION_ERROR', 'Invalid input', 400, validation.error.errors, 'validation.invalidInput')
        }

        const { completionReason } = validation.data

        // Verify program exists and check ownership
        const program = await prisma.trainingProgram.findUnique({
            where: { id: programId },
            select: {
                id: true,
                trainerId: true,
                status: true,
            },
        })

        if (!program) {
            return apiError('NOT_FOUND', 'Program not found', 404, undefined, 'program.notFound')
        }

        // Check ownership (admin can complete any program)
        if (session.user.role === 'trainer' && program.trainerId !== session.user.id) {
            return apiError('FORBIDDEN', 'You can only complete your own programs', 403, undefined, 'program.completeDenied')
        }

        // Check if program is active (can't complete draft or already completed)
        if (program.status === 'draft') {
            return apiError('VALIDATION_ERROR', 'Cannot complete a draft program. Publish it first.', 400, undefined, 'program.cannotCompleteDraft')
        }

        if (program.status === 'completed') {
            return apiError('VALIDATION_ERROR', 'Program is already completed', 400, undefined, 'program.alreadyCompleted')
        }

        // Update program status to completed
        const updatedProgram = await prisma.trainingProgram.update({
            where: { id: programId },
            data: {
                status: 'completed',
                completedAt: new Date(),
                completionReason: completionReason || null,
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
                    select: {
                        id: true,
                        weekNumber: true,
                        weekType: true,
                        startDate: true,
                    },
                    orderBy: { weekNumber: 'asc' },
                },
            },
        })

        logger.info(
            {
                programId,
                trainerId: program.trainerId,
                completionReason: completionReason || 'No reason provided',
            },
            'Program manually completed by trainer'
        )

        return apiSuccess({ program: updatedProgram }, 200)
    } catch (error: any) {
        if (error instanceof Response) return error
        logger.error({ error, programId }, 'Error completing program')
        return apiError('INTERNAL_ERROR', 'Failed to complete program', 500, undefined, 'internal.default')
    }
}
