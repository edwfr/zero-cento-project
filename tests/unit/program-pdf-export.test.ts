import { describe, expect, it } from 'vitest'
import { buildProgramPdfExerciseRow, type ProgramPdfExercise } from '@/lib/program-pdf-export'

const labels = {
    warmupYesShort: 'RISC',
    jumpSetShort: 'JSET',
    superSetShort: 'SSET',
    previousExerciseShort: 'precedente',
    missingValue: '-',
}

const makeExercise = (overrides: Partial<ProgramPdfExercise> = {}): ProgramPdfExercise => ({
    id: 'exercise-1',
    name: 'Back Squat',
    variant: 'Competition',
    type: 'fundamental',
    isWarmup: false,
    isJumpSet: false,
    isSuperSet: false,
    sets: 4,
    reps: '6-8',
    targetRpe: 8,
    weightType: 'absolute',
    weight: 120,
    effectiveWeight: 120,
    restTime: 'm2',
    ...overrides,
})

describe('buildProgramPdfExerciseRow', () => {
    it('renders dedicated sets and reps columns', () => {
        const row = buildProgramPdfExerciseRow(makeExercise(), labels)

        expect(row[2]).toBe('4')
        expect(row[3]).toBe('6-8')
        expect(row[4]).toBe('8')
    })

    it('does not include fundamental/accessory markers in exercise name', () => {
        const row = buildProgramPdfExerciseRow(
            makeExercise({
                type: 'fundamental',
                isWarmup: true,
            }),
            labels
        )

        expect(row[0]).toBe('[RISC] Back Squat')
        expect(row[0]).not.toContain('[F]')
        expect(row[0]).not.toContain('[A]')
    })

    it('shows trainer percentage and calculated kg for percentage weights', () => {
        const row = buildProgramPdfExerciseRow(
            makeExercise({
                weightType: 'percentage_1rm',
                weight: 75,
                effectiveWeight: 97.5,
            }),
            labels
        )

        expect(row[5]).toBe('75% 1RM (97.5 kg)')
    })

    it('keeps the trainer percentage when calculated kg is missing', () => {
        const row = buildProgramPdfExerciseRow(
            makeExercise({
                weightType: 'percentage_previous',
                weight: 5,
                effectiveWeight: null,
            }),
            labels
        )

        expect(row[5]).toBe('+5% precedente')
    })
})