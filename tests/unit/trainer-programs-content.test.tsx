import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import TrainerProgramsContent from '@/app/trainer/programs/_content'

vi.mock('@/components/ToastNotification', () => ({
    useToast: () => ({ showToast: vi.fn() }),
}))

const activePrograms = [
    {
        id: 'program-1',
        title: 'Programma Senza Test',
        status: 'active',
        durationWeeks: 8,
        workoutsPerWeek: 3,
        startDate: '2026-05-01',
        completedAt: null,
        lastWorkoutCompletedAt: null,
        trainee: {
            firstName: 'Mario',
            lastName: 'Rossi',
        },
        weeks: [],
        hasTestWeeks: false,
        testsCompleted: false,
        createdAt: '2026-05-01T00:00:00.000Z',
    },
    {
        id: 'program-2',
        title: 'Programma Test Da Fare',
        status: 'active',
        durationWeeks: 6,
        workoutsPerWeek: 4,
        startDate: '2026-05-05',
        completedAt: null,
        lastWorkoutCompletedAt: null,
        trainee: {
            firstName: 'Luigi',
            lastName: 'Verdi',
        },
        weeks: [],
        hasTestWeeks: true,
        testsCompleted: false,
        createdAt: '2026-05-05T00:00:00.000Z',
    },
    {
        id: 'program-3',
        title: 'Programma Test Fatti',
        status: 'active',
        durationWeeks: 10,
        workoutsPerWeek: 5,
        startDate: '2026-04-20',
        completedAt: null,
        lastWorkoutCompletedAt: null,
        trainee: {
            firstName: 'Anna',
            lastName: 'Bianchi',
        },
        weeks: [],
        hasTestWeeks: true,
        testsCompleted: true,
        createdAt: '2026-04-20T00:00:00.000Z',
    },
]

describe('TrainerProgramsContent', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        global.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({
                data: {
                    items: activePrograms,
                },
            }),
        }) as unknown as typeof fetch
    })

    it('renders icon test status with tooltip for not planned, pending, and completed tests', async () => {
        render(<TrainerProgramsContent />)

        await waitFor(() => {
            expect(screen.getByText('Programma Senza Test')).toBeInTheDocument()
        })

        const noTestsIcon = screen.getByLabelText('programs.testStatusNoTestsTooltip')
        const pendingTestsIcon = screen.getByLabelText('programs.testStatusPendingTooltip')
        const completedTestsIcon = screen.getByLabelText('programs.testStatusCompletedTooltip')

        expect(noTestsIcon).toHaveAttribute('title', 'programs.testStatusNoTestsTooltip')
        expect(pendingTestsIcon).toHaveAttribute('title', 'programs.testStatusPendingTooltip')
        expect(completedTestsIcon).toHaveAttribute('title', 'programs.testStatusCompletedTooltip')

        expect(screen.queryByText('programs.noTestWeeks')).not.toBeInTheDocument()
        expect(screen.queryByText('programs.testsPending')).not.toBeInTheDocument()
        expect(screen.queryByText('programs.testsCompleted')).not.toBeInTheDocument()
    })
})
