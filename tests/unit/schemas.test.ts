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
