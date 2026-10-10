import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import SubscriptionStatusIcon from '@/components/SubscriptionStatusIcon'
import type { SubscriptionSummary } from '@/lib/subscriptions'

const END = '2026-10-10T00:00:00.000Z'

function renderIcon(summary: SubscriptionSummary | null, loading = false) {
    render(<SubscriptionStatusIcon summary={summary} loading={loading} />)
}

describe('SubscriptionStatusIcon', () => {
    it.each([
        ['active', 40, 'subscriptions.badge.active · subscriptions.remaining.daysLeft'],
        ['expiring', 7, 'subscriptions.badge.expiring · subscriptions.remaining.daysLeft'],
        ['expired', -2, 'subscriptions.badge.expired · subscriptions.remaining.daysOverdue'],
    ] as const)('describes the %s status in its tooltip and accessible name', (status, daysLeft, text) => {
        renderIcon({ kind: 'period', status, endDate: END, daysLeft })

        const icon = screen.getByRole('img', { name: text })
        expect(icon).toHaveAttribute('title', text)
        expect(icon).toHaveAttribute('data-status', status)
    })

    it('shows a grey icon when no subscription was ever recorded', () => {
        renderIcon(null)

        const icon = screen.getByRole('img', { name: 'subscriptions.badge.none' })
        expect(icon).toHaveAttribute('data-status', 'none')
    })

    it('is informative only, not a control', () => {
        renderIcon({ kind: 'period', status: 'active', endDate: END, daysLeft: 40 })

        expect(screen.queryByRole('button')).not.toBeInTheDocument()
    })

    it('renders nothing while loading, rather than claiming there is no subscription', () => {
        renderIcon(null, true)

        expect(screen.queryByRole('img')).not.toBeInTheDocument()
    })

    it('describes a program balance without a date', () => {
        render(<SubscriptionStatusIcon summary={{ kind: 'programs', status: 'expired', remaining: 0 }} />)

        expect(screen.getByRole('img')).toHaveAccessibleName('subscriptions.programs.exhausted')
        expect(screen.getByRole('img')).toHaveAttribute('data-status', 'expired')
    })
})
