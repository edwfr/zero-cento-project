import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/lib/api-response'
import { requireRole } from '@/lib/auth'
import { personalRecordSchema } from '@/schemas/personal-record'
import { logger } from '@/lib/logger'

/**
 * GET /api/personal-records
 * List personal records (trainee's max lifts)
 * Query params: traineeId, exerciseId, limit
 * RBAC: trainer sees only own trainees, trainee sees only own
 */
export async function GET(request: NextRequest) {
    try {
        const session = await requireRole(['admin', 'trainer', 'trainee'])

        const { searchParams } = new URL(request.url)

        const traineeId = searchParams.get('traineeId') || undefined
        const exerciseId = searchParams.get('exerciseId') || undefined
        const limitParam = searchParams.get('limit')
        const limit = limitParam ? parseInt(limitParam, 10) : undefined

        // Build where clause based on RBAC
        const where: any = {}

        if (session.user.role === 'trainee') {
            // Trainees see only their own records
            where.traineeId = session.user.id
        } else if (session.user.role === 'trainer') {
            if (traineeId) {
                // Single query: verify ownership and filter in one shot
                const relation = await prisma.trainerTrainee.findFirst({
                    where: { trainerId: session.user.id, traineeId },
                })
                if (!relation) {
                    return apiError('FORBIDDEN', 'Access denied', 403, undefined, 'auth.accessDenied')
                }
                where.traineeId = traineeId
            } else {
                // Trainer sees all their trainees' records
                const traineeRelations = await prisma.trainerTrainee.findMany({
                    where: { trainerId: session.user.id },
                    select: { traineeId: true },
                })
                where.traineeId = { in: traineeRelations.map((t) => t.traineeId) }
            }
        }
        // Admin sees all records

        if (session.user.role === 'admin' && traineeId) {
            where.traineeId = traineeId
        }

        if (exerciseId) {
            where.exerciseId = exerciseId
        }

        const records = await prisma.personalRecord.findMany({
            where,
            include: {
                exercise: {
                    select: {
                        id: true,
                        name: true,
                        type: true,
                        movementPattern: {
                            select: {
                                id: true,
                                name: true,
                            },
                        },
                    },
                },
                trainee: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                    },
                },
            },
            orderBy: limit
                ? [{ recordDate: 'desc' }]
                : [
                    { exercise: { name: 'asc' } },
                    { recordDate: 'desc' },
                ],
            ...(limit ? { take: limit } : {}),
        })

        return apiSuccess({ items: records })
    } catch (error: any) {
        if (error instanceof Response) return error
        logger.error({ error }, 'Error fetching personal records')
        return apiError('INTERNAL_ERROR', 'Failed to fetch personal records', 500, undefined, 'internal.default')
    }
}

/**
 * POST /api/personal-records
 * Create personal record for trainee
 * Body: { exerciseId, reps, weight, recordDate, notes?, traineeId }
 * RBAC: only trainers can create for their trainees; admins can create for anyone
 */
export async function POST(request: NextRequest) {
    try {
        const session = await requireRole(['admin', 'trainer'])
        const body = await request.json()

        const validation = personalRecordSchema.safeParse(body)
        if (!validation.success) {
            return apiError('VALIDATION_ERROR', 'Invalid input', 400, validation.error.errors, 'validation.invalidInput')
        }

        const { exerciseId, reps, weight, recordDate, notes } = validation.data

        const traineeId = body.traineeId
        if (!traineeId) {
            return apiError('VALIDATION_ERROR', 'traineeId is required for trainer/admin requests', 400, undefined, 'validation.traineeIdRequired')
        }

        // For trainers, verify they manage this trainee
        if (session.user.role === 'trainer') {
            const relation = await prisma.trainerTrainee.findFirst({
                where: { trainerId: session.user.id, traineeId },
            })
            if (!relation) {
                return apiError('FORBIDDEN', 'You can only create records for your own trainees', 403, undefined, 'personalRecord.createDenied')
            }
        }

        // Verify trainee exists and is a trainee
        const trainee = await prisma.user.findUnique({
            where: { id: traineeId },
        })

        if (!trainee) {
            return apiError('NOT_FOUND', 'Trainee not found', 404, undefined, 'trainee.notFound')
        }

        if (trainee.role !== 'trainee') {
            return apiError('VALIDATION_ERROR', 'User must have trainee role', 400, undefined, 'validation.userMustBeTrainee')
        }

        // Verify exercise exists
        const exercise = await prisma.exercise.findUnique({
            where: { id: exerciseId },
        })

        if (!exercise) {
            return apiError('NOT_FOUND', 'Exercise not found', 404, undefined, 'exercise.notFound')
        }

        // Create new personal record
        const record = await prisma.personalRecord.create({
            data: {
                traineeId,
                exerciseId,
                reps,
                weight,
                recordDate: recordDate ? new Date(recordDate) : new Date(),
                notes,
            },
            include: {
                exercise: {
                    select: {
                        id: true,
                        name: true,
                        type: true,
                        movementPattern: {
                            select: {
                                id: true,
                                name: true,
                            },
                        },
                    },
                },
                trainee: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                    },
                },
            },
        })

        logger.info(
            {
                recordId: record.id,
                traineeId,
                exerciseId,
                reps,
                weight,
                userId: session.user.id,
            },
            'Personal record created'
        )

        return apiSuccess({ record }, 201)
    } catch (error: any) {
        if (error instanceof Response) return error
        logger.error({ error }, 'Error creating personal record')
        return apiError('INTERNAL_ERROR', 'Failed to create personal record', 500, undefined, 'internal.default')
    }
}
