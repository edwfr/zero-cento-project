import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import SubscriptionRenewalFormModal from '@/components/SubscriptionRenewalFormModal'
import { formatDate } from '@/lib/date-format'

const onSubmit = vi.fn()
const onClose = vi.fn()

const renderCreate = (defaultStartDate = '2027-01-31') =>
    render(
        <SubscriptionRenewalFormModal
            mode="create"
            defaultStartDate={defaultStartDate}
            isSaving={false}
            onClose={onClose}
            onSubmit={onSubmit}
        />
    )

const save = () => fireEvent.click(screen.getByRole('button', { name: 'common:common.save' }))

describe('SubscriptionRenewalFormModal', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('pre-fills the start date with the proposed default', () => {
        renderCreate('2026-11-01')

        expect(screen.getByLabelText(/subscriptions\.startDate/)).toHaveValue('2026-11-01')
    })

    it('disables save until a duration is entered', () => {
        renderCreate()

        expect(screen.getByRole('button', { name: 'common:common.save' })).toBeDisabled()
    })

    it('previews the month-end-clamped expiry as the duration changes', () => {
        renderCreate('2027-01-31')

        fireEvent.change(screen.getByLabelText(/subscriptions\.duration/), { target: { value: '1' } })

        expect(screen.getByTestId('renewal-end-preview')).toHaveTextContent(
            formatDate(new Date('2027-02-28T00:00:00.000Z'))
        )
    })

    it('fills the duration from a shortcut', () => {
        renderCreate()

        // The test t() mock returns the key, so all four shortcuts share one name
        const shortcuts = screen.getAllByRole('button', { name: 'subscriptions.durationShortcut' })
        expect(shortcuts).toHaveLength(4)
        fireEvent.click(shortcuts[3]) // 12 months

        expect(screen.getByLabelText(/subscriptions\.duration/)).toHaveValue(12)
        expect(shortcuts[3]).toHaveAttribute('aria-pressed', 'true')
    })

    it('submits start date and duration', () => {
        renderCreate('2026-11-01')

        fireEvent.change(screen.getByLabelText(/subscriptions\.duration/), { target: { value: '3' } })
        save()

        expect(onSubmit).toHaveBeenCalledWith({ startDate: '2026-11-01', durationMonths: 3 })
    })

    it.each(['0', '37', '1.5'])('shows an inline error for duration %s and does not submit', (value) => {
        renderCreate()

        fireEvent.change(screen.getByLabelText(/subscriptions\.duration/), { target: { value } })
        save()

        expect(screen.getByText('validation.durationMonthsRange')).toBeInTheDocument()
        expect(onSubmit).not.toHaveBeenCalled()
    })

    it('edits an existing renewal with its values pre-filled', () => {
        render(
            <SubscriptionRenewalFormModal
                mode="edit"
                initial={{
                    id: 'r-1',
                    traineeId: 't-1',
                    startDate: '2026-09-10T00:00:00.000Z',
                    durationMonths: 6,
                    endDate: '2027-03-10T00:00:00.000Z',
                    createdAt: '2026-09-10T10:00:00.000Z',
                }}
                defaultStartDate="2026-10-03"
                isSaving={false}
                onClose={onClose}
                onSubmit={onSubmit}
            />
        )

        expect(screen.getByText('subscriptions.editTitle')).toBeInTheDocument()
        expect(screen.getByLabelText(/subscriptions\.startDate/)).toHaveValue('2026-09-10')
        expect(screen.getByLabelText(/subscriptions\.duration/)).toHaveValue(6)
    })

    it('closes on cancel', () => {
        renderCreate()

        fireEvent.click(screen.getByRole('button', { name: 'common:common.cancel' }))

        expect(onClose).toHaveBeenCalled()
    })
})
