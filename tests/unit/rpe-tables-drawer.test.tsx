import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import RpeTablesDrawer from '@/components/RpeTablesDrawer'

describe('RpeTablesDrawer', () => {
    it('shows the title and both tables open', () => {
        render(<RpeTablesDrawer isOpen onClose={vi.fn()} />)
        expect(screen.getByText('editProgram.rpeTablesPanelTitle')).toBeInTheDocument()
        expect(screen.getAllByRole('table')).toHaveLength(2)
    })

    it('calls onClose on Escape', () => {
        const onClose = vi.fn()
        render(<RpeTablesDrawer isOpen onClose={onClose} />)
        fireEvent.keyDown(window, { key: 'Escape' })
        expect(onClose).toHaveBeenCalledTimes(1)
    })

    it('calls onClose from the close button and the overlay', () => {
        const onClose = vi.fn()
        render(<RpeTablesDrawer isOpen onClose={onClose} />)
        fireEvent.click(screen.getByRole('button', { name: 'editProgram.rpeTablesPanelClose' }))
        fireEvent.click(screen.getByTestId('rpe-tables-overlay'))
        expect(onClose).toHaveBeenCalledTimes(2)
    })

    it('does not render the tables when closed', () => {
        render(<RpeTablesDrawer isOpen={false} onClose={vi.fn()} />)
        expect(screen.queryByRole('table')).not.toBeInTheDocument()
    })
})
