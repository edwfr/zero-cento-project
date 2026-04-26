import { describe, it, expect } from 'vitest'
import { transformApiExercise, transformApiWeek } from '@/app/trainer/programs/[id]/edit/transform-utils'

const TRAINER_ID = 'trainer-1'
const PRIMARY_COLOR = 'rgb(var(--brand-primary))'

function makeApiExercise(overrides: Partial<any> = {}): any {
    return {
        id: 'we-1',
        order: 0,
        variant: null,
        sets: 3,
        reps: '8',
        targetRpe: 8,
        weightType: 'absolute',
        weight: 100,
        effectiveWeight: 100,
        restTime: 'm3',
        isWarmup: false,
        notes: null,
        exercise: {
            id: 'ex-1',
            name: 'Squat',
            type: 'fundamental',
            notes: [],
            movementPattern: null,
            exerciseMuscleGroups: [],
        },
        ...overrides,
    }
}

describe('transformApiExercise', () => {
    it('maps all workout exercise fields', () => {
        const we = makeApiExercise()
        const result = transformApiExercise(we, TRAINER_ID)

        expect(result.id).toBe('we-1')
        expect(result.order).toBe(0)
        expect(result.variant).toBeNull()
        expect(result.sets).toBe(3)
        expect(result.reps).toBe('8')
        expect(result.targetRpe).toBe(8)
        expect(result.weightType).toBe('absolute')
        expect(result.weight).toBe(100)
        expect(result.effectiveWeight).toBe(100)
        expect(result.restTime).toBe('m3')
        expect(result.isWarmup).toBe(false)
        expect(result.notes).toBeNull()
        expect(result.exercise.id).toBe('ex-1')
        expect(result.exercise.name).toBe('Squat')
    })

    it('converts reps to string', () => {
        const we = makeApiExercise({ reps: 5 })
        const result = transformApiExercise(we, TRAINER_ID)
        expect(result.reps).toBe('5')
    })

    it('sets movementPattern to null when exercise has no movementPattern', () => {
        const result = transformApiExercise(makeApiExercise(), TRAINER_ID)
        expect(result.exercise.movementPattern).toBeNull()
    })

    it('picks trainer-specific movementPattern color when available', () => {
        const we = makeApiExercise({
            exercise: {
                id: 'ex-1',
                name: 'Squat',
                type: 'fundamental',
                notes: [],
                movementPattern: {
                    id: 'mp-1',
                    name: 'Squat Pattern',
                    movementPatternColors: [
                        { trainerId: 'other-trainer', color: 'red' },
                        { trainerId: TRAINER_ID, color: 'blue' },
                    ],
                },
                exerciseMuscleGroups: [],
            },
        })
        const result = transformApiExercise(we, TRAINER_ID)
        expect(result.exercise.movementPattern?.color).toBe('blue')
    })

    it('falls back to PRIMARY_COLOR when no trainer-specific color exists', () => {
        const we = makeApiExercise({
            exercise: {
                id: 'ex-1',
                name: 'Squat',
                type: 'fundamental',
                notes: [],
                movementPattern: {
                    id: 'mp-1',
                    name: 'Squat Pattern',
                    movementPatternColors: [
                        { trainerId: 'other-trainer', color: 'red' },
                    ],
                },
                exerciseMuscleGroups: [],
            },
        })
        const result = transformApiExercise(we, TRAINER_ID)
        expect(result.exercise.movementPattern?.color).toBe(PRIMARY_COLOR)
    })

    it('falls back to PRIMARY_COLOR when movementPatternColors is empty', () => {
        const we = makeApiExercise({
            exercise: {
                id: 'ex-1',
                name: 'Squat',
                type: 'fundamental',
                notes: [],
                movementPattern: {
                    id: 'mp-1',
                    name: 'Squat Pattern',
                    movementPatternColors: [],
                },
                exerciseMuscleGroups: [],
            },
        })
        const result = transformApiExercise(we, TRAINER_ID)
        expect(result.exercise.movementPattern?.color).toBe(PRIMARY_COLOR)
    })

    it('filters non-string notes from exercise', () => {
        const we = makeApiExercise({
            exercise: {
                id: 'ex-1',
                name: 'Squat',
                type: 'fundamental',
                notes: ['valid note', null, 42, 'another note'],
                movementPattern: null,
                exerciseMuscleGroups: [],
            },
        })
        const result = transformApiExercise(we, TRAINER_ID)
        expect(result.exercise.notes).toEqual(['valid note', 'another note'])
    })

    it('returns empty notes array when exercise.notes is not an array', () => {
        const we = makeApiExercise({
            exercise: {
                id: 'ex-1',
                name: 'Squat',
                type: 'fundamental',
                notes: null,
                movementPattern: null,
                exerciseMuscleGroups: [],
            },
        })
        const result = transformApiExercise(we, TRAINER_ID)
        expect(result.exercise.notes).toEqual([])
    })
})

describe('transformApiWeek', () => {
    it('maps week fields', () => {
        const week = {
            id: 'week-1',
            weekNumber: 1,
            weekType: 'normal',
            workouts: [],
        }
        const result = transformApiWeek(week, TRAINER_ID)
        expect(result.id).toBe('week-1')
        expect(result.weekNumber).toBe(1)
        expect(result.weekType).toBe('normal')
    })

    it('sorts workouts by dayIndex ascending', () => {
        const week = {
            id: 'week-1',
            weekNumber: 1,
            weekType: 'normal',
            workouts: [
                { id: 'wo-3', dayIndex: 3, workoutExercises: [] },
                { id: 'wo-1', dayIndex: 1, workoutExercises: [] },
                { id: 'wo-2', dayIndex: 2, workoutExercises: [] },
            ],
        }
        const result = transformApiWeek(week, TRAINER_ID)
        expect(result.workouts.map((w: any) => w.id)).toEqual(['wo-1', 'wo-2', 'wo-3'])
    })

    it('transforms each workoutExercise via transformApiExercise', () => {
        const we = makeApiExercise({ id: 'we-1', reps: 10 })
        const week = {
            id: 'week-1',
            weekNumber: 1,
            weekType: 'normal',
            workouts: [
                { id: 'wo-1', dayIndex: 1, workoutExercises: [we] },
            ],
        }
        const result = transformApiWeek(week, TRAINER_ID)
        expect(result.workouts[0].workoutExercises[0].reps).toBe('10')
    })

    it('handles empty workouts array', () => {
        const result = transformApiWeek(
            { id: 'w-1', weekNumber: 1, weekType: 'deload', workouts: [] },
            TRAINER_ID
        )
        expect(result.workouts).toEqual([])
    })

    it('handles missing workouts property', () => {
        const result = transformApiWeek(
            { id: 'w-1', weekNumber: 1, weekType: 'test' },
            TRAINER_ID
        )
        expect(result.workouts).toEqual([])
    })
})
