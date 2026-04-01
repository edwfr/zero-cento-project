import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/lib/api-response'
import { requireRole } from '@/lib/auth'
import { createProgramSchema } from '@/schemas/program'
import { logger } from '@/lib/logger'

/**
 * GET /api/programs
 * List programs with cursor-based pagination
 * Query params: trainerId, traineeId, status, search, cursor
 * RBAC: Admin sees all, Trainer sees only own, Trainee sees only assigned
 */
export async function GET(request: NextRequest) {
    try {
        const session = await requireRole(['admin', 'trainer', 'trainee'])

        const { searchParams } = new URL(request.url)

        const trainerId = searchParams.get('trainerId') || undefined
        const traineeId = searchParams.get('traineeId') || undefined
        const status = searchParams.get('status') || undefined
        const search = searchParams.get('search') || undefined
        const cursor = searchParams.get('cursor') || undefined
        const limit = parseInt(searchParams.get('limit') || '20')

        // Validate search parameter length
        if (search && (search.length < 2 || search.length > 100)) {
            return apiError('VALIDATION_ERROR', 'Search parameter must be between 2 and 100 characters', 400, undefined, 'validation.searchLength')
        }

        // Build where clause based on RBAC
        const where: any = {}

        if (session.user.role === 'trainer') {
            // Trainers see only their own programs
            where.trainerId = session.user.id
        } else if (session.user.role === 'trainee') {
            // Trainees see only programs assigned to them
            where.traineeId = session.user.id
        }
        // Admin sees all programs (no additional filter)

        // Apply additional filters
        if (trainerId) {
            where.trainerId = trainerId
        }

        if (traineeId) {
            where.traineeId = traineeId
        }

        if (status) {
            where.status = status
        }

        if (search) {
            where.title = {
                contains: search,
                mode: 'insensitive',
            }
        }

        // Fetch programs with cursor pagination
        const programs = await prisma.trainingProgram.findMany({
            where,
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
                    },
                    orderBy: {
                        weekNumber: 'asc',
                    },
                },
            },
            take: limit + 1,
            ...(cursor && {
                skip: 1,
                cursor: {
                    id: cursor,
                },
            }),
            orderBy: [
                { createdAt: 'desc' },
            ],
        })

        const hasMore = programs.length > limit
        const items = hasMore ? programs.slice(0, -1) : programs
        const nextCursor = hasMore ? items[items.length - 1].id : null

        return apiSuccess({
            items,
            pagination: {
                nextCursor,
                hasMore,
            },
        })
    } catch (error: any) {
        if (error instanceof Response) return error
        logger.error({ error }, 'Error fetching programs')
        return apiError('INTERNAL_ERROR', 'Failed to fetch programs', 500, undefined, 'internal.default')
    }
}

/**
 * POST /api/programs
 * Create new program (status=draft)
 * Automatically creates Weeks and empty Workouts based on durationWeeks and workoutsPerWeek
 */
export async function POST(request: NextRequest) {
    try {
        const session = await requireRole(['admin', 'trainer'])
        const body = await request.json()

        const validation = createProgramSchema.safeParse(body)
        if (!validation.success) {
            return apiError('VALIDATION_ERROR', 'Invalid input', 400, validation.error.errors, 'validation.invalidInput')
        }

        const { title, traineeId, durationWeeks, workoutsPerWeek } = validation.data

        // Verify trainee exists and is a trainee role
        const trainee = await prisma.user.findUnique({
            where: { id: traineeId },
        })

        if (!trainee) {
            return apiError('NOT_FOUND', 'Trainee not found', 404, undefined, 'trainee.notFound')
        }

        if (trainee.role !== 'trainee') {
            return apiError('VALIDATION_ERROR', 'User must have trainee role', 400, undefined, 'validation.userMustBeTrainee')
        }

        // If session user is trainer, verify they own/manage this trainee
        // Note: Trainee ownership is managed via TrainerTrainee table
        if (session.user.role === 'trainer') {
            const trainerRelation = await prisma.trainerTrainee.findFirst({
                where: {
                    trainerId: session.user.id,
                    traineeId,
                },
            })
            if (!trainerRelation) {
                return apiError('FORBIDDEN', 'You can only create programs for your own trainees', 403, undefined, 'program.createDenied')
            }
        }

        // Create program with nested weeks and workouts
        const weeksData = []
        for (let i = 1; i <= durationWeeks; i++) {
            const workoutsData = []
            for (let j = 1; j <= workoutsPerWeek; j++) {
                workoutsData.push({
                    dayIndex: j,
                })
            }

            weeksData.push({
                weekNumber: i,
                weekType: 'normal' as const,
                workouts: {
                    create: workoutsData,
                },
            })
        }

        // Get trainer ID from relation or use session user
        let actualTrainerId = session.user.id
        if (session.user.role === 'admin') {
            const trainerRelation = await prisma.trainerTrainee.findUnique({
                where: { traineeId },
            })
            if (trainerRelation) {
                actualTrainerId = trainerRelation.trainerId
            }
        }

        const program = await prisma.trainingProgram.create({
            data: {
                title,
                trainerId: actualTrainerId,
                traineeId,
                durationWeeks,
                workoutsPerWeek,
                status: 'draft',
                weeks: {
                    create: weeksData,
                },
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

        logger.info(
            {
                programId: program.id,
                trainerId: program.trainerId,
                traineeId: program.traineeId,
            },
            'Program created successfully'
        )

        return apiSuccess({ program }, 201)
    } catch (error: any) {
        if (error instanceof Response) return error
        logger.error({ error }, 'Error creating program')
        return apiError('INTERNAL_ERROR', 'Failed to create program', 500, undefined, 'internal.default')
    }
}
