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

vi.mock('@/components', async () => {
    const actual = await vi.importActual<typeof import('@/components')>('@/components')
    return {
        ...actual,
        useToast: () => ({ showToast: vi.fn() }),
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
                                    fundamentalLifts: { squat: 10, bench: 8, deadlift: 0 },
                                    fundamentalMetrics: {
                                        squat: { frequency: 1, totalLifts: 10, averageIntensity: 80 },
                                        bench: { frequency: 1, totalLifts: 8, averageIntensity: 75 },
                                        deadlift: null,
                                    },
                                },
                                {
                                    date: isoDaysAgo(70),
                                    fundamentalSets: { squat: 1, bench: 2, deadlift: 1 },
                                    fundamentalLifts: { squat: 6, bench: 12, deadlift: 5 },
                                    fundamentalMetrics: {
                                        squat: { frequency: 1, totalLifts: 6, averageIntensity: 70 },
                                        bench: { frequency: 1, totalLifts: 12, averageIntensity: 70 },
                                        deadlift: { frequency: 1, totalLifts: 5, averageIntensity: null },
                                    },
                                },
                                {
                                    date: isoDaysAgo(240),
                                    fundamentalSets: { squat: 5, bench: 5, deadlift: 5 },
                                    fundamentalLifts: { squat: 25, bench: 25, deadlift: 25 },
                                    fundamentalMetrics: {
                                        squat: { frequency: 1, totalLifts: 25, averageIntensity: 60 },
                                        bench: { frequency: 1, totalLifts: 25, averageIntensity: 60 },
                                        deadlift: { frequency: 1, totalLifts: 25, averageIntensity: 60 },
                                    },
                                },
                                {
                                    date: isoDaysAhead(14),
                                    fundamentalSets: { squat: 3, bench: 3, deadlift: 3 },
                                    fundamentalLifts: { squat: 12, bench: 12, deadlift: 12 },
                                    fundamentalMetrics: {
                                        squat: { frequency: 1, totalLifts: 12, averageIntensity: 85 },
                                        bench: { frequency: 1, totalLifts: 12, averageIntensity: 85 },
                                        deadlift: { frequency: 1, totalLifts: 12, averageIntensity: 85 },
                                    },
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
        expect(screen.getByTestId('sbd-kpi-nbl-squat')).toHaveTextContent('16')
        expect(screen.getByTestId('sbd-kpi-frq-bench')).toHaveTextContent('2')
        expect(screen.getByTestId('sbd-kpi-nbl-bench')).toHaveTextContent('20')
        expect(screen.getByTestId('sbd-kpi-frq-deadlift')).toHaveTextContent('1')
        expect(screen.getByTestId('sbd-kpi-nbl-deadlift')).toHaveTextContent('5')

        // IM squat = weighted avg by NBL: (80*10 + 70*6) / 16 = 76.3%
        expect(screen.getByTestId('sbd-kpi-im-squat')).toHaveTextContent('76.3%')
        // IM deadlift: only entry with null intensity → placeholder '-'
        expect(screen.getByTestId('sbd-kpi-im-deadlift')).toHaveTextContent('-')

        const windowSelects = screen.getAllByRole('combobox')
        fireEvent.change(windowSelects[1], { target: { value: '30d' } })

        await waitFor(() => {
            expect(screen.getByTestId('sbd-kpi-frq-squat')).toHaveTextContent('1')
            expect(screen.getByTestId('sbd-kpi-nbl-squat')).toHaveTextContent('10')
            expect(screen.getByTestId('sbd-kpi-frq-bench')).toHaveTextContent('1')
            expect(screen.getByTestId('sbd-kpi-nbl-bench')).toHaveTextContent('8')
            expect(screen.getByTestId('sbd-kpi-frq-deadlift')).toHaveTextContent('0')
            expect(screen.getByTestId('sbd-kpi-nbl-deadlift')).toHaveTextContent('0')
        })

        const includeFutureWeeksToggle = screen.getByLabelText('athletes.reportingIncludeFutureWeeks')
        fireEvent.click(includeFutureWeeksToggle)

        await waitFor(() => {
            expect(screen.getByTestId('sbd-kpi-frq-squat')).toHaveTextContent('2')
            expect(screen.getByTestId('sbd-kpi-nbl-squat')).toHaveTextContent('22')
            expect(screen.getByTestId('sbd-kpi-frq-bench')).toHaveTextContent('2')
            expect(screen.getByTestId('sbd-kpi-nbl-bench')).toHaveTextContent('20')
            expect(screen.getByTestId('sbd-kpi-frq-deadlift')).toHaveTextContent('1')
            expect(screen.getByTestId('sbd-kpi-nbl-deadlift')).toHaveTextContent('12')
        })
    })

    it('sums frequency across points (workout count per week, not point count)', async () => {
        const now = new Date()
        const isoDaysAgo = (days: number) => new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString()

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
                                    fundamentalSets: { squat: 3, bench: 0, deadlift: 0 },
                                    fundamentalLifts: { squat: 15, bench: 0, deadlift: 0 },
                                    fundamentalMetrics: {
                                        squat: { frequency: 3, totalLifts: 15, averageIntensity: 80 },
                                        bench: null,
                                        deadlift: null,
                                    },
                                },
                                {
                                    date: isoDaysAgo(70),
                                    fundamentalSets: { squat: 2, bench: 0, deadlift: 0 },
                                    fundamentalLifts: { squat: 10, bench: 0, deadlift: 0 },
                                    fundamentalMetrics: {
                                        squat: { frequency: 2, totalLifts: 10, averageIntensity: 70 },
                                        bench: null,
                                        deadlift: null,
                                    },
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
                return { ok: true, json: async () => ({ data: { items: [] } }) } as Response
            }

            if (url.includes('/api/personal-records?traineeId=')) {
                return { ok: true, json: async () => ({ data: { items: [] } }) } as Response
            }

            throw new Error(`Unexpected fetch: ${url}`)
        }) as unknown as typeof fetch

        render(<TraineeDetailContent />)

        expect(await screen.findByText('Mario Rossi')).toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: 'athletes.reportsTab' }))

        await waitFor(() => {
            expect(screen.getByTestId('sbd-kpi-card-squat')).toBeInTheDocument()
        })

        // FRQ = 3 + 2 = 5 (workouts per week summed), NON 2 (numero di punti)
        expect(screen.getByTestId('sbd-kpi-frq-squat')).toHaveTextContent('5')
        expect(screen.getByTestId('sbd-kpi-nbl-squat')).toHaveTextContent('25')
        // IM = (80*15 + 70*10) / 25 = 76%
        expect(screen.getByTestId('sbd-kpi-im-squat')).toHaveTextContent('76.0%')
    })
})
