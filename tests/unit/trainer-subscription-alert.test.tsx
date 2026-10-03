import { describe, it, expect, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import SubscriptionAlertBanner from '@/app/trainer/trainees/[id]/_subscription-alert'

const END = '2026-10-10T00:00:00.000Z'

describe('SubscriptionAlertBanner', () => {
    it('warns when the subscription is expiring and links to the tab', () => {
        const onManage = vi.fn()
        render(<SubscriptionAlertBanner summary={{ status: 'expiring', endDate: END, daysLeft: 7 }} onManage={onManage} />)

        expect(screen.getByRole('alert')).toHaveTextContent('subscriptions.banner.expiring')
        fireEvent.click(screen.getByRole('button', { name: 'subscriptions.banner.manage' }))
        expect(onManage).toHaveBeenCalled()
    })

    it('warns when the subscription has expired', () => {
        render(<SubscriptionAlertBanner summary={{ status: 'expired', endDate: END, daysLeft: -1 }} onManage={vi.fn()} />)

        expect(screen.getByRole('alert')).toHaveTextContent('subscriptions.banner.expired')
    })

    it('renders nothing for an active or missing subscription', () => {
        const { container: active } = render(
            <SubscriptionAlertBanner summary={{ status: 'active', endDate: END, daysLeft: 40 }} onManage={vi.fn()} />
        )
        const { container: none } = render(<SubscriptionAlertBanner summary={null} onManage={vi.fn()} />)

        expect(active).toBeEmptyDOMElement()
        expect(none).toBeEmptyDOMElement()
    })
})
