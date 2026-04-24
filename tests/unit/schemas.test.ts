import { describe, it, expect } from 'vitest'
import {
    exerciseSchema,
    updateExerciseSchema,
    muscleGroupAssignmentSchema,
} from '@/schemas/exercise'
import {
    createProgramSchema,
    updateProgramSchema,
    publishProgramSchema,
} from '@/schemas/program'
import {
    createUserSchema,
    passwordSchema,
    changePasswordSchema,
    loginSchema,
} from '@/schemas/user'

// ─── Exercise Schema ──────────────────────────────────────────────────────────

describe('muscleGroupAssignmentSchema', () => {
    it('accepts valid assignment', () => {
        const result = muscleGroupAssignmentSchema.safeParse({
            muscleGroupId: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
            coefficient: 0.7,
        })
        expect(result.success).toBe(true)
    })

    it('rejects coefficient > 1', () => {
        const result = muscleGroupAssignmentSchema.safeParse({
            muscleGroupId: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
            coefficient: 1.5,
        })
        expect(result.success).toBe(false)
    })

    it('rejects coefficient < 0', () => {
        const result = muscleGroupAssignmentSchema.safeParse({
            muscleGroupId: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
            coefficient: -0.1,
        })
        expect(result.success).toBe(false)
    })

    it('rejects invalid UUID', () => {
        const result = muscleGroupAssignmentSchema.safeParse({
            muscleGroupId: 'not-a-uuid',
            coefficient: 0.5,
        })
        expect(result.success).toBe(false)
    })
})

const validExercise = {
    name: 'Squat',
    description: 'Compound leg exercise',
    youtubeUrl: 'https://www.youtube.com/watch?v=aclHkVaku9U',
    type: 'fundamental' as const,
    movementPatternId: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
    muscleGroups: [
        { muscleGroupId: '3fa85f64-5717-4562-b3fc-2c963f66afa6', coefficient: 1.0 },
    ],
}

describe('exerciseSchema', () => {
    it('accepts valid exercise', () => {
        expect(exerciseSchema.safeParse(validExercise).success).toBe(true)
    })

    it('rejects name shorter than 3 characters', () => {
        const result = exerciseSchema.safeParse({ ...validExercise, name: 'Ab' })
        expect(result.success).toBe(false)
    })

    it('rejects name longer than 100 characters', () => {
        const result = exerciseSchema.safeParse({ ...validExercise, name: 'A'.repeat(101) })
        expect(result.success).toBe(false)
    })

    it('rejects non-YouTube URL', () => {
        const result = exerciseSchema.safeParse({
            ...validExercise,
            youtubeUrl: 'https://vimeo.com/123',
        })
        expect(result.success).toBe(false)
    })

    it('accepts youtu.be short links', () => {
        const result = exerciseSchema.safeParse({
            ...validExercise,
            youtubeUrl: 'https://youtu.be/aclHkVaku9U',
        })
        expect(result.success).toBe(true)
    })

    it('rejects invalid type', () => {
        const result = exerciseSchema.safeParse({ ...validExercise, type: 'compound' })
        expect(result.success).toBe(false)
    })

    it('rejects empty muscleGroups array', () => {
        const result = exerciseSchema.safeParse({ ...validExercise, muscleGroups: [] })
        expect(result.success).toBe(false)
    })

    it('accepts "accessory" type', () => {
        const result = exerciseSchema.safeParse({ ...validExercise, type: 'accessory' })
        expect(result.success).toBe(true)
    })
})

describe('updateExerciseSchema', () => {
    it('accepts empty object (all fields optional)', () => {
        expect(updateExerciseSchema.safeParse({}).success).toBe(true)
    })

    it('accepts partial update with just name', () => {
        const result = updateExerciseSchema.safeParse({ name: 'Deadlift' })
        expect(result.success).toBe(true)
    })
})

// ─── Program Schema ──────────────────────────────────────────────────────────

const validProgram = {
    title: 'Powerlifting Block 1',
    traineeId: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
    durationWeeks: 8,
    workoutsPerWeek: 4,
}

describe('createProgramSchema', () => {
    it('accepts valid program', () => {
        expect(createProgramSchema.safeParse(validProgram).success).toBe(true)
    })

    it('rejects title shorter than 3 characters', () => {
        const result = createProgramSchema.safeParse({ ...validProgram, title: 'PB' })
        expect(result.success).toBe(false)
    })

    it('rejects durationWeeks = 0', () => {
        const result = createProgramSchema.safeParse({ ...validProgram, durationWeeks: 0 })
        expect(result.success).toBe(false)
    })

    it('rejects durationWeeks > 52', () => {
        const result = createProgramSchema.safeParse({ ...validProgram, durationWeeks: 53 })
        expect(result.success).toBe(false)
    })

    it('rejects workoutsPerWeek = 0', () => {
        const result = createProgramSchema.safeParse({ ...validProgram, workoutsPerWeek: 0 })
        expect(result.success).toBe(false)
    })

    it('rejects workoutsPerWeek > 7', () => {
        const result = createProgramSchema.safeParse({ ...validProgram, workoutsPerWeek: 8 })
        expect(result.success).toBe(false)
    })

    it('rejects non-integer durationWeeks', () => {
        const result = createProgramSchema.safeParse({ ...validProgram, durationWeeks: 4.5 })
        expect(result.success).toBe(false)
    })

    it('rejects invalid traineeId UUID', () => {
        const result = createProgramSchema.safeParse({ ...validProgram, traineeId: 'abc-123' })
        expect(result.success).toBe(false)
    })
})

describe('updateProgramSchema', () => {
    it('accepts empty object', () => {
        expect(updateProgramSchema.safeParse({}).success).toBe(true)
    })

    it('validates fields when provided', () => {
        const result = updateProgramSchema.safeParse({ durationWeeks: 0 })
        expect(result.success).toBe(false)
    })
})

describe('publishProgramSchema', () => {
    it('accepts ISO date string', () => {
        const result = publishProgramSchema.safeParse({
            week1StartDate: '2026-04-01T00:00:00.000Z',
        })
        expect(result.success).toBe(true)
    })

    it('rejects missing week1StartDate', () => {
        const result = publishProgramSchema.safeParse({})
        expect(result.success).toBe(false)
    })
})

// ─── User Schema ─────────────────────────────────────────────────────────────

describe('passwordSchema', () => {
    it('accepts strong password', () => {
        expect(passwordSchema.safeParse('Secret123').success).toBe(true)
    })

    it('rejects password shorter than 8 chars', () => {
        expect(passwordSchema.safeParse('Abc123').success).toBe(false)
    })

    it('rejects password without uppercase', () => {
        expect(passwordSchema.safeParse('secret123').success).toBe(false)
    })

    it('rejects password without lowercase', () => {
        expect(passwordSchema.safeParse('SECRET123').success).toBe(false)
    })

    it('rejects password without numbers', () => {
        expect(passwordSchema.safeParse('SecretPass').success).toBe(false)
    })
})

const validUser = {
    email: 'mario.rossi@example.com',
    firstName: 'Mario',
    lastName: 'Rossi',
    role: 'trainer' as const,
}

describe('createUserSchema', () => {
    it('accepts valid user', () => {
        expect(createUserSchema.safeParse(validUser).success).toBe(true)
    })

    it('rejects invalid email', () => {
        const result = createUserSchema.safeParse({ ...validUser, email: 'not-an-email' })
        expect(result.success).toBe(false)
    })

    it('rejects firstName shorter than 2 characters', () => {
        const result = createUserSchema.safeParse({ ...validUser, firstName: 'M' })
        expect(result.success).toBe(false)
    })

    it('rejects invalid role', () => {
        const result = createUserSchema.safeParse({ ...validUser, role: 'superadmin' })
        expect(result.success).toBe(false)
    })

    it('accepts admin, trainer, trainee roles', () => {
        expect(createUserSchema.safeParse({ ...validUser, role: 'admin' }).success).toBe(true)
        expect(createUserSchema.safeParse({ ...validUser, role: 'trainer' }).success).toBe(true)
        expect(createUserSchema.safeParse({ ...validUser, role: 'trainee' }).success).toBe(true)
    })
})

describe('changePasswordSchema', () => {
    it('accepts valid password change', () => {
        const result = changePasswordSchema.safeParse({
            currentPassword: 'OldPass1',
            newPassword: 'NewPass1',
            confirmPassword: 'NewPass1',
        })
        expect(result.success).toBe(true)
    })

    it('rejects when passwords do not match', () => {
        const result = changePasswordSchema.safeParse({
            currentPassword: 'OldPass1',
            newPassword: 'NewPass1',
            confirmPassword: 'DifferentPass1',
        })
        expect(result.success).toBe(false)
        if (!result.success) {
            const confirmError = result.error.issues.find((i) =>
                i.path.includes('confirmPassword')
            )
            expect(confirmError).toBeDefined()
        }
    })

    it('rejects weak new password', () => {
        const result = changePasswordSchema.safeParse({
            currentPassword: 'OldPass1',
            newPassword: 'weak',
            confirmPassword: 'weak',
        })
        expect(result.success).toBe(false)
    })
})

describe('loginSchema', () => {
    it('accepts valid credentials', () => {
        const result = loginSchema.safeParse({
            email: 'admin@zerocento.it',
            password: 'anypassword',
        })
        expect(result.success).toBe(true)
    })

    it('rejects empty password', () => {
        const result = loginSchema.safeParse({ email: 'admin@zerocento.it', password: '' })
        expect(result.success).toBe(false)
    })

    it('rejects invalid email', () => {
        const result = loginSchema.safeParse({ email: 'bademail', password: 'password' })
        expect(result.success).toBe(false)
    })
})

// ─── MovementPattern Schema ───────────────────────────────────────────────────

import {
    movementPatternSchema,
    updateMovementPatternSchema,
    movementPatternColorSchema,
} from '@/schemas/movement-pattern'

describe('movementPatternSchema', () => {
    it('accepts valid movement pattern', () => {
        const result = movementPatternSchema.safeParse({ name: 'Spinta Orizzontale', description: 'Bench press variants' })
        expect(result.success).toBe(true)
    })

    it('rejects name shorter than 2 chars', () => {
        const result = movementPatternSchema.safeParse({ name: 'S' })
        expect(result.success).toBe(false)
    })

    it('rejects name longer than 50 chars', () => {
        const result = movementPatternSchema.safeParse({ name: 'A'.repeat(51) })
        expect(result.success).toBe(false)
    })

    it('accepts pattern without description', () => {
        const result = movementPatternSchema.safeParse({ name: 'Squat' })
        expect(result.success).toBe(true)
    })

    it('rejects description longer than 200 chars', () => {
        const result = movementPatternSchema.safeParse({ name: 'Squat', description: 'A'.repeat(201) })
        expect(result.success).toBe(false)
    })
})

describe('updateMovementPatternSchema', () => {
    it('accepts partial update', () => {
        const result = updateMovementPatternSchema.safeParse({ description: 'Updated' })
        expect(result.success).toBe(true)
    })

    it('accepts empty object', () => {
        const result = updateMovementPatternSchema.safeParse({})
        expect(result.success).toBe(true)
    })
})

describe('movementPatternColorSchema', () => {
    it('accepts valid hex color', () => {
        const result = movementPatternColorSchema.safeParse({ color: '#3B82F6' })
        expect(result.success).toBe(true)
    })

    it('rejects invalid hex color', () => {
        const result = movementPatternColorSchema.safeParse({ color: 'blue' })
        expect(result.success).toBe(false)
    })

    it('rejects short hex', () => {
        const result = movementPatternColorSchema.safeParse({ color: '#FFF' })
        expect(result.success).toBe(false)
    })
})

// ─── MuscleGroup Schema ───────────────────────────────────────────────────────

import {
    muscleGroupSchema,
    updateMuscleGroupSchema,
} from '@/schemas/muscle-group'

describe('muscleGroupSchema', () => {
    it('accepts valid muscle group', () => {
        const result = muscleGroupSchema.safeParse({ name: 'Pettorali', description: 'Chest muscles' })
        expect(result.success).toBe(true)
    })

    it('rejects name shorter than 2 chars', () => {
        const result = muscleGroupSchema.safeParse({ name: 'P' })
        expect(result.success).toBe(false)
    })

    it('rejects name longer than 50 chars', () => {
        const result = muscleGroupSchema.safeParse({ name: 'A'.repeat(51) })
        expect(result.success).toBe(false)
    })

    it('accepts without description', () => {
        const result = muscleGroupSchema.safeParse({ name: 'Dorsali' })
        expect(result.success).toBe(true)
    })
})

describe('updateMuscleGroupSchema', () => {
    it('accepts partial update', () => {
        const result = updateMuscleGroupSchema.safeParse({ name: 'Updated' })
        expect(result.success).toBe(true)
    })
})

// ─── Week Schema ──────────────────────────────────────────────────────────────

import { weekConfigSchema, updateWeekSchema } from '@/schemas/week'

describe('weekConfigSchema', () => {
    it('accepts normal week type', () => {
        const result = weekConfigSchema.safeParse({ weekType: 'normal', feedbackRequested: false })
        expect(result.success).toBe(true)
    })

    it('accepts test week type', () => {
        const result = weekConfigSchema.safeParse({ weekType: 'test', feedbackRequested: true })
        expect(result.success).toBe(true)
    })

    it('accepts deload week type', () => {
        const result = weekConfigSchema.safeParse({ weekType: 'deload', feedbackRequested: false })
        expect(result.success).toBe(true)
    })

    it('rejects invalid week type', () => {
        const result = weekConfigSchema.safeParse({ weekType: 'invalid', feedbackRequested: false })
        expect(result.success).toBe(false)
    })

    it('defaults feedbackRequested to false', () => {
        const result = weekConfigSchema.safeParse({ weekType: 'normal' })
        expect(result.success).toBe(true)
        if (result.success) {
            expect(result.data.feedbackRequested).toBe(false)
        }
    })
})

describe('updateWeekSchema', () => {
    it('accepts partial update with only weekType', () => {
        const result = updateWeekSchema.safeParse({ weekType: 'deload' })
        expect(result.success).toBe(true)
    })

    it('accepts empty object', () => {
        const result = updateWeekSchema.safeParse({})
        expect(result.success).toBe(true)
    })
})

// ─── WorkoutExercise Schema ───────────────────────────────────────────────────

import {
    workoutExerciseSchema,
    updateWorkoutExerciseSchema,
    bulkWorkoutExercisesSchema,
} from '@/schemas/workout-exercise'

const validWorkoutExercise = {
    exerciseId: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
    sets: 3,
    reps: 8,
    weightType: 'absolute' as const,
    restTime: 'm2' as const,
    isWarmup: false,
    order: 1,
}

describe('workoutExerciseSchema', () => {
    it('accepts valid absolute weight exercise', () => {
        const result = workoutExerciseSchema.safeParse(validWorkoutExercise)
        expect(result.success).toBe(true)
    })

    it('accepts reps as range string', () => {
        const result = workoutExerciseSchema.safeParse({ ...validWorkoutExercise, reps: '8-10' })
        expect(result.success).toBe(true)
    })

    it('accepts reps as drop string', () => {
        const result = workoutExerciseSchema.safeParse({ ...validWorkoutExercise, reps: '6/8' })
        expect(result.success).toBe(true)
    })

    it('rejects percentage weight type without weight value', () => {
        const result = workoutExerciseSchema.safeParse({
            ...validWorkoutExercise,
            weightType: 'percentage_1rm',
        })
        expect(result.success).toBe(false)
    })

    it('accepts percentage weight type with weight value', () => {
        const result = workoutExerciseSchema.safeParse({
            ...validWorkoutExercise,
            weightType: 'percentage_1rm',
            weight: 80,
        })
        expect(result.success).toBe(true)
    })

    it('rejects sets less than 1', () => {
        const result = workoutExerciseSchema.safeParse({ ...validWorkoutExercise, sets: 0 })
        expect(result.success).toBe(false)
    })

    it('rejects sets more than 20', () => {
        const result = workoutExerciseSchema.safeParse({ ...validWorkoutExercise, sets: 21 })
        expect(result.success).toBe(false)
    })

    it('rejects invalid exerciseId UUID', () => {
        const result = workoutExerciseSchema.safeParse({ ...validWorkoutExercise, exerciseId: 'not-uuid' })
        expect(result.success).toBe(false)
    })

    it('rejects invalid restTime', () => {
        const result = workoutExerciseSchema.safeParse({ ...validWorkoutExercise, restTime: 'm10' })
        expect(result.success).toBe(false)
    })

    it('rejects RPE outside 5-10 range', () => {
        const result = workoutExerciseSchema.safeParse({ ...validWorkoutExercise, targetRpe: 4.5 })
        expect(result.success).toBe(false)
    })

    it('accepts valid optional RPE', () => {
        const result = workoutExerciseSchema.safeParse({ ...validWorkoutExercise, targetRpe: 8.5 })
        expect(result.success).toBe(true)
    })

    it('accepts isSkeletonExercise true', () => {
        const result = workoutExerciseSchema.safeParse({ ...validWorkoutExercise, isSkeletonExercise: true })
        expect(result.success).toBe(true)
        expect(result.data?.isSkeletonExercise).toBe(true)
    })

    it('accepts isSkeletonExercise false', () => {
        const result = workoutExerciseSchema.safeParse({ ...validWorkoutExercise, isSkeletonExercise: false })
        expect(result.success).toBe(true)
        expect(result.data?.isSkeletonExercise).toBe(false)
    })

    it('defaults isSkeletonExercise to false when omitted', () => {
        const result = workoutExerciseSchema.safeParse(validWorkoutExercise)
        expect(result.success).toBe(true)
        expect(result.data?.isSkeletonExercise).toBe(false)
    })
})

describe('updateWorkoutExerciseSchema', () => {
    it('accepts partial update with id', () => {
        const result = updateWorkoutExerciseSchema.safeParse({
            id: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
            sets: 4,
        })
        expect(result.success).toBe(true)
    })
})

describe('bulkWorkoutExercisesSchema', () => {
    it('accepts valid bulk with workoutId and exercises', () => {
        const result = bulkWorkoutExercisesSchema.safeParse({
            workoutId: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
            exercises: [validWorkoutExercise],
        })
        expect(result.success).toBe(true)
    })

    it('rejects empty exercises array', () => {
        const result = bulkWorkoutExercisesSchema.safeParse({
            workoutId: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
            exercises: [],
        })
        expect(result.success).toBe(false)
    })
})
