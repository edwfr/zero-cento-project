import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'

vi.mock('next/navigation', () => ({
    useParams: () => ({ id: 'trainee-1' }),
}))

vi.mock('recharts', () => {
    const React = require('react')

    const Wrapper = ({ children, ...props }: any) => React.createElement('div', props, children)

    return {
        ResponsiveContainer: ({ children }: any) => React.createElement('div', { 'data-testid': 'recharts-responsive-container' }, children),
        LineChart: Wrapper,
        Line: () => null,
        CartesianGrid: () => null,
        Legend: () => null,
        Tooltip: () => null,
        XAxis: () => null,
        YAxis: () => null,
    }
})

vi.mock('@/components/TraineePlannedMuscleGroupReport', () => {
    const React = require('react')
    return {
        default: () => React.createElement('div', { 'data-testid': 'planned-muscle-report' }),
    }
})

vi.mock('@/app/trainer/trainees/[id]/_trainee-notes-editor', () => {
    const React = require('react')
    return {
        default: ({ onChange }: { onChange: (document: unknown) => void }) => React.createElement(
            'button',
            {
                type: 'button',
                onClick: () => onChange({
                    type: 'doc',
                    content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Updated note' }] }],
                }),
            },
            'Edit note'
        ),
    }
})

vi.mock('@/components', async () => {
    const actual = await vi.importActual<typeof import('@/components')>('@/components')
    return {
        ...actual,
        useToast: () => ({ showToast: vi.fn() }),
    }
})

import TraineeDetailContent from '@/app/trainer/trainees/[id]/_content'

type ProgramStatus = 'draft' | 'active' | 'completed'

describe('TraineeDetailContent Programs tab', () => {
    beforeEach(() => {
        vi.clearAllMocks()

        const now = new Date()
        const isoDaysAgo = (days: number) => new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString()

        const programsByStatus: Record<ProgramStatus, Array<Record<string, unknown>>> = {
            active: [
                {
                    id: 'prog-active-pending',
                    title: 'Programma Active Pending',
                    status: 'active',
                    durationWeeks: 8,
                    workoutsPerWeek: 4,
                    startDate: isoDaysAgo(30),
                    createdAt: isoDaysAgo(40),
                    endDate: null,
                    updatedAt: isoDaysAgo(2),
                    completedAt: null,
                    lastWorkoutCompletedAt: null,
                    trainee: { firstName: 'Mario', lastName: 'Rossi' },
                    weeks: [{ id: 'w-1', weekNumber: 1, weekType: 'test' }],
                    hasTestWeeks: true,
                    testsCompleted: false,
                    testWeeks: [1],
                },
                {
                    id: 'prog-active-done',
                    title: 'Programma Active Done',
                    status: 'active',
                    durationWeeks: 10,
                    workoutsPerWeek: 3,
                    startDate: isoDaysAgo(45),
                    createdAt: isoDaysAgo(55),
                    endDate: null,
                    updatedAt: isoDaysAgo(3),
                    completedAt: null,
                    lastWorkoutCompletedAt: isoDaysAgo(4),
                    trainee: { firstName: 'Mario', lastName: 'Rossi' },
                    weeks: [{ id: 'w-2', weekNumber: 2, weekType: 'test' }],
                    hasTestWeeks: true,
                    testsCompleted: true,
                    testWeeks: [2],
                },
            ],
            draft: [
                {
                    id: 'prog-draft-1',
                    title: 'Programma Draft',
                    status: 'draft',
                    durationWeeks: 6,
                    workoutsPerWeek: 3,
                    startDate: null,
                    createdAt: isoDaysAgo(20),
                    endDate: null,
                    updatedAt: isoDaysAgo(1),
                    completedAt: null,
                    lastWorkoutCompletedAt: null,
                    trainee: { firstName: 'Mario', lastName: 'Rossi' },
                    weeks: [],
                    hasTestWeeks: false,
                    testsCompleted: false,
                    testWeeks: [],
                },
            ],
            completed: [
                {
                    id: 'prog-completed-1',
                    title: 'Programma Completed',
                    status: 'completed',
                    durationWeeks: 5,
                    workoutsPerWeek: 2,
                    startDate: isoDaysAgo(80),
                    createdAt: isoDaysAgo(90),
                    endDate: isoDaysAgo(45),
                    updatedAt: isoDaysAgo(44),
                    completedAt: isoDaysAgo(45),
                    lastWorkoutCompletedAt: isoDaysAgo(45),
                    trainee: { firstName: 'Mario', lastName: 'Rossi' },
                    weeks: [{ id: 'w-3', weekNumber: 3, weekType: 'test' }],
                    hasTestWeeks: true,
                    testsCompleted: true,
                    testWeeks: [3],
                },
            ],
        }

        global.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
            const url = String(input)
            const method = init?.method ?? 'GET'

            if (url === '/api/trainer/trainees/trainee-1/notes') {
                if (method === 'PUT') {
                    return {
                        ok: true,
                        json: async () => ({
                            data: {
                                document: JSON.parse(String(init?.body)).document,
                                updatedAt: '2026-08-27T10:00:00.000Z',
                            },
                        }),
                    } as Response
                }

                return {
                    ok: true,
                    json: async () => ({
                        data: {
                            document: { type: 'doc', content: [{ type: 'paragraph' }] },
                            updatedAt: null,
                        },
                    }),
                } as Response
            }

            if (method === 'DELETE' && url.includes('/api/programs/')) {
                const programId = url.split('/api/programs/')[1]
                for (const status of ['draft', 'active', 'completed'] as ProgramStatus[]) {
                    programsByStatus[status] = programsByStatus[status].filter((item) => item.id !== programId)
                }

                return {
                    ok: true,
                    json: async () => ({ data: { message: 'deleted' } }),
                } as Response
            }

            if (url.includes('/api/programs?')) {
                const parsed = new URL(url, 'http://localhost')
                const status = (parsed.searchParams.get('status') ?? 'active') as ProgramStatus
                const search = (parsed.searchParams.get('search') ?? '').toLowerCase()
                const page = Number(parsed.searchParams.get('page') ?? '1')

                const filtered = search.length >= 2
                    ? programsByStatus[status].filter((program) =>
                        String(program.title).toLowerCase().includes(search)
                    )
                    : programsByStatus[status]

                return {
                    ok: true,
                    json: async () => ({
                        data: {
                            items: filtered,
                            statusCounts: {
                                draft: programsByStatus.draft.length,
                                active: programsByStatus.active.length,
                                completed: programsByStatus.completed.length,
                            },
                            pagination: {
                                nextCursor: null,
                                hasMore: false,
                                currentPage: page,
                                totalPages: 1,
                                totalItems: filtered.length,
                                limit: 20,
                            },
                        },
                    }),
                } as Response
            }

            if (url.includes('/api/users/') && url.endsWith('/reports/planned-training-sets')) {
                return {
                    ok: true,
                    json: async () => ({ data: { points: [] } }),
                } as Response
            }

            if (url.includes('/api/personal-records?traineeId=')) {
                return {
                    ok: true,
                    json: async () => ({ data: { items: [] } }),
                } as Response
            }

            if (url.includes('/api/users/')) {
                return {
                    ok: true,
                    json: async () => ({
                        data: {
                            user: {
                                id: 'trainee-1',
                                firstName: 'Mario',
                                lastName: 'Rossi',
                                email: 'mario.rossi@example.com',
                                isActive: true,
                                createdAt: isoDaysAgo(365),
                            },
                        },
                    }),
                } as Response
            }

            throw new Error(`Unexpected fetch: ${url}`)
        }) as unknown as typeof fetch
    })

    it('queries programs with traineeId+status and keeps view-test links clickable for active items', async () => {
        render(<TraineeDetailContent />)

        expect(await screen.findByText('Programma Active Pending')).toBeInTheDocument()

        const fetchMock = vi.mocked(global.fetch)
        const firstProgramsCall = fetchMock.mock.calls.find((call) => String(call[0]).includes('/api/programs?'))
        expect(String(firstProgramsCall?.[0])).toContain('traineeId=trainee-1')
        expect(String(firstProgramsCall?.[0])).toContain('status=active')
        expect(String(firstProgramsCall?.[0])).toContain('page=1')
        expect(String(firstProgramsCall?.[0])).toContain('limit=20')

        const viewTestsLinks = screen.getAllByLabelText('programs.viewTests')
        expect(viewTestsLinks).toHaveLength(2)

        const pendingProgramViewTestsLink = viewTestsLinks[0].closest('a')
        expect(pendingProgramViewTestsLink).toHaveAttribute(
            'href',
            '/trainer/programs/prog-active-pending/tests?backContext=trainee&traineeId=trainee-1'
        )

        const completedProgramViewTestsLink = viewTestsLinks[1].closest('a')
        expect(completedProgramViewTestsLink).toHaveAttribute(
            'href',
            '/trainer/programs/prog-active-done/tests?backContext=trainee&traineeId=trainee-1'
        )
    })

    it('places Notes before Programs, loads it on demand, and saves only after an edit', async () => {
        render(<TraineeDetailContent />)

        await screen.findByText('Programma Active Pending')
        const notesTab = screen.getByRole('button', { name: 'athletes.notesTab' })
        const programsTab = screen.getByRole('button', { name: /athletes.programsTab/i })

        expect(notesTab.compareDocumentPosition(programsTab) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
        expect(vi.mocked(global.fetch).mock.calls.some((call) => String(call[0]).includes('/notes'))).toBe(false)

        fireEvent.click(notesTab)
        await screen.findByRole('button', { name: 'Edit note' })

        expect(vi.mocked(global.fetch).mock.calls.some((call) => String(call[0]).includes('/notes'))).toBe(true)

        const saveButton = screen.getByRole('button', { name: 'common:common.save' })
        expect(saveButton).toBeDisabled()

        fireEvent.click(screen.getByRole('button', { name: 'Edit note' }))

        await waitFor(() => {
            expect(screen.getByRole('button', { name: 'common:common.save' })).not.toBeDisabled()
        })

        fireEvent.click(screen.getByRole('button', { name: 'common:common.save' }))

        await waitFor(() => {
            const saveCall = vi.mocked(global.fetch).mock.calls.find(
                (call) => String(call[0]).includes('/notes') && call[1]?.method === 'PUT'
            )
            expect(saveCall).toBeDefined()
        })
    })

    it('shows draft delete flow with confirmation and refetch', async () => {
        render(<TraineeDetailContent />)

        expect(await screen.findByText('Programma Active Pending')).toBeInTheDocument()

        fireEvent.click(screen.getByRole('button', { name: /programs.tabDraft/i }))
        expect(await screen.findByText('Programma Draft')).toBeInTheDocument()

        fireEvent.click(screen.getByRole('button', { name: 'programs.delete' }))

        const dialog = await screen.findByRole('dialog')
        expect(within(dialog).getByText('programs.deleteProgram')).toBeInTheDocument()
        fireEvent.click(within(dialog).getByText('programs.delete'))

        await waitFor(() => {
            const deleteCall = vi
                .mocked(global.fetch)
                .mock.calls.find(
                    (call) => String(call[0]).includes('/api/programs/prog-draft-1') && call[1]?.method === 'DELETE'
                )
            expect(deleteCall).toBeDefined()
        })

        await waitFor(() => {
            expect(screen.getByText('programs.noDraftPrograms')).toBeInTheDocument()
        })
    })
})
