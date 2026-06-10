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

const draftPrograms = [
    {
        id: 'program-draft-1',
        title: 'Bozza Programma',
        status: 'draft',
        durationWeeks: 4,
        workoutsPerWeek: 3,
        startDate: null,
        completedAt: null,
        lastWorkoutCompletedAt: null,
        trainee: {
            firstName: 'Marco',
            lastName: 'Neri',
        },
        weeks: [],
        hasTestWeeks: false,
        testsCompleted: false,
        createdAt: '2026-05-10T00:00:00.000Z',
    },
]

const completedPrograms = [
    {
        id: 'program-completed-1',
        title: 'Programma Completato',
        status: 'completed',
        durationWeeks: 6,
        workoutsPerWeek: 2,
        startDate: '2026-03-01',
        completedAt: '2026-04-15',
        lastWorkoutCompletedAt: '2026-04-15',
        trainee: {
            firstName: 'Sara',
            lastName: 'Blu',
        },
        weeks: [],
        hasTestWeeks: true,
        testsCompleted: true,
        createdAt: '2026-03-01T00:00:00.000Z',
    },
]

const makeProgramsResponse = (items: unknown[], currentPage = 1, totalItems = 60) => ({
    data: {
        items,
        statusCounts: {
            draft: 1,
            active: 3,
            completed: 2,
        },
        pagination: {
            nextCursor: null,
            hasMore: currentPage < 3,
            currentPage,
            totalPages: 3,
            totalItems,
            limit: 20,
        },
    },
})

describe('TrainerProgramsContent', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        global.fetch = vi.fn().mockImplementation(async (input: RequestInfo | URL) => {
            const rawUrl = String(input)
            const url = new URL(rawUrl, 'http://localhost')

            const status = (url.searchParams.get('status') ?? 'active') as 'draft' | 'active' | 'completed'
            const currentPage = Number(url.searchParams.get('page') ?? '1')
            const search = (url.searchParams.get('search') ?? '').toLowerCase()

            const itemsByStatus = {
                draft: draftPrograms,
                active: activePrograms,
                completed: completedPrograms,
            }

            const statusItems = itemsByStatus[status]
            const filteredItems = search.length >= 2
                ? statusItems.filter((program) => {
                    const traineeName = `${program.trainee.firstName} ${program.trainee.lastName}`.toLowerCase()
                    return program.title.toLowerCase().includes(search) || traineeName.includes(search)
                })
                : statusItems

            return {
                ok: true,
                json: async () => makeProgramsResponse(filteredItems, currentPage, filteredItems.length || 60),
            }
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
            const hasRequestedPageTwo = fetchMock.mock.calls.some((call) => {
                const url = String(call[0])
                return url.includes('status=active') && url.includes('page=2')
            })
            expect(hasRequestedPageTwo).toBe(true)
        })
    })

    it('does not trigger search fetch while typing and fetches only on search submit', async () => {
        render(<TrainerProgramsContent />)

        await waitFor(() => {
            expect(global.fetch).toHaveBeenCalled()
        })

        const fetchMock = vi.mocked(global.fetch)

        fireEvent.change(screen.getByPlaceholderText('programs.searchPlaceholder'), {
            target: { value: 'Mario' },
        })

        const hasSearchRequestBeforeSubmit = fetchMock.mock.calls.some((call) =>
            String(call[0]).includes('search=Mario')
        )
        expect(hasSearchRequestBeforeSubmit).toBe(false)

        fireEvent.click(screen.getByRole('button', { name: /search/i }))

        await waitFor(() => {
            const hasSubmittedSearchRequest = fetchMock.mock.calls.some((call) => {
                const url = String(call[0])
                return url.includes('search=Mario') && url.includes('page=1')
            })

            expect(hasSubmittedSearchRequest).toBe(true)
        })
    })

    it('switches to cached tab data immediately without rendering previous tab rows', async () => {
        render(<TrainerProgramsContent />)

        await waitFor(() => {
            expect(screen.getByText('Programma Senza Test')).toBeInTheDocument()
        })

        const fetchMock = vi.mocked(global.fetch)
        await waitFor(() => {
            const hasDraftPrefetch = fetchMock.mock.calls.some((call) => {
                const url = String(call[0])
                return url.includes('status=draft') && url.includes('page=1')
            })

            expect(hasDraftPrefetch).toBe(true)
        })

        fireEvent.click(screen.getByRole('button', { name: /programs.tabDraft/i }))

        expect(screen.queryByText('Programma Senza Test')).not.toBeInTheDocument()
        expect(screen.getByText('Bozza Programma')).toBeInTheDocument()
    })

    it('shows edit button for active programs', async () => {
        render(<TrainerProgramsContent />)

        await waitFor(() => {
            expect(screen.getByText('Programma Senza Test')).toBeInTheDocument()
        })

        const editButtons = screen.getAllByLabelText('programs.editProgramAction')
        expect(editButtons.length).toBeGreaterThan(0)

        // All active programs should have the edit button linking to /edit
        for (const btn of editButtons) {
            expect(btn.closest('a')).toHaveAttribute('href', expect.stringMatching(/\/edit$/))
        }
    })
})
