import { prisma } from '@/lib/prisma'
import { ProgramStatus } from '@prisma/client'

/**
 * Result of cascading a completion state change from WorkoutExercise upward
 * through Workout → Week → TrainingProgram hierarchy.
 *
 * Contains the updated isCompleted state at each level, plus the program status
 * (draft | active | completed).
 */
export interface CascadeResult {
  workoutExercise: { id: string; isCompleted: boolean }
  workout: { id: string; isCompleted: boolean }
  week: { id: string; weekNumber: number; isCompleted: boolean }
  program: { id: string; status: ProgramStatus }
}

export interface WorkoutCascadeResult {
  workout: { id: string; isCompleted: boolean }
  week: { id: string; weekNumber: number; isCompleted: boolean }
  program: { id: string; status: ProgramStatus }
}

async function cascadeFromWorkout(
  tx: any,
  workoutId: string,
  forcedWorkoutCompleted?: boolean
): Promise<WorkoutCascadeResult> {
  let currentWorkout = await tx.workout.findUnique({
    where: { id: workoutId },
    select: { id: true, weekId: true, isCompleted: true },
  })

  if (!currentWorkout) {
    throw new Error(`Workout not found: ${workoutId}`)
  }

  let workoutIsCompleted = forcedWorkoutCompleted

  if (typeof workoutIsCompleted !== 'boolean') {
    const incompleteCount = await tx.workoutExercise.count({
      where: { workoutId, isCompleted: false },
    })
    const totalCount = await tx.workoutExercise.count({
      where: { workoutId },
    })

    workoutIsCompleted = totalCount > 0 && incompleteCount === 0
  }

  let updatedWorkout = currentWorkout
  if (currentWorkout.isCompleted !== workoutIsCompleted) {
    updatedWorkout = await tx.workout.update({
      where: { id: workoutId },
      data: { isCompleted: workoutIsCompleted },
      select: { id: true, weekId: true, isCompleted: true },
    })
  }

  const weekId = updatedWorkout.weekId

  const [incompleteWorkoutCount, totalWorkoutCount] = await Promise.all([
    tx.workout.count({
      where: { weekId, isCompleted: false, workoutExercises: { some: {} } },
    }),
    tx.workout.count({
      where: { weekId, workoutExercises: { some: {} } },
    }),
  ])

  const weekIsCompleted = totalWorkoutCount > 0 && incompleteWorkoutCount === 0

  const currentWeek = await tx.week.findUnique({
    where: { id: weekId },
    select: { id: true, weekNumber: true, programId: true, isCompleted: true },
  })

  if (!currentWeek) {
    throw new Error(`Week not found: ${weekId}`)
  }

  let updatedWeek = currentWeek
  if (currentWeek.isCompleted !== weekIsCompleted) {
    updatedWeek = await tx.week.update({
      where: { id: weekId },
      data: { isCompleted: weekIsCompleted },
      select: { id: true, weekNumber: true, programId: true, isCompleted: true },
    })
  }

  const programId = updatedWeek.programId

  const [incompleteWeekCount, totalWeekCount] = await Promise.all([
    tx.week.count({
      where: {
        programId,
        isCompleted: false,
        workouts: { some: { workoutExercises: { some: {} } } },
      },
    }),
    tx.week.count({
      where: {
        programId,
        workouts: { some: { workoutExercises: { some: {} } } },
      },
    }),
  ])

  const programIsCompleted = totalWeekCount > 0 && incompleteWeekCount === 0

  const currentProgram = await tx.trainingProgram.findUnique({
    where: { id: programId },
    select: { id: true, status: true },
  })

  if (!currentProgram) {
    throw new Error(`TrainingProgram not found: ${programId}`)
  }

  let newProgramStatus = currentProgram.status
  if (programIsCompleted && currentProgram.status !== 'draft') {
    newProgramStatus = 'completed'
  } else if (!programIsCompleted && currentProgram.status === 'completed') {
    newProgramStatus = 'active'
  }

  let updatedProgram = currentProgram
  if (
    currentProgram.status !== newProgramStatus ||
    (programIsCompleted && currentProgram.status !== 'draft')
  ) {
    updatedProgram = await tx.trainingProgram.update({
      where: { id: programId },
      data: {
        status: newProgramStatus,
        completedAt: newProgramStatus === 'completed' ? new Date() : null,
      },
      select: { id: true, status: true },
    })
  }

  return {
    workout: {
      id: updatedWorkout.id,
      isCompleted: updatedWorkout.isCompleted,
    },
    week: {
      id: updatedWeek.id,
      weekNumber: updatedWeek.weekNumber,
      isCompleted: updatedWeek.isCompleted,
    },
    program: {
      id: updatedProgram.id,
      status: updatedProgram.status,
    },
  }
}

/**
 * Atomically cascade a completion state change from a single WorkoutExercise
 * up through the hierarchy (Workout → Week → TrainingProgram).
 *
 * **Pattern:** Interactive transaction with guarded conditional updates.
 * Only updates a parent level if its completion state actually changes,
 * reducing unnecessary DB writes.
 *
 * **Cascade rules:**
 * - WorkoutExercise marked → if ALL exercises in workout are completed → Workout completes
 * - Workout completed → if ALL workouts in week are completed → Week completes
 * - Week completed → if ALL weeks in program are completed → Program status → 'completed'
 *
 * **De-completion (reverse cascade):**
 * - WorkoutExercise unmarked → Workout auto-reverts to incomplete (if it was complete)
 * - Cascade continues upward, reverting Week and Program as needed
 * - Program reverts to 'active' (unless in 'draft' — untouched)
 *
 * @param workoutExerciseId - UUID of the WorkoutExercise to toggle
 * @param isCompleted - New completion state (true = mark as done, false = unmark)
 * @returns CascadeResult with updated states at all levels
 * @throws {Error} If workoutExerciseId not found, or DB transaction fails
 */
export async function cascadeCompletion(
  workoutExerciseId: string,
  isCompleted: boolean
): Promise<CascadeResult> {
  const result = await prisma.$transaction(
    async (tx) => {
      // ===== STEP 1: Update WorkoutExercise =====
      const updatedExercise = await tx.workoutExercise.update({
        where: { id: workoutExerciseId },
        data: { isCompleted },
        select: { id: true, workoutId: true },
      })
      const cascade = await cascadeFromWorkout(tx, updatedExercise.workoutId)

      return {
        workoutExercise: {
          id: updatedExercise.id,
          isCompleted,
        },
        ...cascade,
      }
    },
    {
      // Ensure max timeout to prevent long-running transactions
      timeout: 10000,
    }
  )

  return result
}

export async function cascadeWorkoutCompletion(
  workoutId: string,
  isCompleted: boolean
): Promise<WorkoutCascadeResult> {
  return prisma.$transaction(
    async (tx) => cascadeFromWorkout(tx, workoutId, isCompleted),
    {
      timeout: 10000,
    }
  )
}
