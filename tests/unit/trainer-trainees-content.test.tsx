import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import TrainerTraineesContent from '@/app/trainer/trainees/_content'

vi.mock('@/components/ToastNotification', () => ({
    useToast: () => ({ showToast: vi.fn() }),
}))

interface MockTrainee {
    id: string
    firstName: string
    lastName: string
    email: string
    isActive: boolean
    createdAt: string
}

const mockTrainees: MockTrainee[] = Array.from({ length: 50 }, (_, idx) => ({
    id: `trainee-${idx + 1}`,
    firstName: `Mario${idx + 1}`,
    lastName: 'Rossi',
    email: `mario${idx + 1}@example.com`,
    isActive: idx < 40,
    createdAt: `2026-01-${String((idx % 28) + 1).padStart(2, '0')}T00:00:00.000Z`,
}))

function buildUsersResponse(url: string) {
    const parsed = new URL(url, 'http://localhost:3000')
    const status = parsed.searchParams.get('status') ?? 'active'
    const page = Number(parsed.searchParams.get('page') ?? '1')
    const limit = Number(parsed.searchParams.get('limit') ?? '20')
    const search = (parsed.searchParams.get('search') ?? '').toLowerCase()

    let filtered = [...mockTrainees]

    if (status === 'active') {
        filtered = filtered.filter((trainee) => trainee.isActive)
    } else if (status === 'inactive') {
        filtered = filtered.filter((trainee) => !trainee.isActive)
    }

    if (search) {
        filtered = filtered.filter((trainee) =>
            trainee.firstName.toLowerCase().includes(search) ||
            trainee.lastName.toLowerCase().includes(search) ||
            trainee.email.toLowerCase().includes(search)
        )
    }

    const totalItems = filtered.length
    const totalPages = Math.max(1, Math.ceil(totalItems / limit))
    const resolvedPage = Math.min(page, totalPages)
    const start = (resolvedPage - 1) * limit
    const items = filtered.slice(start, start + limit)

    return {
        data: {
            items,
            statusCounts: {
                all: mockTrainees.length,
                active: mockTrainees.filter((trainee) => trainee.isActive).length,
                inactive: mockTrainees.filter((trainee) => !trainee.isActive).length,
            },
            pagination: {
                nextCursor: null,
                hasMore: resolvedPage < totalPages,
                currentPage: resolvedPage,
                totalPages,
                totalItems,
                limit,
            },
        },
    }
}

describe('TrainerTraineesContent', () => {
    beforeEach(() => {
        vi.clearAllMocks()

        global.fetch = vi.fn(async (input: RequestInfo | URL) => {
            const url = String(input)

            if (url.startsWith('/api/users?')) {
                return {
                    ok: true,
                    json: async () => buildUsersResponse(url),
                } as Response
            }

            if (url.includes('/api/users/') && (url.endsWith('/activate') || url.endsWith('/deactivate'))) {
                return {
                    ok: true,
                    json: async () => ({ data: { success: true } }),
                } as Response
            }

            return {
                ok: false,
                json: async () => ({ error: { message: 'Unexpected request' } }),
            } as Response
        }) as unknown as typeof fetch
    })

    it('uses server-side filters before pagination and supports numeric page navigation', async () => {
        render(<TrainerTraineesContent />)

        await waitFor(() => {
            expect(global.fetch).toHaveBeenCalled()
        })

        const fetchMock = vi.mocked(global.fetch)
        const firstCall = String(fetchMock.mock.calls[0][0])

        expect(firstCall).toContain('/api/users?')
        expect(firstCall).toContain('role=trainee')
        expect(firstCall).toContain('includeInactive=true')
        expect(firstCall).toContain('status=active')
        expect(firstCall).toContain('page=1')
        expect(firstCall).toContain('limit=20')

        fireEvent.click(screen.getByRole('button', { name: '2' }))

        await waitFor(() => {
            const calls = fetchMock.mock.calls
            expect(calls.length).toBeGreaterThanOrEqual(2)
            const lastCall = String(calls[calls.length - 1][0])
            expect(lastCall).toContain('page=2')
            expect(lastCall).toContain('status=active')
        })
    })

    it('does not trigger search fetch while typing and fetches only on explicit submit', async () => {
        render(<TrainerTraineesContent />)

        await waitFor(() => {
            expect(global.fetch).toHaveBeenCalledTimes(1)
        })

        const fetchMock = vi.mocked(global.fetch)

        fireEvent.change(screen.getByPlaceholderText('athletes.searchPlaceholder'), {
            target: { value: 'Mario' },
        })

        expect(fetchMock).toHaveBeenCalledTimes(1)

        fireEvent.click(screen.getByRole('button', { name: 'common:common.search' }))

        await waitFor(() => {
            expect(fetchMock.mock.calls.length).toBeGreaterThanOrEqual(2)
            const lastCall = String(fetchMock.mock.calls[fetchMock.mock.calls.length - 1][0])
            expect(lastCall).toContain('search=Mario')
            expect(lastCall).toContain('page=1')
        })
    })

    it('resets to page 1 when status filter changes', async () => {
        render(<TrainerTraineesContent />)

        await waitFor(() => {
            expect(global.fetch).toHaveBeenCalledTimes(1)
        })

        const fetchMock = vi.mocked(global.fetch)

        fireEvent.click(screen.getByRole('button', { name: '2' }))

        await waitFor(() => {
            const lastCall = String(fetchMock.mock.calls[fetchMock.mock.calls.length - 1][0])
            expect(lastCall).toContain('page=2')
        })

        fireEvent.change(screen.getByRole('combobox'), {
            target: { value: 'inactive' },
        })

        await waitFor(() => {
            const lastCall = String(fetchMock.mock.calls[fetchMock.mock.calls.length - 1][0])
            expect(lastCall).toContain('status=inactive')
            expect(lastCall).toContain('page=1')
        })
    })
})
