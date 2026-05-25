import { describe, it, expect, beforeEach, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'

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

import TraineeDetailContent from '@/app/trainer/trainees/[id]/_content'

describe('TraineeDetailContent SBD report', () => {
    beforeEach(() => {
        vi.clearAllMocks()

        const now = new Date()
        const isoDaysAgo = (days: number) => new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString()
        const isoDaysAhead = (days: number) => new Date(now.getTime() + days * 24 * 60 * 60 * 1000).toISOString()

        global.fetch = vi.fn(async (input: RequestInfo | URL) => {
            const url = String(input)

            if (url.includes('/api/users/') && url.endsWith('/reports/planned-training-sets')) {
                return {
                    ok: true,
                    json: async () => ({
                        data: {
                            points: [
                                {
                                    date: isoDaysAgo(10),
                                    fundamentalSets: { squat: 2, bench: 1, deadlift: 0 },
                                },
                                {
                                    date: isoDaysAgo(70),
                                    fundamentalSets: { squat: 1, bench: 2, deadlift: 1 },
                                },
                                {
                                    date: isoDaysAgo(240),
                                    fundamentalSets: { squat: 5, bench: 5, deadlift: 5 },
                                },
                                {
                                    date: isoDaysAhead(14),
                                    fundamentalSets: { squat: 3, bench: 3, deadlift: 3 },
                                },
                            ],
                        },
                    }),
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

            if (url.includes('/api/programs?traineeId=')) {
                return {
                    ok: true,
                    json: async () => ({ data: { items: [] } }),
                } as Response
            }

            if (url.includes('/api/personal-records?traineeId=')) {
                return {
                    ok: true,
                    json: async () => ({ data: { items: [] } }),
                } as Response
            }

            throw new Error(`Unexpected fetch: ${url}`)
        }) as unknown as typeof fetch
    })

    it('shows KPI cards per fundamental, updates on window changes, and can include future weeks', async () => {
        render(<TraineeDetailContent />)

        expect(await screen.findByText('Mario Rossi')).toBeInTheDocument()

        fireEvent.click(screen.getByRole('button', { name: 'athletes.reportsTab' }))

        await waitFor(() => {
            expect(screen.getByTestId('sbd-kpi-card-squat')).toBeInTheDocument()
            expect(screen.getByTestId('sbd-kpi-card-bench')).toBeInTheDocument()
            expect(screen.getByTestId('sbd-kpi-card-deadlift')).toBeInTheDocument()
        })

        expect(screen.getByTestId('sbd-kpi-frq-squat')).toHaveTextContent('2')
        expect(screen.getByTestId('sbd-kpi-nbl-squat')).toHaveTextContent('3')
        expect(screen.getByTestId('sbd-kpi-frq-bench')).toHaveTextContent('2')
        expect(screen.getByTestId('sbd-kpi-nbl-bench')).toHaveTextContent('3')
        expect(screen.getByTestId('sbd-kpi-frq-deadlift')).toHaveTextContent('1')
        expect(screen.getByTestId('sbd-kpi-nbl-deadlift')).toHaveTextContent('1')

        const windowSelects = screen.getAllByRole('combobox')
        fireEvent.change(windowSelects[1], { target: { value: '30d' } })

        await waitFor(() => {
            expect(screen.getByTestId('sbd-kpi-frq-squat')).toHaveTextContent('1')
            expect(screen.getByTestId('sbd-kpi-nbl-squat')).toHaveTextContent('2')
            expect(screen.getByTestId('sbd-kpi-frq-bench')).toHaveTextContent('1')
            expect(screen.getByTestId('sbd-kpi-nbl-bench')).toHaveTextContent('1')
            expect(screen.getByTestId('sbd-kpi-frq-deadlift')).toHaveTextContent('0')
            expect(screen.getByTestId('sbd-kpi-nbl-deadlift')).toHaveTextContent('0')
        })

        const includeFutureWeeksToggle = screen.getByLabelText('athletes.reportingIncludeFutureWeeks')
        fireEvent.click(includeFutureWeeksToggle)

        await waitFor(() => {
            expect(screen.getByTestId('sbd-kpi-frq-squat')).toHaveTextContent('2')
            expect(screen.getByTestId('sbd-kpi-nbl-squat')).toHaveTextContent('5')
            expect(screen.getByTestId('sbd-kpi-frq-bench')).toHaveTextContent('2')
            expect(screen.getByTestId('sbd-kpi-nbl-bench')).toHaveTextContent('4')
            expect(screen.getByTestId('sbd-kpi-frq-deadlift')).toHaveTextContent('1')
            expect(screen.getByTestId('sbd-kpi-nbl-deadlift')).toHaveTextContent('3')
        })
    })
})
