import type { WorkoutExercise, PersonalRecord } from '@prisma/client'
import { prisma } from './prisma'

/**
 * Calculate effective weight for a workout exercise
 * Resolves percentage_previous recursively
 */
export async function calculateEffectiveWeight(
  workoutExercise: WorkoutExercise & { exercise?: { id: string } },
  traineeId: string,
  depth = 0
): Promise<number | null> {
  // Prevent infinite recursion
  if (depth > 10) {
    throw new Error('Maximum recursion depth exceeded for percentage_previous')
  }

  switch (workoutExercise.weightType) {
    case 'absolute':
      return workoutExercise.weight

    case 'percentage_1rm': {
      // Find 1RM personal record
      const record = await prisma.personalRecord.findFirst({
        where: {
          traineeId,
          exerciseId: workoutExercise.exerciseId,
          reps: 1,
        },
        orderBy: {
          recordDate: 'desc',
        },
      })

      if (!record) return null
      return (record.weight * (workoutExercise.weight || 0)) / 100
    }

    case 'percentage_rm': {
      // Find nRM personal record based on reps
      // Parse reps (could be "8", "8-10", "6/8")
      const repsMatch = workoutExercise.reps.match(/^\d+/)
      if (!repsMatch) return null
      const targetReps = parseInt(repsMatch[0], 10)

      const record = await prisma.personalRecord.findFirst({
        where: {
          traineeId,
          exerciseId: workoutExercise.exerciseId,
          reps: targetReps,
        },
        orderBy: {
          recordDate: 'desc',
        },
      })

      if (!record) return null
      return (record.weight * (workoutExercise.weight || 0)) / 100
    }

    case 'percentage_previous': {
      // Find previous occurrence of same exercise in same workout
      const previousExercise = await prisma.workoutExercise.findFirst({
        where: {
          workoutId: workoutExercise.workoutId,
          exerciseId: workoutExercise.exerciseId,
          order: {
            lt: workoutExercise.order,
          },
        },
        orderBy: {
          order: 'asc',
        },
      })

      if (!previousExercise) {
        throw new Error('No previous occurrence found for percentage_previous')
      }

      // Recursively resolve base weight
      const baseWeight = await calculateEffectiveWeight(
        previousExercise,
        traineeId,
        depth + 1
      )

      if (baseWeight === null) return null

      // Apply percentage adjustment
      const percentage = workoutExercise.weight || 0
      return baseWeight * (1 + percentage / 100)
    }

    default:
      return null
  }
}

/**
 * Calculate total volume (sets × reps × weight) for a muscle group
 */
export function calculateVolume(
  sets: number,
  reps: number,
  weight: number,
  coefficient: number
): number {
  return sets * reps * weight * coefficient
}

/**
 * Calculate training sets for a muscle group
 * Only counts non-warmup sets
 */
export function calculateTrainingSets(
  sets: number,
  coefficient: number,
  isWarmup: boolean
): number {
  if (isWarmup) return 0
  return sets * coefficient
}

/**
 * Parse reps string to get first number
 * Handles: "8", "8-10", "6/8"
 */
export function parseReps(repsString: string): number {
  const match = repsString.match(/^\d+/)
  return match ? parseInt(match[0], 10) : 0
}

/**
 * Calculate estimated 1RM from nRM using Epley formula
 * 1RM = weight × (1 + reps / 30)
 */
export function estimateOneRM(weight: number, reps: number): number {
  if (reps === 1) return weight
  return weight * (1 + reps / 30)
}
