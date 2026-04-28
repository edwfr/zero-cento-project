import { NextRequest } from 'next/server'
import { requireRole } from '@/lib/auth'
import { apiSuccess, apiError } from '@/lib/api-response'
import { prisma } from '@/lib/prisma'
import { cascadeCompletion } from '@/lib/completion-service'
import { z } from 'zod'
import { logger } from '@/lib/logger'

/**
 * PATCH /api/trainee/workout-exercises/[id]/complete
 *
 * Mark a WorkoutExercise as complete or incomplete, triggering cascade
 * update to parent Workout, Week, and TrainingProgram.
 *
 * **Auth:** trainee only. Trainee must own the program containing the exercise.
 *
 * **Request body:**
 * ```json
 * {
 *   "isCompleted": boolean
 * }
 * ```
 *
 * **Response:** 200 OK with CascadeResult
 * ```json
 * {
 *   "data": {
 *     "workoutExercise": { "id": "...", "isCompleted": true },
 *     "workout": { "id": "...", "isCompleted": true },
 *     "week": { "id": "...", "isCompleted": false },
 *     "program": { "id": "...", "status": "active" }
 *   },
 *   "meta": { "timestamp": "2026-04-28T10:00:00.000Z" }
 * }
 * ```
 */

const patchSchema = z.object({
  isCompleted: z.boolean(),
})

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  try {
    // 1. Auth guard: trainee only
    const session = await requireRole(['trainee'])

    // 2. Validate request body
    const body = await request.json()
    const parsed = patchSchema.safeParse(body)
    if (!parsed.success) {
      return apiError(
        'VALIDATION_ERROR',
        'Invalid input',
        400,
        parsed.error.flatten(),
        'validation.invalid'
      )
    }

    // 3. Ownership check — single findFirst (Rule 3 from backend skill)
    // Verify trainee owns the program containing this workout exercise
    const owns = await prisma.workoutExercise.findFirst({
      where: {
        id,
        workout: {
          week: {
            program: {
              traineeId: session.user.id,
            },
          },
        },
      },
      select: { id: true },
    })

    if (!owns) {
      return apiError(
        'NOT_FOUND',
        'Workout exercise not found',
        404,
        undefined,
        'workoutExercise.notFound'
      )
    }

    // 4. Cascade completion state change
    const result = await cascadeCompletion(id, parsed.data.isCompleted)

    logger.info(
      {
        workoutExerciseId: id,
        isCompleted: parsed.data.isCompleted,
        programStatus: result.program.status,
      },
      'Workout exercise completion updated'
    )

    // 5. Return updated states (Rule 5: mutation returns updated resource)
    return apiSuccess(result)
  } catch (error: any) {
    if (error instanceof Response) return error

    logger.error({ error, workoutExerciseId: id }, 'Error updating exercise completion')
    return apiError(
      'INTERNAL_ERROR',
      'Unexpected error',
      500,
      undefined,
      'internal.default'
    )
  }
}
