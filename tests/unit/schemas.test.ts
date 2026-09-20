import { describe, it, expect } from 'vitest'
import {
    exerciseSchema,
    updateExerciseSchema,
    muscleGroupAssignmentSchema,
    exerciseFilterSchema,
} from '@/schemas/exercise'
import {
    createProgramSchema,
    updateProgramSchema,
    publishProgramSchema,
    programFilterSchema,
} from '@/schemas/program'
import {
    createUserSchema,
    passwordSchema,
    changePasswordSchema,
    loginSchema,
    userListFilterSchema,
} from '@/schemas/user'
import { trainerTraineeNotesSchema } from '@/schemas/trainer-trainee-notes'
import { workoutSubmitSchema } from '@/schemas/feedback'

const validWorkoutSubmit = {
    traineeNotes: null,
    exercises: [{
        workoutExerciseId: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
        actualRpe: null,
        sets: [{ setNumber: 1, completed: true, reps: 5, weight: 100, actualRpe: null }],
    }],
}

const validTrainerNoteDocument = {
    type: 'doc',
    content: [
        {
            type: 'paragraph',
            content: [
                { type: 'text', text: 'Important', marks: [{ type: 'bold' }] },
                { type: 'text', text: ' note', marks: [{ type: 'textStyle', attrs: { color: '#FF0000' } }] },
            ],
        },
        {
            type: 'table',
            content: [{
                type: 'tableRow',
                content: [{
                    type: 'tableHeader',
                    attrs: { colspan: 1, rowspan: 1, colwidth: null },
                    content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Metric' }] }],
                }],
            }],
        },
    ],
}

describe('trainerTraineeNotesSchema', () => {
    it('accepts formatted text and tables', () => {
        expect(trainerTraineeNotesSchema.safeParse({ document: validTrainerNoteDocument }).success).toBe(true)
    })

    it('strips unsupported document nodes while accepting the payload', () => {
        const result = trainerTraineeNotesSchema.safeParse({
            document: {
                type: 'doc',
                content: [
                    { type: 'image', attrs: { src: 'https://example.com/image.png' } },
                    { type: 'paragraph', content: [{ type: 'text', text: 'Kept' }] },
                ],
            },
        })

        expect(result.success).toBe(true)
        if (!result.success) return

        const [firstNode] = (result.data.document as { content: Array<{ type: string; content?: unknown[] }> }).content
        expect(firstNode.type).toBe('paragraph')
        const kept = result.data.document as { content: Array<{ type: string; content?: Array<{ type: string; text?: string }> }> }
        expect(kept.content.some((node) => node.content?.some((child) => child.type === 'text' && child.text === 'Kept'))).toBe(true)
    })

    it('drops color marks that are not valid hex strings', () => {
        const result = trainerTraineeNotesSchema.safeParse({
            document: {
                type: 'doc',
                content: [{
                    type: 'paragraph',
                    content: [{ type: 'text', text: 'Note', marks: [{ type: 'textStyle', attrs: { color: 'red' } }] }],
                }],
            },
        })

        expect(result.success).toBe(true)
        if (!result.success) return

        const [paragraph] = (result.data.document as { content: Array<{ content: Array<{ type: string; marks?: unknown[] }> }> }).content
        expect(paragraph.content[0].marks).toBeUndefined()
    })

    it('rejects documents exceeding the text limit', () => {
        const result = trainerTraineeNotesSchema.safeParse({
            document: {
                type: 'doc',
                content: [{ type: 'paragraph', content: [{ type: 'text', text: 'a'.repeat(50_001) }] }],
            },
        })

        expect(result.success).toBe(false)
    })
})

describe('workoutSubmitSchema wellbeing ratings', () => {
    it('accepts optional ratings from 1 to 5', () => {
        const result = workoutSubmitSchema.safeParse({
            ...validWorkoutSubmit,
            sleepQuality: 1,
            stressLevel: 3,
            nutritionQuality: 5,
        })

        expect(result.success).toBe(true)
    })

    it.each([
        ['sleepQuality', 0],
        ['stressLevel', 6],
        ['nutritionQuality', 2.5],
    ])('rejects %s=%s', (field, value) => {
        const result = workoutSubmitSchema.safeParse({
            ...validWorkoutSubmit,
            [field]: value,
        })

        expect(result.success).toBe(false)
    })

    it('accepts omitted ratings for backward compatibility', () => {
        expect(workoutSubmitSchema.safeParse(validWorkoutSubmit).success).toBe(true)
    })
})

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

    it('accepts empty muscleGroups array', () => {
        const result = exerciseSchema.safeParse({ ...validExercise, muscleGroups: [] })
        expect(result.success).toBe(true)
    })

    it('defaults muscleGroups to an empty array when the field is omitted', () => {
        const { muscleGroups: _omitted, ...withoutMuscleGroups } = validExercise
        const result = exerciseSchema.safeParse(withoutMuscleGroups)
        expect(result.success).toBe(true)
        expect(result.success && result.data.muscleGroups).toEqual([])
    })

    it('accepts more than 5 muscle groups with a total coefficient above 3', () => {
        const manyMuscleGroups = Array.from({ length: 8 }, (_, index) => ({
            muscleGroupId: `3fa85f64-5717-4562-b3fc-2c963f66af${String(index).padStart(2, '0')}`,
            coefficient: 0.6,
        }))
        const result = exerciseSchema.safeParse({
            ...validExercise,
            muscleGroups: manyMuscleGroups,
        })
        expect(result.success).toBe(true)
        expect(result.success && result.data.muscleGroups).toHaveLength(8)
    })

    it('accepts "accessory" type', () => {
        const result = exerciseSchema.safeParse({ ...validExercise, type: 'accessory' })
        expect(result.success).toBe(true)
    })

    it('accepts "postural" type', () => {
        const result = exerciseSchema.safeParse({ ...validExercise, type: 'postural' })
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

describe('exerciseFilterSchema', () => {
    it('accepts type=postural', () => {
        expect(exerciseFilterSchema.safeParse({ type: 'postural' }).success).toBe(true)
    })

    it('rejects unknown type', () => {
        expect(exerciseFilterSchema.safeParse({ type: 'compound' }).success).toBe(false)
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

    it('accepts payload without cloneFromProgramId', () => {
        const result = createProgramSchema.safeParse(validProgram)
        expect(result.success).toBe(true)
    })

    it('accepts a valid uuid for cloneFromProgramId', () => {
        const result = createProgramSchema.safeParse({
            ...validProgram,
            cloneFromProgramId: '00000000-0000-0000-0000-000000000001',
        })

        expect(result.success).toBe(true)
    })

    it('rejects a non-uuid cloneFromProgramId', () => {
        const result = createProgramSchema.safeParse({
            ...validProgram,
            cloneFromProgramId: 'not-a-uuid',
        })

        expect(result.success).toBe(false)
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

describe('programFilterSchema', () => {
    it('applies defaults for page and limit', () => {
        const result = programFilterSchema.safeParse({})
        expect(result.success).toBe(true)

        if (result.success) {
            expect(result.data.page).toBe(1)
            expect(result.data.limit).toBe(20)
        }
    })

    it('accepts valid pagination and status filters', () => {
        const result = programFilterSchema.safeParse({
            status: 'active',
            page: '3',
            limit: '50',
            search: 'Mario',
            cursor: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
        })

        expect(result.success).toBe(true)

        if (result.success) {
            expect(result.data.page).toBe(3)
            expect(result.data.limit).toBe(50)
            expect(result.data.status).toBe('active')
        }
    })

    it('rejects page lower than 1', () => {
        const result = programFilterSchema.safeParse({ page: 0 })
        expect(result.success).toBe(false)
    })

    it('rejects limit greater than 500', () => {
        const result = programFilterSchema.safeParse({ limit: 501 })
        expect(result.success).toBe(false)
    })

    it('rejects non-uuid cursor', () => {
        const result = programFilterSchema.safeParse({ cursor: 'not-a-uuid' })
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

describe('userListFilterSchema', () => {
    it('applies defaults for includeInactive, status, page and limit', () => {
        const result = userListFilterSchema.safeParse({})
        expect(result.success).toBe(true)

        if (result.success) {
            expect(result.data.includeInactive).toBe(false)
            expect(result.data.status).toBe('all')
            expect(result.data.page).toBe(1)
            expect(result.data.limit).toBe(20)
        }
    })

    it('accepts valid role, status and coerced numeric pagination values', () => {
        const result = userListFilterSchema.safeParse({
            role: 'trainee',
            includeInactive: true,
            status: 'inactive',
            search: 'Mario',
            page: '3',
            limit: '50',
        })

        expect(result.success).toBe(true)

        if (result.success) {
            expect(result.data.role).toBe('trainee')
            expect(result.data.includeInactive).toBe(true)
            expect(result.data.status).toBe('inactive')
            expect(result.data.page).toBe(3)
            expect(result.data.limit).toBe(50)
        }
    })

    it('rejects page lower than 1', () => {
        const result = userListFilterSchema.safeParse({ page: 0 })
        expect(result.success).toBe(false)
    })

    it('rejects limit greater than 100', () => {
        const result = userListFilterSchema.safeParse({ limit: 101 })
        expect(result.success).toBe(false)
    })

    it('rejects search shorter than 2 characters', () => {
        const result = userListFilterSchema.safeParse({ search: 'a' })
        expect(result.success).toBe(false)
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
    it('accepts tecnica', () => {
        const result = weekConfigSchema.safeParse({ weekType: 'tecnica', feedbackRequested: false })
        expect(result.success).toBe(true)
    })
    it('accepts ipertrofia', () => {
        const result = weekConfigSchema.safeParse({ weekType: 'ipertrofia', feedbackRequested: false })
        expect(result.success).toBe(true)
    })
    it('accepts volume', () => {
        const result = weekConfigSchema.safeParse({ weekType: 'volume', feedbackRequested: false })
        expect(result.success).toBe(true)
    })
    it('accepts forza_generale', () => {
        const result = weekConfigSchema.safeParse({ weekType: 'forza_generale', feedbackRequested: false })
        expect(result.success).toBe(true)
    })
    it('accepts intensificazione', () => {
        const result = weekConfigSchema.safeParse({ weekType: 'intensificazione', feedbackRequested: false })
        expect(result.success).toBe(true)
    })
    it('accepts picco', () => {
        const result = weekConfigSchema.safeParse({ weekType: 'picco', feedbackRequested: false })
        expect(result.success).toBe(true)
    })
    it('accepts test', () => {
        const result = weekConfigSchema.safeParse({ weekType: 'test', feedbackRequested: true })
        expect(result.success).toBe(true)
    })
    it('accepts deload', () => {
        const result = weekConfigSchema.safeParse({ weekType: 'deload', feedbackRequested: false })
        expect(result.success).toBe(true)
    })
    it('rejects normal (removed)', () => {
        const result = weekConfigSchema.safeParse({ weekType: 'normal', feedbackRequested: false })
        expect(result.success).toBe(false)
    })
    it('rejects invalid value', () => {
        const result = weekConfigSchema.safeParse({ weekType: 'invalid', feedbackRequested: false })
        expect(result.success).toBe(false)
        expect(result.error?.issues[0].message).toBe('validation.invalidWeekType')
    })
    it('defaults feedbackRequested to false', () => {
        const result = weekConfigSchema.safeParse({ weekType: 'volume' })
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
    bulkSaveWorkoutExercisesSchema,
} from '@/schemas/workout-exercise'

const validWorkoutExercise = {
    exerciseId: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
    sets: 3,
    reps: 8,
    weightType: 'absolute' as const,
    restTime: 'm2' as const,
    isWarmup: false,
    isJumpSet: false,
    isSuperSet: false,
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

    it('accepts reps as seconds string', () => {
        const result = workoutExerciseSchema.safeParse({ ...validWorkoutExercise, reps: '30"' })
        expect(result.success).toBe(true)
    })

    it('accepts reps as single-digit seconds string', () => {
        const result = workoutExerciseSchema.safeParse({ ...validWorkoutExercise, reps: '5"' })
        expect(result.success).toBe(true)
    })

    it('rejects invalid seconds format with double quote only', () => {
        const result = workoutExerciseSchema.safeParse({ ...validWorkoutExercise, reps: '"' })
        expect(result.success).toBe(false)
    })

    it('rejects double quote suffix without leading digit', () => {
        const result = workoutExerciseSchema.safeParse({ ...validWorkoutExercise, reps: 'abc"' })
        expect(result.success).toBe(false)
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

    it('accepts m1s30 as valid restTime', () => {
        const result = workoutExerciseSchema.safeParse({ ...validWorkoutExercise, restTime: 'm1s30' })
        expect(result.success).toBe(true)
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

    it('rejects rows with both jump set and super set enabled', () => {
        const result = workoutExerciseSchema.safeParse({
            ...validWorkoutExercise,
            isJumpSet: true,
            isSuperSet: true,
        })
        expect(result.success).toBe(false)
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

describe('bulkSaveWorkoutExercisesSchema', () => {
    const validRow = {
        exerciseId: '33333333-3333-3333-3333-333333333331',
        sets: 3,
        reps: '8',
        weightType: 'absolute' as const,
        restTime: 'm2' as const,
        isWarmup: false,
        isJumpSet: false,
        isSuperSet: false,
        order: 1,
    }

    it('accepts rows without id (create) and with id (update) mixed', () => {
        const parsed = bulkSaveWorkoutExercisesSchema.parse({
            exercises: [
                validRow,
                { ...validRow, id: '44444444-4444-4444-4444-444444444444', order: 2 },
            ],
        })
        expect(parsed.exercises).toHaveLength(2)
        expect(parsed.exercises[0].id).toBeUndefined()
        expect(parsed.exercises[1].id).toBe('44444444-4444-4444-4444-444444444444')
    })

    it('accepts delete-only payloads with deletedExerciseIds', () => {
        const parsed = bulkSaveWorkoutExercisesSchema.parse({
            exercises: [],
            deletedExerciseIds: ['44444444-4444-4444-4444-444444444444'],
        })

        expect(parsed.exercises).toHaveLength(0)
        expect(parsed.deletedExerciseIds).toEqual(['44444444-4444-4444-4444-444444444444'])
    })

    it('rejects when id is not a uuid', () => {
        const result = bulkSaveWorkoutExercisesSchema.safeParse({
            exercises: [{ ...validRow, id: 'not-a-uuid' }],
        })
        expect(result.success).toBe(false)
    })

    it('rejects empty exercises array', () => {
        const result = bulkSaveWorkoutExercisesSchema.safeParse({ exercises: [] })
        expect(result.success).toBe(false)
    })

    it('rejects deletedExerciseIds when an id is invalid', () => {
        const result = bulkSaveWorkoutExercisesSchema.safeParse({
            exercises: [validRow],
            deletedExerciseIds: ['not-a-uuid'],
        })
        expect(result.success).toBe(false)
    })

    it('rejects overlapping ids between exercises and deletedExerciseIds', () => {
        const rowId = '44444444-4444-4444-4444-444444444444'
        const result = bulkSaveWorkoutExercisesSchema.safeParse({
            exercises: [{ ...validRow, id: rowId }],
            deletedExerciseIds: [rowId],
        })
        expect(result.success).toBe(false)
    })

    it('rejects a row when both jump set and super set are enabled', () => {
        const result = bulkSaveWorkoutExercisesSchema.safeParse({
            exercises: [{ ...validRow, isJumpSet: true, isSuperSet: true }],
        })
        expect(result.success).toBe(false)
    })
})

import { personalRecordSchema, updatePersonalRecordSchema } from '@/schemas/personal-record'

describe('personalRecordSchema', () => {
    const validRecord = {
        exerciseId: '33333333-3333-3333-3333-333333333331',
        reps: 3,
        weight: 100,
        recordDate: '2026-09-01',
    }

    it('accepts a record without notes', () => {
        expect(personalRecordSchema.safeParse(validRecord).success).toBe(true)
    })

    it('accepts a record with notes', () => {
        expect(personalRecordSchema.safeParse({ ...validRecord, notes: 'PR di giornata' }).success).toBe(true)
    })

    it('rejects notes longer than 500 characters', () => {
        expect(personalRecordSchema.safeParse({ ...validRecord, notes: 'a'.repeat(501) }).success).toBe(false)
    })

    it('parses a date string into a Date', () => {
        const parsed = personalRecordSchema.parse(validRecord)
        expect(parsed.recordDate).toBeInstanceOf(Date)
        expect(parsed.recordDate.toISOString()).toContain('2026-09-01')
    })

    it('accepts a Date instance as recordDate', () => {
        const parsed = personalRecordSchema.parse({ ...validRecord, recordDate: new Date('2026-09-01') })
        expect(parsed.recordDate).toBeInstanceOf(Date)
    })

    it('rejects a record dated in the future', () => {
        const future = new Date()
        future.setFullYear(future.getFullYear() + 1)
        expect(personalRecordSchema.safeParse({ ...validRecord, recordDate: future }).success).toBe(false)
    })

    it.each([
        ['zero reps', { reps: 0 }],
        ['more than 100 reps', { reps: 101 }],
        ['fractional reps', { reps: 2.5 }],
        ['zero weight', { weight: 0 }],
        ['more than 1000 kg', { weight: 1001 }],
        ['a non-uuid exercise', { exerciseId: 'not-a-uuid' }],
    ])('rejects %s', (_label, override) => {
        expect(personalRecordSchema.safeParse({ ...validRecord, ...override }).success).toBe(false)
    })

    it('lets the partial update schema omit every field', () => {
        expect(updatePersonalRecordSchema.safeParse({}).success).toBe(true)
    })

    it('still validates the fields the partial update does carry', () => {
        expect(updatePersonalRecordSchema.safeParse({ reps: 0 }).success).toBe(false)
    })
})

describe('publishProgramSchema date handling', () => {
    it('parses a date string into a Date', () => {
        const parsed = publishProgramSchema.parse({ week1StartDate: '2026-03-02' })
        expect(parsed.week1StartDate).toBeInstanceOf(Date)
    })

    it('accepts a Date instance unchanged', () => {
        const date = new Date('2026-03-02')
        expect(publishProgramSchema.parse({ week1StartDate: date }).week1StartDate).toEqual(date)
    })

    it('rejects a start date that is not a real date', () => {
        expect(() => publishProgramSchema.parse({ week1StartDate: 'non-una-data' })).toThrow()
    })
})

describe('workoutExerciseSchema weight rules per weightType', () => {
    const base = {
        exerciseId: '33333333-3333-3333-3333-333333333331',
        sets: 3,
        reps: '8',
        restTime: 'm2' as const,
        isWarmup: false,
        isJumpSet: false,
        isSuperSet: false,
        order: 1,
    }

    it('accepts an absolute weight', () => {
        expect(workoutExerciseSchema.safeParse({ ...base, weightType: 'absolute', weight: 100 }).success).toBe(true)
    })

    it.each(['percentage_1rm', 'percentage_rm', 'percentage_previous'])(
        'requires a weight when weightType is %s',
        (weightType) => {
            const result = workoutExerciseSchema.safeParse({ ...base, weightType })
            expect(result.success).toBe(false)
            if (result.success) return
            expect(result.error.issues.some((issue) => issue.message === 'validation.weightRequiredForPercentage')).toBe(true)
        }
    )

    it.each(['percentage_1rm', 'percentage_rm', 'percentage_previous'])(
        'accepts %s when the weight is present',
        (weightType) => {
            expect(workoutExerciseSchema.safeParse({ ...base, weightType, weight: 80 }).success).toBe(true)
        }
    )

    it('rejects a negative weight for a non-relative weightType', () => {
        const result = workoutExerciseSchema.safeParse({ ...base, weightType: 'absolute', weight: -1 })
        expect(result.success).toBe(false)
        if (result.success) return
        expect(result.error.issues.some((issue) => issue.message === 'validation.weightMinZero')).toBe(true)
    })

    it('allows a negative weight for percentage_previous, which is a delta', () => {
        expect(workoutExerciseSchema.safeParse({ ...base, weightType: 'percentage_previous', weight: -5 }).success).toBe(true)
    })

    it('rejects a negative effectiveWeight', () => {
        const result = workoutExerciseSchema.safeParse({
            ...base, weightType: 'absolute', weight: 100, effectiveWeight: -10,
        })
        expect(result.success).toBe(false)
        if (result.success) return
        expect(result.error.issues.some((issue) => issue.message === 'validation.effectiveWeightMinZero')).toBe(true)
    })

    it('rejects an exercise that is both a jump set and a super set', () => {
        const result = workoutExerciseSchema.safeParse({
            ...base, weightType: 'absolute', weight: 100, isJumpSet: true, isSuperSet: true,
        })
        expect(result.success).toBe(false)
        if (result.success) return
        expect(result.error.issues.some((issue) => issue.message === 'validation.jumpSetSuperSetExclusive')).toBe(true)
    })
})

describe('trainerTraineeNotesSchema sanitizer branches', () => {
    const parse = (document: unknown) => trainerTraineeNotesSchema.safeParse({ document })
    const docOf = (result: ReturnType<typeof parse>) => {
        if (!result.success) throw new Error('expected the document to parse')
        return result.data.document as { content: Array<Record<string, unknown>> }
    }

    it('keeps bold and italic marks', () => {
        const result = parse({
            type: 'doc',
            content: [{
                type: 'paragraph',
                content: [
                    { type: 'text', text: 'grassetto', marks: [{ type: 'bold' }] },
                    { type: 'text', text: 'corsivo', marks: [{ type: 'italic' }] },
                ],
            }],
        })

        const paragraph = docOf(result).content[0] as { content: Array<{ marks?: Array<{ type: string }> }> }
        expect(paragraph.content[0].marks).toEqual([{ type: 'bold' }])
        expect(paragraph.content[1].marks).toEqual([{ type: 'italic' }])
    })

    it('drops marks that are not objects or carry no type', () => {
        const result = parse({
            type: 'doc',
            content: [{
                type: 'paragraph',
                content: [{ type: 'text', text: 'Nota', marks: ['bold', { attrs: {} }] }],
            }],
        })

        const paragraph = docOf(result).content[0] as { content: Array<{ marks?: unknown[] }> }
        expect(paragraph.content[0].marks).toBeUndefined()
    })

    it('ignores a marks value that is not an array', () => {
        const result = parse({
            type: 'doc',
            content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Nota', marks: 'bold' }] }],
        })

        const paragraph = docOf(result).content[0] as { content: Array<{ marks?: unknown[] }> }
        expect(paragraph.content[0].marks).toBeUndefined()
    })

    it('drops an empty text node', () => {
        const result = parse({
            type: 'doc',
            content: [{ type: 'paragraph', content: [{ type: 'text', text: '' }, { type: 'text', text: 'Resta' }] }],
        })

        const paragraph = docOf(result).content[0] as { content: Array<{ text?: string }> }
        expect(paragraph.content).toHaveLength(1)
        expect(paragraph.content[0].text).toBe('Resta')
    })

    it('drops a node that is not an object or has no type', () => {
        const result = parse({ type: 'doc', content: ['testo', { content: [] }, { type: 'paragraph', content: [{ type: 'text', text: 'Resta' }] }] })

        expect(docOf(result).content).toHaveLength(1)
    })

    it('turns an unknown block with content into a paragraph', () => {
        const result = parse({
            type: 'doc',
            content: [{ type: 'blockquote', content: [{ type: 'text', text: 'Citazione' }] }],
        })

        const [node] = docOf(result).content as Array<{ type: string; content: Array<{ text?: string }> }>
        expect(node.type).toBe('paragraph')
        expect(node.content[0].text).toBe('Citazione')
    })

    it('drops an unknown block without content', () => {
        const result = parse({
            type: 'doc',
            content: [
                { type: 'image', attrs: { src: 'x.png' } },
                { type: 'paragraph', content: [{ type: 'text', text: 'Resta' }] },
            ],
        })

        expect(docOf(result).content).toHaveLength(1)
    })

    it('keeps valid colspan and rowspan on a table cell', () => {
        const result = parse({
            type: 'doc',
            content: [{
                type: 'table',
                content: [{
                    type: 'tableRow',
                    content: [{
                        type: 'tableCell',
                        attrs: { colspan: 2, rowspan: 3, colwidth: [120, 240] },
                        content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Cella' }] }],
                    }],
                }],
            }],
        })

        const table = docOf(result).content[0] as { content: Array<{ content: Array<{ attrs?: Record<string, unknown> }> }> }
        expect(table.content[0].content[0].attrs).toMatchObject({ colspan: 2, rowspan: 3, colwidth: [120, 240] })
    })

    it('discards out-of-range colspan and rowspan', () => {
        const result = parse({
            type: 'doc',
            content: [{
                type: 'table',
                content: [{
                    type: 'tableRow',
                    content: [{
                        type: 'tableCell',
                        attrs: { colspan: 99, rowspan: 0, colwidth: null },
                        content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Cella' }] }],
                    }],
                }],
            }],
        })

        const table = docOf(result).content[0] as { content: Array<{ content: Array<{ attrs?: Record<string, unknown> }> }> }
        const attrs = table.content[0].content[0].attrs
        expect(attrs).toEqual({ colwidth: null })
    })

    it('nulls a colwidth list that contains an invalid width', () => {
        const result = parse({
            type: 'doc',
            content: [{
                type: 'table',
                content: [{
                    type: 'tableRow',
                    content: [{
                        type: 'tableCell',
                        attrs: { colspan: 1, colwidth: [120, 5000] },
                        content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Cella' }] }],
                    }],
                }],
            }],
        })

        const table = docOf(result).content[0] as { content: Array<{ content: Array<{ attrs?: Record<string, unknown> }> }> }
        expect(table.content[0].content[0].attrs).toMatchObject({ colwidth: null })
    })

    it('keeps a valid start on an ordered list and drops an invalid one', () => {
        const withStart = parse({
            type: 'doc',
            content: [{
                type: 'orderedList',
                attrs: { start: 3 },
                content: [{ type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Uno' }] }] }],
            }],
        })
        expect((docOf(withStart).content[0] as { attrs?: Record<string, unknown> }).attrs).toEqual({ start: 3 })

        const withoutStart = parse({
            type: 'doc',
            content: [{
                type: 'orderedList',
                attrs: { start: 0 },
                content: [{ type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Uno' }] }] }],
            }],
        })
        expect((docOf(withoutStart).content[0] as { attrs?: Record<string, unknown> }).attrs).toBeUndefined()
    })

    it('rejects a document nested deeper than the limit', () => {
        let node: Record<string, unknown> = { type: 'text', text: 'fondo' }
        for (let i = 0; i < 20; i++) {
            node = { type: 'paragraph', content: [node] }
        }

        expect(parse({ type: 'doc', content: [node] }).success).toBe(false)
    })

    it('rejects a document with more nodes than the limit', () => {
        const content = Array.from({ length: 501 }, () => ({
            type: 'paragraph',
            content: [{ type: 'text', text: 'x' }],
        }))

        expect(parse({ type: 'doc', content }).success).toBe(false)
    })

    it('returns an empty paragraph for a document that is not a record', () => {
        const result = parse('non un documento')
        expect(docOf(result).content).toEqual([{ type: 'paragraph' }])
    })
})
