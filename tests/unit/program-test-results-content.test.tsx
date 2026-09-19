import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'

vi.mock('next/navigation', () => ({
    useParams: () => ({ id: 'program-1' }),
}))

vi.mock('@/components/ToastNotification', () => ({
    useToast: () => ({ showToast: vi.fn() }),
}))

import ProgramTestResultsContent from '@/app/trainer/programs/[id]/tests/_content'

describe('ProgramTestResultsContent', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        global.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({
                data: {
                    programId: 'program-1',
                    programName: 'Programma Test',
                    trainee: {
                        id: 'trainee-1',
                        firstName: 'Mario',
                        lastName: 'Rossi',
                    },
                    weeks: [
                        {
                            weekId: 'week-1',
                            weekNumber: 1,
                            weekType: 'test',
                            startDate: '2026-05-10',
                            workouts: [
                                {
                                    workoutId: 'workout-1',
                                    dayIndex: 1,
                                    isCompleted: true,
                                    workoutSummaryComment: 'Commento riepilogo',
                                    sleepQuality: 4,
                                    stressLevel: null,
                                    nutritionQuality: 2,
                                    comments: [],
                                    rows: [
                                        {
                                            workoutExerciseId: 'row-1',
                                            exerciseName: 'Squat',
                                            sets: 3,
                                            reps: '5',
                                            rpe: 8,
                                            plannedWeight: 100,
                                            repsDone: '5 / 5 / 4',
                                            rpeDone: '7.5 / 8 / 9',
                                            weightUsed: '100 / 100 / 102.5',
                                            comments: 'Prima serie',
                                            feedbackDate: '2026-05-10',
                                        },
                                        {
                                            workoutExerciseId: 'row-2',
                                            exerciseName: 'Panca',
                                            sets: 4,
                                            reps: '6',
                                            rpe: 7.5,
                                            plannedWeight: null,
                                            repsDone: '-',
                                            rpeDone: '-',
                                            weightUsed: '-',
                                            comments: null,
                                            feedbackDate: '2026-05-10',
                                        },
                                    ],
                                },
                            ],
                        },
                    ],
                },
            }),
        }) as unknown as typeof fetch
    })

    it('renders table with compact view-style classes', async () => {
        render(<ProgramTestResultsContent />)

        const openWorkoutButton = await screen.findByRole('button', {
            name: 'testResults.openWorkoutDetails',
        })
        expect(openWorkoutButton).toBeInTheDocument()
        expect(screen.queryByText('Squat')).not.toBeInTheDocument()

        fireEvent.click(openWorkoutButton)

        await waitFor(() => {
            expect(screen.getByText('Squat')).toBeInTheDocument()
        })

        const table = screen.getByRole('table')
        const thead = table.querySelector('thead')
        const bodyRows = table.querySelectorAll('tbody tr')

        expect(table).toHaveClass('table-fixed')
        expect(table).toHaveClass('min-w-[1100px]')
        expect(thead).toHaveClass('bg-slate-200')
        expect(bodyRows).toHaveLength(2)
        expect(bodyRows[0]).toHaveClass('bg-white')
        expect(bodyRows[1]).toHaveClass('bg-gray-50')
        expect(screen.getByLabelText('testResults.workoutCompletedStatus')).toBeInTheDocument()
        expect(screen.getByText('weekTypes.test')).toBeInTheDocument()
        expect(screen.getByText('testResults.sleepQuality')).toBeInTheDocument()
        expect(screen.getByText('testResults.stressLevel')).toBeInTheDocument()
        expect(screen.getByText('testResults.nutritionQuality')).toBeInTheDocument()
        expect(screen.getAllByLabelText('testResults.ratingValue')).toHaveLength(2)
        expect(screen.getByLabelText('testResults.ratingNotProvided')).toBeInTheDocument()
        expect(screen.queryByText('editProgram.workoutsConfiguredShort')).not.toBeInTheDocument()
        expect(screen.queryByText('editProgram.exercisesCount')).not.toBeInTheDocument()
    })

    it('renders planned and performed columns with per-set values', async () => {
        render(<ProgramTestResultsContent />)

        fireEvent.click(await screen.findByRole('button', { name: 'testResults.openWorkoutDetails' }))
        await screen.findByText('Squat')

        const headers = screen.getAllByRole('columnheader').map((header) => header.textContent)
        expect(headers).toEqual([
            'testResults.colExercise',
            'testResults.colSets',
            'testResults.colReps',
            'testResults.colRpe',
            'testResults.colPlannedWeight',
            'testResults.colRepsDone',
            'testResults.colRpeDone',
            'testResults.colWeight',
            'testResults.colCommentInfo',
        ])

        const squatCells = screen.getAllByRole('row')[1].querySelectorAll('td')
        expect(Array.from(squatCells).slice(1, 8).map((cell) => cell.textContent)).toEqual([
            '3',
            '5',
            '8.0',
            '100',
            '5 / 5 / 4',
            '7.5 / 8 / 9',
            '100 / 100 / 102.5',
        ])

        const benchCells = screen.getAllByRole('row')[2].querySelectorAll('td')
        expect(Array.from(benchCells).slice(4, 8).map((cell) => cell.textContent)).toEqual(['-', '-', '-', '-'])
    })

    it('shows comment info icon only for exercises with a comment and reveals it on hover', async () => {
        render(<ProgramTestResultsContent />)

        fireEvent.click(await screen.findByRole('button', { name: 'testResults.openWorkoutDetails' }))
        await screen.findByText('Squat')

        const infoButtons = screen.getAllByRole('button', { name: 'testResults.colCommentInfo' })
        expect(infoButtons).toHaveLength(1)
        expect(screen.queryByText('Prima serie')).not.toBeInTheDocument()

        fireEvent.mouseOver(infoButtons[0])

        expect(await screen.findByRole('tooltip')).toHaveTextContent('Prima serie')
    })

    it('supports collapsing and expanding week and workout panels', async () => {
        render(<ProgramTestResultsContent />)

        const openWorkoutButton = await screen.findByRole('button', {
            name: 'testResults.openWorkoutDetails',
        })
        fireEvent.click(openWorkoutButton)

        expect(await screen.findByText('Squat')).toBeInTheDocument()

        const closeWeekButton = screen.getByRole('button', {
            name: 'testResults.closeWeek',
        })
        fireEvent.click(closeWeekButton)

        await waitFor(() => {
            expect(screen.queryByText('Squat')).not.toBeInTheDocument()
        })

        const openWeekButton = screen.getByRole('button', {
            name: 'testResults.openWeek',
        })
        fireEvent.click(openWeekButton)

        expect(await screen.findByText('Squat')).toBeInTheDocument()

        const closeWorkoutButton = screen.getByRole('button', {
            name: 'testResults.closeWorkoutDetails',
        })
        fireEvent.click(closeWorkoutButton)

        await waitFor(() => {
            expect(screen.queryByText('Squat')).not.toBeInTheDocument()
        })

        const reopenWorkoutButton = screen.getByRole('button', {
            name: 'testResults.openWorkoutDetails',
        })
        fireEvent.click(reopenWorkoutButton)

        expect(await screen.findByText('Squat')).toBeInTheDocument()
    })
})
