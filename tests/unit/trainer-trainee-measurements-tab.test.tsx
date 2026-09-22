import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { ReactNode } from 'react'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'

vi.mock('recharts', () => {
    const Passthrough = ({ children }: { children?: ReactNode }) => <div>{children}</div>
    return {
        ResponsiveContainer: Passthrough,
        LineChart: Passthrough,
        Line: () => null,
        CartesianGrid: () => null,
        Legend: () => null,
        Tooltip: () => null,
        XAxis: () => null,
        YAxis: () => null,
    }
})

const showToast = vi.fn()
vi.mock('@/components/ToastNotification', () => ({
    useToast: () => ({ showToast }),
    ToastProvider: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
}))

import MeasurementsTab from '@/app/trainer/trainees/[id]/_measurements-tab'

const rows = [
    { id: 'm-1', metric: 'weight', value: 78.5, measuredAt: '2026-09-20', notes: null },
    { id: 'm-2', metric: 'weight', value: 80, measuredAt: '2026-09-01', notes: null },
    { id: 'm-3', metric: 'waist', value: 84, measuredAt: '2026-09-20', notes: 'mattina' },
]

function mockFetchOnce(items: unknown[]) {
    global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ data: { items } }),
    }) as never
}

describe('MeasurementsTab', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('loads the measurements of the trainee on mount', async () => {
        mockFetchOnce(rows)

        render(<MeasurementsTab traineeId="trainee-1" />)

        await waitFor(() => {
            expect(global.fetch).toHaveBeenCalledWith('/api/trainee-measurements?traineeId=trainee-1')
        })
    })

    it('shows the latest value and the delta per metric', async () => {
        mockFetchOnce(rows)

        render(<MeasurementsTab traineeId="trainee-1" />)

        const weightCard = await screen.findByRole('listitem', { name: 'measurements.metric.weight' })
        expect(within(weightCard).getByText('78.5 kg')).toBeInTheDocument()
        expect(within(weightCard).getByText('-1.5')).toBeInTheDocument()

        const waistCard = screen.getByRole('listitem', { name: 'measurements.metric.waist' })
        expect(within(waistCard).getByText('84 cm')).toBeInTheDocument()
        expect(within(waistCard).getByText('measurements.deltaNone')).toBeInTheDocument()
    })

    it('shows an empty state for metrics never measured', async () => {
        mockFetchOnce(rows)

        render(<MeasurementsTab traineeId="trainee-1" />)

        const calfCard = await screen.findByRole('listitem', { name: 'measurements.metric.calf' })
        expect(within(calfCard).getByText('measurements.emptyMetric')).toBeInTheDocument()
    })

    it('renders an error panel when the fetch fails', async () => {
        global.fetch = vi.fn().mockResolvedValue({
            ok: false,
            json: async () => ({ error: { code: 'INTERNAL_ERROR', message: 'boom', key: 'internal.default' } }),
        }) as never

        render(<MeasurementsTab traineeId="trainee-1" />)

        expect(await screen.findByText('measurements.loadError')).toBeInTheDocument()
    })

    it('posts only the filled metrics when the modal is submitted', async () => {
        mockFetchOnce(rows)

        render(<MeasurementsTab traineeId="trainee-1" />)
        await screen.findByRole('listitem', { name: 'measurements.metric.weight' })

        fireEvent.click(screen.getByRole('button', { name: 'measurements.addButton' }))
        const dialog = screen.getByRole('dialog', { name: 'measurements.createTitle' })
        fireEvent.change(within(dialog).getByLabelText('measurements.metric.arm'), { target: { value: '38.5' } })

        const postFetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: { items: [] } }) })
        global.fetch = postFetch as never

        fireEvent.click(screen.getByRole('button', { name: 'common:common.save' }))

        await waitFor(() => {
            expect(postFetch).toHaveBeenCalledWith(
                '/api/trainee-measurements',
                expect.objectContaining({ method: 'POST' })
            )
        })

        const payload = JSON.parse((postFetch.mock.calls[0][1] as RequestInit).body as string)
        expect(payload.values).toEqual({ arm: 38.5 })
        expect(payload.traineeId).toBe('trainee-1')
    })

    it('toggles a metric in the chart selection', async () => {
        mockFetchOnce(rows)

        render(<MeasurementsTab traineeId="trainee-1" />)
        await screen.findByRole('listitem', { name: 'measurements.metric.weight' })

        const waistToggle = screen.getByRole('checkbox', { name: 'measurements.metric.waist' })
        expect(waistToggle).toBeChecked()

        fireEvent.click(waistToggle)
        expect(waistToggle).not.toBeChecked()
    })
})
