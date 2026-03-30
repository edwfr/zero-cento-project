import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/lib/api-response'
import { requireRole } from '@/lib/auth'
import { exerciseSchema, exerciseFilterSchema } from '@/schemas/exercise'
import { logger } from '@/lib/logger'

/**
 * GET /api/exercises
 * List exercises with filtering and cursor-based pagination
 */
export async function GET(request: NextRequest) {
    try {
        await requireRole(['admin', 'trainer', 'trainee'])

        const { searchParams } = new URL(request.url)

        // Parse query parameters
        const filterParams = {
            type: searchParams.get('type') || undefined,
            movementPatternId: searchParams.get('movementPatternId') || undefined,
            muscleGroupId: searchParams.get('muscleGroupId') || undefined,
            search: searchParams.get('search') || undefined,
            cursor: searchParams.get('cursor') || undefined,
            limit: parseInt(searchParams.get('limit') || '20'),
        }

        const validation = exerciseFilterSchema.safeParse(filterParams)
        if (!validation.success) {
            return apiError('VALIDATION_ERROR', 'Invalid filter parameters', 400, validation.error.errors)
        }

        const { type, movementPatternId, muscleGroupId, search, cursor, limit } = validation.data

        // Validate search parameter length
        if (search && (search.length < 2 || search.length > 100)) {
            return apiError('VALIDATION_ERROR', 'Search parameter must be between 2 and 100 characters', 400)
        }

        // Build where clause
        const where: any = {}

        if (type) {
            where.type = type
        }

        if (movementPatternId) {
            where.movementPatternId = movementPatternId
        }

        if (muscleGroupId) {
            where.exerciseMuscleGroups = {
                some: {
                    muscleGroupId,
                },
            }
        }

        if (search) {
            where.OR = [
                { name: { contains: search, mode: 'insensitive' } },
                { description: { contains: search, mode: 'insensitive' } },
            ]
        }

        // Cursor pagination
        const exercises = await prisma.exercise.findMany({
            where,
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
                        firstName: true,
                        lastName: true,
                    },
                },
            },
            take: limit + 1, // Fetch one extra to determine if there are more results
            ...(cursor && {
                skip: 1,
                cursor: {
                    id: cursor,
                },
            }),
            orderBy: [
                { type: 'asc' }, // Fundamental first
                { name: 'asc' },
            ],
        })

        const hasMore = exercises.length > limit
        const items = hasMore ? exercises.slice(0, -1) : exercises
        const nextCursor = hasMore ? items[items.length - 1].id : null

        return apiSuccess({
            exercises: items,
            nextCursor,
            hasMore,
        })
    } catch (error: any) {
        if (error instanceof Response) return error
        logger.error({ error }, 'Error fetching exercises')
        return apiError('INTERNAL_ERROR', 'Failed to fetch exercises', 500)
    }
}

/**
 * POST /api/exercises
 * Create new exercise (admin/trainer only)
 */
export async function POST(request: NextRequest) {
    try {
        const session = await requireRole(['admin', 'trainer'])
        const body = await request.json()

        const validation = exerciseSchema.safeParse(body)
        if (!validation.success) {
            return apiError('VALIDATION_ERROR', 'Invalid input', 400, validation.error.errors)
        }

        const { name, description, youtubeUrl, type, movementPatternId, muscleGroups, notes } = validation.data

        // Check if exercise name already exists
        const existing = await prisma.exercise.findFirst({
            where: {
                name: {
                    equals: name,
                    mode: 'insensitive',
                },
            },
        })

        if (existing) {
            return apiError('CONFLICT', 'Exercise with this name already exists', 409)
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

        // Validate coefficients sum (must be between 0.1 and 3.0)
        const totalCoefficient = muscleGroups.reduce((sum, mg) => sum + mg.coefficient, 0)
        if (totalCoefficient < 0.1 || totalCoefficient > 3.0) {
            return apiError(
                'VALIDATION_ERROR',
                `Total coefficient must be between 0.1 and 3.0 (got ${totalCoefficient.toFixed(2)})`,
                400
            )
        }

        // Create exercise with muscle groups
        const exercise = await prisma.exercise.create({
            data: {
                name,
                description,
                youtubeUrl,
                type,
                movementPatternId,
                notes: notes || [],
                createdBy: session.user.id,
                exerciseMuscleGroups: {
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
                },
            },
        })

        logger.info({ exerciseId: exercise.id, name: exercise.name }, 'Exercise created')

        return apiSuccess({ exercise }, 201)
    } catch (error: any) {
        if (error instanceof Response) return error
        logger.error({ error }, 'Error creating exercise')
        return apiError('INTERNAL_ERROR', 'Failed to create exercise', 500)
    }
}
