import type { RestTime, WeekType } from '@prisma/client'
import type { ExerciseType } from '@/lib/exercise-type'
import type { BallastDisplay } from '@/lib/bodyweight-load'
import type { ProgramPdfData, ProgramPdfExercise } from '@/lib/program-pdf-export'

export interface PdfSourceExercise {
    id: string
    variant: string | null
    sets: number
    reps: string
    targetRpe: number | null
    weightType: ProgramPdfExercise['weightType']
    weight: number | null
    effectiveWeight: number | null
    rpeWeightMin: number | null
    rpeWeightMax: number | null
    ballast?: BallastDisplay | null
    restTime: RestTime
    isWarmup: boolean
    isJumpSet?: boolean | null
    isSuperSet?: boolean | null
    exercise: { name: string; type: ExerciseType }
}

export interface PdfSourceWorkout {
    id: string
    dayIndex: number
    exercises: PdfSourceExercise[]
}

interface PdfSourceProgramBase<TWorkout> {
    title: string
    startDate: string
    trainee?: { firstName: string; lastName: string } | null
    trainer: { firstName: string; lastName: string }
    weeks: Array<{ weekNumber: number; weekType: WeekType; workouts: TWorkout[] }>
}

export type PdfSourceProgram = PdfSourceProgramBase<PdfSourceWorkout>

/** GET /api/programs/[id] payload: workouts carry `workoutExercises`. */
export type ApiProgramForPdf = PdfSourceProgramBase<{
    id: string
    dayIndex: number
    workoutExercises: PdfSourceExercise[]
}>

export interface BuildProgramPdfDataOptions {
    unknownTraineeName: string
    ballastLabel: (ballast: BallastDisplay) => string
}

/** Maps a program to the athlete PDF data (no sorting: input order is kept). */
export function buildProgramPdfData(
    program: PdfSourceProgram,
    options: BuildProgramPdfDataOptions
): ProgramPdfData {
    return {
        title: program.title,
        traineeName: program.trainee
            ? `${program.trainee.firstName} ${program.trainee.lastName}`
            : options.unknownTraineeName,
        trainerName: `${program.trainer.firstName} ${program.trainer.lastName}`,
        startDate: program.startDate,
        weeks: program.weeks.map((week) => ({
            weekNumber: week.weekNumber,
            weekType: week.weekType,
            workouts: week.workouts.map((workout) => ({
                id: workout.id,
                dayIndex: workout.dayIndex,
                exercises: workout.exercises.map((exercise) => ({
                    id: exercise.id,
                    name: exercise.exercise.name,
                    variant: exercise.variant,
                    type: exercise.exercise.type,
                    isWarmup: exercise.isWarmup,
                    isJumpSet: Boolean(exercise.isJumpSet),
                    isSuperSet: Boolean(exercise.isSuperSet),
                    sets: exercise.sets,
                    reps: exercise.reps,
                    targetRpe: exercise.targetRpe,
                    weightType: exercise.weightType,
                    weight: exercise.weight,
                    effectiveWeight: exercise.effectiveWeight,
                    rpeWeightMin: exercise.rpeWeightMin,
                    rpeWeightMax: exercise.rpeWeightMax,
                    restTime: exercise.restTime,
                    weightLabelOverride: exercise.ballast ? options.ballastLabel(exercise.ballast) : null,
                })),
            })),
        })),
    }
}

export function apiProgramToPdfSource(apiProgram: ApiProgramForPdf): PdfSourceProgram {
    return {
        title: apiProgram.title,
        startDate: apiProgram.startDate,
        trainee: apiProgram.trainee,
        trainer: apiProgram.trainer,
        weeks: apiProgram.weeks.map((week) => ({
            weekNumber: week.weekNumber,
            weekType: week.weekType,
            workouts: week.workouts.map((workout) => ({
                id: workout.id,
                dayIndex: workout.dayIndex,
                exercises: workout.workoutExercises,
            })),
        })),
    }
}
