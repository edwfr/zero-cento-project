import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
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
                    statusCounts: {
                        draft: 1,
                        active: 3,
                        completed: 2,
                    },
                    pagination: {
                        nextCursor: null,
                        hasMore: true,
                        currentPage: 1,
                        totalPages: 3,
                        totalItems: 60,
                        limit: 20,
                    },
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

    it('uses server-side filters before pagination and supports numeric page navigation', async () => {
        render(<TrainerProgramsContent />)

        await waitFor(() => {
            expect(global.fetch).toHaveBeenCalled()
        })

        const fetchMock = vi.mocked(global.fetch)
        const firstCall = String(fetchMock.mock.calls[0][0])
        expect(firstCall).toContain('/api/programs?')
        expect(firstCall).toContain('status=active')
        expect(firstCall).toContain('page=1')
        expect(firstCall).toContain('limit=20')

        fireEvent.click(screen.getByRole('button', { name: '2' }))

        await waitFor(() => {
            const calls = fetchMock.mock.calls
            expect(calls.length).toBeGreaterThanOrEqual(2)
            const secondCall = String(calls[calls.length - 1][0])
            expect(secondCall).toContain('page=2')
            expect(secondCall).toContain('status=active')
        })
    })

    it('does not trigger search fetch while typing and fetches only on search submit', async () => {
        render(<TrainerProgramsContent />)

        await waitFor(() => {
            expect(global.fetch).toHaveBeenCalledTimes(1)
        })

        const fetchMock = vi.mocked(global.fetch)

        fireEvent.change(screen.getByPlaceholderText('programs.searchPlaceholder'), {
            target: { value: 'Mario' },
        })

        expect(fetchMock).toHaveBeenCalledTimes(1)

        fireEvent.click(screen.getByRole('button', { name: /search/i }))

        await waitFor(() => {
            expect(fetchMock.mock.calls.length).toBeGreaterThanOrEqual(2)
            const lastCall = String(fetchMock.mock.calls[fetchMock.mock.calls.length - 1][0])
            expect(lastCall).toContain('search=Mario')
            expect(lastCall).toContain('page=1')
        })
    })
})
