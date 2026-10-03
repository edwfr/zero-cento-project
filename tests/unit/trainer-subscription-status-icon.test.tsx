import { describe, it, expect, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import SubscriptionStatusIcon from '@/app/trainer/trainees/[id]/_subscription-status-icon'
import type { SubscriptionSummary } from '@/lib/subscriptions'

const END = '2026-10-10T00:00:00.000Z'

function renderIcon(summary: SubscriptionSummary | null, loading = false, onOpen = vi.fn()) {
    render(<SubscriptionStatusIcon summary={summary} loading={loading} onOpen={onOpen} />)
    return onOpen
}

describe('SubscriptionStatusIcon', () => {
    it.each([
        ['active', 40, 'subscriptions.badge.active · subscriptions.remaining.daysLeft'],
        ['expiring', 7, 'subscriptions.badge.expiring · subscriptions.remaining.daysLeft'],
        ['expired', -2, 'subscriptions.badge.expired · subscriptions.remaining.daysOverdue'],
    ] as const)('describes the %s status in its tooltip and accessible name', (status, daysLeft, text) => {
        renderIcon({ status, endDate: END, daysLeft })

        const icon = screen.getByRole('button', { name: text })
        expect(icon).toHaveAttribute('title', text)
        expect(icon).toHaveAttribute('data-status', status)
    })

    it('shows a grey icon when no subscription was ever recorded', () => {
        renderIcon(null)

        const icon = screen.getByRole('button', { name: 'subscriptions.badge.none' })
        expect(icon).toHaveAttribute('data-status', 'none')
    })

    it('opens the subscription tab on click (touch screens have no hover)', () => {
        const onOpen = renderIcon({ status: 'active', endDate: END, daysLeft: 40 })

        fireEvent.click(screen.getByRole('button'))

        expect(onOpen).toHaveBeenCalled()
    })

    it('renders nothing while loading, rather than claiming there is no subscription', () => {
        renderIcon(null, true)

        expect(screen.queryByRole('button')).not.toBeInTheDocument()
    })
})
