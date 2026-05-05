import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import TraineeDashboardContent from '@/app/trainee/dashboard/_content'

const programsResponse = {
    data: {
        items: [
            {
                id: 'program-1',
                title: 'Programma A',
                status: 'active',
                startDate: '2026-04-01T00:00:00.000Z',
                completedAt: null,
                lastWorkoutCompletedAt: null,
                createdAt: '2026-03-20T00:00:00.000Z',
                durationWeeks: 8,
                workoutsPerWeek: 4,
                trainer: { firstName: 'Mario', lastName: 'Rossi' },
            },
        ],
    },
}

const progressResponse = {
    data: {
        completedWorkouts: 2,
        totalWorkouts: 10,
        nextWorkout: null,
    },
}

describe('TraineeDashboardContent', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        global.fetch = vi.fn(async (input: RequestInfo | URL) => {
            const url = String(input)

            if (url.includes('/api/programs?limit=10')) {
                return {
                    ok: true,
                    json: async () => programsResponse,
                } as Response
            }

            if (url.includes('/api/programs/program-1/progress')) {
                return {
                    ok: true,
                    json: async () => progressResponse,
                } as Response
            }

            throw new Error(`Unexpected fetch: ${url}`)
        }) as unknown as typeof fetch
    })

    it('links the active program card to current with the explicit programId', async () => {
        render(<TraineeDashboardContent />)

        const link = await screen.findByRole('link', {
            name: 'trainee:dashboard.viewFullProgram',
        })

        await waitFor(() => {
            expect(link).toHaveAttribute('href', '/trainee/programs/current?programId=program-1')
        })
    })
})