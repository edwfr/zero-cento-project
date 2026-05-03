import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import FloatingRestTimer from '@/components/FloatingRestTimer'

describe('FloatingRestTimer', () => {
    it('renders nothing when secondsLeft is null', () => {
        const { container } = render(
            <FloatingRestTimer secondsLeft={null} totalSeconds={120} onStop={vi.fn()} />
        )

        expect(container.firstChild).toBeNull()
    })

    it('renders when secondsLeft is a positive number', () => {
        render(<FloatingRestTimer secondsLeft={75} totalSeconds={120} onStop={vi.fn()} />)
        expect(screen.getByText('1:15')).toBeInTheDocument()
    })

    it('formats single-digit seconds with a leading zero', () => {
        render(<FloatingRestTimer secondsLeft={65} totalSeconds={120} onStop={vi.fn()} />)
        expect(screen.getByText('1:05')).toBeInTheDocument()
    })

    it('formats sub-minute countdown', () => {
        render(<FloatingRestTimer secondsLeft={30} totalSeconds={60} onStop={vi.fn()} />)
        expect(screen.getByText('0:30')).toBeInTheDocument()
    })

    it('calls onStop when dismiss button is clicked', async () => {
        const user = userEvent.setup()
        const onStop = vi.fn()
        render(<FloatingRestTimer secondsLeft={60} totalSeconds={120} onStop={onStop} />)

        await user.click(screen.getByRole('button', { name: /stop timer/i }))

        expect(onStop).toHaveBeenCalledTimes(1)
    })

    it('renders done state (no dismiss button) when secondsLeft is 0', () => {
        const { container } = render(
            <FloatingRestTimer secondsLeft={0} totalSeconds={120} onStop={vi.fn()} />
        )

        expect(container.firstChild).not.toBeNull()
        expect(screen.queryByRole('button', { name: /stop timer/i })).not.toBeInTheDocument()
    })

    it('applies urgent red border when 5 or fewer seconds remain', () => {
        const { container } = render(
            <FloatingRestTimer secondsLeft={5} totalSeconds={120} onStop={vi.fn()} />
        )

        expect(container.querySelector('.border-red-300')).toBeInTheDocument()
    })

    it('applies warning amber border when 6-10 seconds remain', () => {
        const { container } = render(
            <FloatingRestTimer secondsLeft={8} totalSeconds={120} onStop={vi.fn()} />
        )

        expect(container.querySelector('.border-amber-300')).toBeInTheDocument()
    })

    it('applies default gray border when more than 10 seconds remain', () => {
        const { container } = render(
            <FloatingRestTimer secondsLeft={60} totalSeconds={120} onStop={vi.fn()} />
        )

        expect(container.querySelector('.border-gray-200')).toBeInTheDocument()
    })
})
