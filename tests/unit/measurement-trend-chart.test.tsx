import { describe, it, expect, vi } from 'vitest'
import type { ReactNode } from 'react'
import { render, screen } from '@testing-library/react'

vi.mock('recharts', () => {
    const Wrapper = ({ children }: { children?: ReactNode }) => <div>{children}</div>
    return {
        ResponsiveContainer: ({ children }: { children?: ReactNode }) => (
            <div data-testid="chart-container">{children}</div>
        ),
        LineChart: ({ children, data }: { children?: ReactNode; data?: unknown[] }) => (
            <div data-testid="chart" data-points={data?.length ?? 0}>
                {children}
            </div>
        ),
        Line: ({ dataKey, yAxisId }: { dataKey: string; yAxisId: string }) => (
            <div data-testid={`line-${dataKey}`} data-axis={yAxisId} />
        ),
        YAxis: ({ yAxisId, orientation }: { yAxisId: string; orientation?: string }) => (
            <div data-testid={`yaxis-${yAxisId}`} data-orientation={orientation ?? 'left'} />
        ),
        XAxis: () => null,
        CartesianGrid: () => null,
        Legend: () => null,
        Tooltip: () => null,
        Wrapper,
    }
})

import MeasurementTrendChart from '@/components/MeasurementTrendChart'
import type { MeasurementPoint } from '@/lib/measurements'

const rows: MeasurementPoint[] = [
    { id: 'a', metric: 'weight', value: 80, measuredAt: '2026-09-01', notes: null },
    { id: 'b', metric: 'weight', value: 78.5, measuredAt: '2026-09-20', notes: null },
    { id: 'c', metric: 'waist', value: 84, measuredAt: '2026-09-20', notes: null },
]

describe('MeasurementTrendChart', () => {
    it('renders one line per selected metric', () => {
        render(
            <MeasurementTrendChart rows={rows} selectedMetrics={['weight', 'waist']} emptyLabel="empty" />
        )

        expect(screen.getByTestId('line-weight')).toBeInTheDocument()
        expect(screen.getByTestId('line-waist')).toBeInTheDocument()
        expect(screen.getByTestId('chart')).toHaveAttribute('data-points', '2')
    })

    it('puts weight on the right kg axis and circumferences on the left cm axis', () => {
        render(
            <MeasurementTrendChart rows={rows} selectedMetrics={['weight', 'waist']} emptyLabel="empty" />
        )

        expect(screen.getByTestId('line-weight')).toHaveAttribute('data-axis', 'kg')
        expect(screen.getByTestId('line-waist')).toHaveAttribute('data-axis', 'cm')
        expect(screen.getByTestId('yaxis-kg')).toHaveAttribute('data-orientation', 'right')
        expect(screen.getByTestId('yaxis-cm')).toHaveAttribute('data-orientation', 'left')
    })

    it('renders the empty label instead of the chart when nothing is selected', () => {
        render(<MeasurementTrendChart rows={rows} selectedMetrics={[]} emptyLabel="Nessun dato" />)

        expect(screen.getByText('Nessun dato')).toBeInTheDocument()
        expect(screen.queryByTestId('chart')).not.toBeInTheDocument()
    })

    it('renders the empty label when the selected metrics have no data', () => {
        render(<MeasurementTrendChart rows={rows} selectedMetrics={['calf']} emptyLabel="Nessun dato" />)

        expect(screen.getByText('Nessun dato')).toBeInTheDocument()
    })
})
