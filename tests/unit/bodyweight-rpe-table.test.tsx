import { render, screen, fireEvent, within } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import BodyweightRPETable from '@/components/BodyweightRPETable'

describe('BodyweightRPETable', () => {
    it('renders 9 RPE rows by 10 rep columns with the expected percentages', () => {
        render(<BodyweightRPETable defaultOpen />)
        const table = screen.getByRole('table')
        const body = table.querySelector('tbody') as HTMLElement
        const rows = within(body).getAllByRole('row')
        expect(rows).toHaveLength(9)
        rows.forEach((row) => expect(within(row).getAllByRole('cell')).toHaveLength(10))

        const cellAt = (rpe: string, reps: number) => {
            const row = rows.find((r) => within(r).getByRole('rowheader').textContent === rpe) as HTMLElement
            return within(row).getAllByRole('cell')[reps - 1].textContent
        }
        expect(cellAt('8', 5)).toBe('81%')
        expect(cellAt('8.5', 5)).toBe('82%')
        expect(cellAt('6.5', 9)).toBe('70.5%')
    })

    it('renders the three notes', () => {
        render(<BodyweightRPETable defaultOpen />)
        expect(screen.getByText('common.bodyweightRpeTable.noteExample')).toBeInTheDocument()
        expect(screen.getByText('common.bodyweightRpeTable.noteBallast')).toBeInTheDocument()
        expect(screen.getByText('common.bodyweightRpeTable.noteDisclaimer')).toBeInTheDocument()
    })

    it('is closed by default and opens on toggle', () => {
        render(<BodyweightRPETable />)
        expect(screen.queryByRole('table')).not.toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { expanded: false }))
        expect(screen.getByRole('table')).toBeInTheDocument()
    })
})
