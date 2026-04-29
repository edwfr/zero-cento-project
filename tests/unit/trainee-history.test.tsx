import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import HistoryContent from '@/app/trainee/history/_content'

const historyResponse = {
    data: {
        items: [
            {
                id: 'program-active',
                title: 'Programma Attivo',
                status: 'active',
                startDate: '2026-04-01T00:00:00.000Z',
                completedAt: null,
                lastWorkoutCompletedAt: '2026-04-20T00:00:00.000Z',
                durationWeeks: 8,
                workoutsPerWeek: 4,
                createdAt: '2026-03-20T00:00:00.000Z',
                trainer: { firstName: 'Mario', lastName: 'Rossi' },
            },
            {
                id: 'program-completed',
                title: 'Programma Completato',
                status: 'completed',
                startDate: '2026-02-01T00:00:00.000Z',
                completedAt: '2026-03-20T00:00:00.000Z',
                lastWorkoutCompletedAt: '2026-03-20T00:00:00.000Z',
                durationWeeks: 6,
                workoutsPerWeek: 3,
                createdAt: '2026-01-20T00:00:00.000Z',
                trainer: { firstName: 'Luigi', lastName: 'Verdi' },
            },
        ],
    },
}

describe('HistoryContent', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        global.fetch = vi.fn(async (input: RequestInfo | URL) => {
            const url = String(input)

            if (url.includes('/api/programs?limit=100')) {
                return {
                    ok: true,
                    json: async () => historyResponse,
                } as Response
            }

            throw new Error(`Unexpected fetch: ${url}`)
        }) as unknown as typeof fetch
    })

    it('renders the stored program status directly from the programs list response', async () => {
        render(<HistoryContent />)

        expect(await screen.findByText('Programma Attivo')).toBeInTheDocument()
        expect(screen.getByText('Programma Completato')).toBeInTheDocument()

        await waitFor(() => {
            expect(screen.getAllByText('history.active').length).toBeGreaterThan(0)
            expect(screen.getAllByText('history.completed').length).toBeGreaterThan(0)
        })

        expect(global.fetch).toHaveBeenCalledTimes(1)
    })
})