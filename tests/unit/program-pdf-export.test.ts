import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
    buildProgramPdfExerciseRow,
    buildProgramPdfRowFillColors,
    buildProgramPdfTableHeadRow,
    exportProgramToPdf,
    type ProgramPdfData,
    type ProgramPdfExercise,
    type ProgramPdfLabels,
    type ProgramPdfWeek,
} from '@/lib/program-pdf-export'

const labels = {
    warmupYesShort: 'RISC',
    jumpSetShort: 'JSET',
    superSetShort: 'SSET',
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
        expect(row[6]).toBe('2:00')
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

        expect(row[5]).toBe('+5%')
    })

    it('alternates gray tones when exercise name changes', () => {
        const colors = buildProgramPdfRowFillColors([
            makeExercise({ name: 'Esercizio 1' }),
            makeExercise({ name: 'Esercizio 1' }),
            makeExercise({ name: 'Esercizio 2' }),
            makeExercise({ name: 'Esercizio 3' }),
        ])

        expect(colors).toEqual([
            [245, 245, 245],
            [245, 245, 245],
            [232, 232, 232],
            [245, 245, 245],
        ])
    })

    it('highlights jump-set and superset rows in yellow', () => {
        const colors = buildProgramPdfRowFillColors([
            makeExercise({ name: 'Esercizio 1' }),
            makeExercise({ name: 'Esercizio 2', isJumpSet: true }),
            makeExercise({ name: 'Esercizio 3', isSuperSet: true }),
        ])

        expect(colors).toEqual([
            [245, 245, 245],
            [255, 243, 179],
            [255, 243, 179],
        ])
    })
})

describe('buildProgramPdfTableHeadRow', () => {
    it('returns uppercase table headers', () => {
        const head = buildProgramPdfTableHeadRow(
            {
                tableExercise: 'Esercizio',
                tableVariant: 'Variante',
                tableSets: 'Set',
                tableReps: 'Rep',
                tableRpe: 'Rpe',
                tableWeight: 'Peso',
                tableRest: 'Rest',
            },
            'it-IT'
        )

        expect(head).toEqual(['ESERCIZIO', 'VARIANTE', 'SET', 'REP', 'RPE', 'PESO', 'REST'])
    })
})
// ────────────────────────────────────────────────────────────────────────────
// exportProgramToPdf
// ────────────────────────────────────────────────────────────────────────────

const docCalls = {
    text: vi.fn(),
    addPage: vi.fn(),
    addImage: vi.fn(),
    save: vi.fn(),
    setFont: vi.fn(),
    setFontSize: vi.fn(),
    setTextColor: vi.fn(),
    setFillColor: vi.fn(),
    setDrawColor: vi.fn(),
    rect: vi.fn(),
    lastAutoTable: { finalY: 100 },
}

const autoTableMock = vi.fn()

vi.mock('jspdf', () => ({
    // `new jsPDF(...)` needs something constructible: a constructor that returns
    // an object short-circuits `this` with that object.
    jsPDF: vi.fn(function JsPdfMock() {
        return docCalls
    }),
}))

vi.mock('jspdf-autotable', () => ({ default: (...args: unknown[]) => autoTableMock(...args) }))

const exportLabels: ProgramPdfLabels = {
    trainerLabel: 'Trainer',
    startDateLabel: 'Inizio',
    generatedAtLabel: 'Generato il',
    weekLabel: (week) => `Settimana ${week}`,
    weekTypeLabel: (weekType) => `tipo:${weekType}`,
    workoutLabel: (dayIndex) => `Giorno ${dayIndex}`,
    tableExercise: 'Esercizio',
    tableVariant: 'Variante',
    tableSets: 'Set',
    tableReps: 'Rep',
    tableRpe: 'Rpe',
    tableWeight: 'Peso',
    tableRest: 'Rest',
    tableNoExercises: 'Nessun esercizio',
    warmupYesShort: 'RISC',
    jumpSetShort: 'JSET',
    superSetShort: 'SSET',
    missingValue: '-',
}

const makeWeek = (weekNumber: number, weekType: ProgramPdfWeek['weekType'], exercises = [makeExercise()]): ProgramPdfWeek => ({
    weekNumber,
    weekType,
    workouts: [{ id: `workout-${weekNumber}`, dayIndex: 0, exercises }],
})

const makeProgram = (weeks: ProgramPdfWeek[]): ProgramPdfData => ({
    title: 'Blocco Forza',
    traineeName: 'Mario Rossi',
    trainerName: 'Marco Trainer',
    startDate: '2026-03-02',
    weeks,
})

/** Every text written into the document, flattened. */
const writtenText = () => docCalls.text.mock.calls.map(([value]) => String(value)).join('\n')

describe('exportProgramToPdf', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        docCalls.lastAutoTable = { finalY: 100 }
        // jsdom never fires load events for an <img>, so the logo lookup would
        // hang: fail it immediately unless a test says otherwise.
        vi.stubGlobal('Image', class {
            onload: (() => void) | null = null
            onerror: (() => void) | null = null
            naturalWidth = 64
            naturalHeight = 64
            set src(_value: string) {
                queueMicrotask(() => this.onerror?.())
            }
        })
    })

    afterEach(() => {
        vi.unstubAllGlobals()
    })

    it('writes the program heading and saves a slugged file name', async () => {
        await exportProgramToPdf(makeProgram([makeWeek(1, 'volume')]), exportLabels)

        expect(writtenText()).toContain('Blocco Forza')
        expect(writtenText()).toContain('Trainer: Marco Trainer')
        expect(docCalls.save).toHaveBeenCalledWith('program-mariorossi-blocco-forza.pdf')
    })

    it('renders one table per workout', async () => {
        await exportProgramToPdf(makeProgram([makeWeek(1, 'volume')]), exportLabels)

        expect(autoTableMock).toHaveBeenCalledTimes(1)
        const [, options] = autoTableMock.mock.calls[0] as [unknown, { body: string[][] }]
        expect(options.body[0][0]).toBe('Back Squat')
    })

    it('falls back to a placeholder row when a workout has no exercises', async () => {
        await exportProgramToPdf(makeProgram([makeWeek(1, 'volume', [])]), exportLabels)

        const [, options] = autoTableMock.mock.calls[0] as [unknown, { body: string[][] }]
        expect(options.body).toEqual([['Nessun esercizio', '', '', '', '', '', '']])
    })

    it.each<[ProgramPdfWeek['weekType'], string]>([
        ['volume', 'tipo:volume'],
        ['test', 'tipo:test'],
        ['deload', 'tipo:deload'],
    ])('labels a %s week in the workout heading', async (weekType: ProgramPdfWeek['weekType'], expected: string) => {
        await exportProgramToPdf(makeProgram([makeWeek(1, weekType)]), exportLabels)

        expect(writtenText()).toContain(expected)
    })

    it('starts a new page for every week after the first', async () => {
        await exportProgramToPdf(
            makeProgram([makeWeek(1, 'volume'), makeWeek(2, 'deload'), makeWeek(3, 'test')]),
            exportLabels
        )

        expect(docCalls.addPage).toHaveBeenCalledTimes(2)
    })

    it('does not add the logo when the image cannot be loaded', async () => {
        await exportProgramToPdf(makeProgram([makeWeek(1, 'volume')]), exportLabels)

        expect(docCalls.addImage).not.toHaveBeenCalled()
    })

    it('adds the logo when the image loads and the canvas can be read', async () => {
        vi.stubGlobal('Image', class {
            onload: (() => void) | null = null
            onerror: (() => void) | null = null
            naturalWidth = 64
            naturalHeight = 64
            set src(_value: string) {
                queueMicrotask(() => this.onload?.())
            }
        })
        const canvas = {
            width: 0,
            height: 0,
            getContext: () => ({ drawImage: vi.fn() }),
            toDataURL: () => 'data:image/png;base64,AAA',
        }
        const createElement = vi.spyOn(document, 'createElement').mockReturnValue(canvas as unknown as HTMLCanvasElement)

        await exportProgramToPdf(makeProgram([makeWeek(1, 'volume')]), exportLabels)

        expect(docCalls.addImage).toHaveBeenCalledWith('data:image/png;base64,AAA', 'PNG', 14, 10, 18, 18)
        createElement.mockRestore()
    })

    it('honours the file name prefix and the brand label from the config', async () => {
        await exportProgramToPdf(makeProgram([makeWeek(1, 'volume')]), exportLabels, {
            fileNamePrefix: 'scheda',
            brandLabel: 'Altro Brand',
        })

        expect(docCalls.save).toHaveBeenCalledWith('scheda-mariorossi-blocco-forza.pdf')
        expect(writtenText()).toContain('Altro Brand')
    })
})
