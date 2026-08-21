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
                                    comments: [],
                                    rows: [
                                        {
                                            workoutExerciseId: 'row-1',
                                            exerciseName: 'Squat',
                                            sets: 3,
                                            reps: '5',
                                            rpe: 8,
                                            weightUsed: '100 kg',
                                            comments: 'Prima serie',
                                            feedbackDate: '2026-05-10',
                                        },
                                        {
                                            workoutExerciseId: 'row-2',
                                            exerciseName: 'Panca',
                                            sets: 4,
                                            reps: '6',
                                            rpe: 7.5,
                                            weightUsed: '80 kg',
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
        expect(table).toHaveClass('min-w-[860px]')
        expect(thead).toHaveClass('bg-slate-200')
        expect(bodyRows).toHaveLength(2)
        expect(bodyRows[0]).toHaveClass('bg-white')
        expect(bodyRows[1]).toHaveClass('bg-gray-50')
        expect(screen.getByLabelText('testResults.workoutCompletedStatus')).toBeInTheDocument()
        expect(screen.getByText('weekTypes.test')).toBeInTheDocument()
        expect(screen.queryByText('editProgram.workoutsConfiguredShort')).not.toBeInTheDocument()
        expect(screen.queryByText('editProgram.exercisesCount')).not.toBeInTheDocument()
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
