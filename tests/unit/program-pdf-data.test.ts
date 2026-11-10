import { describe, it, expect, vi } from 'vitest'
import {
    apiProgramToPdfSource,
    buildProgramPdfData,
    type ApiProgramForPdf,
    type PdfSourceExercise,
    type PdfSourceProgram,
} from '@/lib/program-pdf-data'

const exercise = (overrides: Partial<PdfSourceExercise> = {}): PdfSourceExercise => ({
    id: 'we-1',
    variant: 'Pausa',
    sets: 4,
    reps: '6',
    targetRpe: 8,
    weightType: 'percentage_1rm',
    weight: 80,
    effectiveWeight: 120,
    rpeWeightMin: 115,
    rpeWeightMax: 125,
    ballast: null,
    restTime: 'm3',
    isWarmup: true,
    isJumpSet: true,
    isSuperSet: false,
    exercise: { name: 'Squat', type: 'fundamental' },
    ...overrides,
})

const program = (overrides: Partial<PdfSourceProgram> = {}): PdfSourceProgram => ({
    title: 'Blocco A',
    startDate: '2026-11-02',
    trainee: { firstName: 'Mario', lastName: 'Rossi' },
    trainer: { firstName: 'Luca', lastName: 'Bianchi' },
    weeks: [
        {
            weekNumber: 1,
            weekType: 'volume',
            workouts: [{ id: 'w-1', dayIndex: 1, exercises: [exercise()] }],
        },
    ],
    ...overrides,
})

const options = {
    unknownTraineeName: 'Atleta',
    ballastLabel: vi.fn(() => 'BW + 10 kg'),
}

describe('buildProgramPdfData', () => {
    it('concatenates trainee and trainer names', () => {
        const data = buildProgramPdfData(program(), options)

        expect(data.traineeName).toBe('Mario Rossi')
        expect(data.trainerName).toBe('Luca Bianchi')
        expect(data.title).toBe('Blocco A')
        expect(data.startDate).toBe('2026-11-02')
    })

    it.each([undefined, null])('uses the unknown trainee name when trainee is %s', (trainee) => {
        const data = buildProgramPdfData(program({ trainee }), options)

        expect(data.traineeName).toBe('Atleta')
    })

    it('labels a ballast through the provided formatter', () => {
        const ballast = { kind: 'ballast', kg: 10 } as const
        const data = buildProgramPdfData(
            program({
                weeks: [
                    {
                        weekNumber: 1,
                        weekType: 'volume',
                        workouts: [{ id: 'w-1', dayIndex: 1, exercises: [exercise({ ballast })] }],
                    },
                ],
            }),
            options
        )

        expect(options.ballastLabel).toHaveBeenCalledWith(ballast)
        expect(data.weeks[0].workouts[0].exercises[0].weightLabelOverride).toBe('BW + 10 kg')
    })

    it.each([null, undefined])('has no weight override when ballast is %s', (ballast) => {
        const data = buildProgramPdfData(
            program({
                weeks: [
                    {
                        weekNumber: 1,
                        weekType: 'volume',
                        workouts: [{ id: 'w-1', dayIndex: 1, exercises: [exercise({ ballast })] }],
                    },
                ],
            }),
            options
        )

        expect(data.weeks[0].workouts[0].exercises[0].weightLabelOverride).toBeNull()
    })

    it('defaults missing jump/super set flags to false', () => {
        const data = buildProgramPdfData(
            program({
                weeks: [
                    {
                        weekNumber: 1,
                        weekType: 'volume',
                        workouts: [
                            {
                                id: 'w-1',
                                dayIndex: 1,
                                exercises: [exercise({ isJumpSet: undefined, isSuperSet: undefined })],
                            },
                        ],
                    },
                ],
            }),
            options
        )

        const row = data.weeks[0].workouts[0].exercises[0]
        expect(row.isJumpSet).toBe(false)
        expect(row.isSuperSet).toBe(false)
    })

    it('copies every other exercise field as-is', () => {
        const data = buildProgramPdfData(program(), options)

        expect(data.weeks[0]).toMatchObject({ weekNumber: 1, weekType: 'volume' })
        expect(data.weeks[0].workouts[0]).toMatchObject({ id: 'w-1', dayIndex: 1 })
        expect(data.weeks[0].workouts[0].exercises[0]).toEqual({
            id: 'we-1',
            name: 'Squat',
            variant: 'Pausa',
            type: 'fundamental',
            isWarmup: true,
            isJumpSet: true,
            isSuperSet: false,
            sets: 4,
            reps: '6',
            targetRpe: 8,
            weightType: 'percentage_1rm',
            weight: 80,
            effectiveWeight: 120,
            rpeWeightMin: 115,
            rpeWeightMax: 125,
            restTime: 'm3',
            weightLabelOverride: null,
        })
    })

    it('keeps workout input order', () => {
        const data = buildProgramPdfData(
            program({
                weeks: [
                    {
                        weekNumber: 1,
                        weekType: 'volume',
                        workouts: [
                            { id: 'w-3', dayIndex: 3, exercises: [] },
                            { id: 'w-1', dayIndex: 1, exercises: [] },
                        ],
                    },
                ],
            }),
            options
        )

        expect(data.weeks[0].workouts.map((w) => w.id)).toEqual(['w-3', 'w-1'])
    })
})

describe('apiProgramToPdfSource', () => {
    it('renames workoutExercises to exercises and carries the rest over', () => {
        const row = exercise()
        const api: ApiProgramForPdf = {
            title: 'Blocco A',
            startDate: '2026-11-02',
            trainee: { firstName: 'Mario', lastName: 'Rossi' },
            trainer: { firstName: 'Luca', lastName: 'Bianchi' },
            weeks: [
                {
                    weekNumber: 2,
                    weekType: 'deload',
                    workouts: [{ id: 'w-1', dayIndex: 2, workoutExercises: [row] }],
                },
            ],
        }

        const source = apiProgramToPdfSource(api)

        expect(source).toEqual({
            title: 'Blocco A',
            startDate: '2026-11-02',
            trainee: { firstName: 'Mario', lastName: 'Rossi' },
            trainer: { firstName: 'Luca', lastName: 'Bianchi' },
            weeks: [
                {
                    weekNumber: 2,
                    weekType: 'deload',
                    workouts: [{ id: 'w-1', dayIndex: 2, exercises: [row] }],
                },
            ],
        })
    })
})
