import type React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import SubscriptionRenewalFormModal from '@/components/SubscriptionRenewalFormModal'
import { formatDate } from '@/lib/date-format'

const onSubmit = vi.fn()
const onClose = vi.fn()

const renderCreate = (
    defaultStartDate = '2027-01-31',
    extra: Partial<React.ComponentProps<typeof SubscriptionRenewalFormModal>> = {}
) =>
    render(
        <SubscriptionRenewalFormModal
            mode="create"
            defaultStartDate={defaultStartDate}
            defaultKind="period"
            programBalance={0}
            todayForInput="2026-10-10"
            isSaving={false}
            onClose={onClose}
            onSubmit={onSubmit}
            {...extra}
        />
    )

const pickPrograms = () => fireEvent.click(screen.getByRole('button', { name: 'subscriptions.kind.programs' }))
const countInput = () => screen.getByLabelText(/subscriptions\.programCount/)

const save = () => fireEvent.click(screen.getByRole('button', { name: 'common:common.save' }))

describe('SubscriptionRenewalFormModal', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('pre-fills the start date with the proposed default', () => {
        renderCreate('2026-11-01')

        // Italian day/month/year, not the browser-locale native date input
        expect(screen.getByLabelText(/subscriptions\.startDate/)).toHaveValue('01/11/2026')
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

        expect(onSubmit).toHaveBeenCalledWith({ kind: 'period', startDate: '2026-11-01', durationMonths: 3 })
    })

    it('accepts a start date typed as dd/MM/yyyy', () => {
        renderCreate('2026-11-01')

        fireEvent.change(screen.getByLabelText(/subscriptions\.startDate/), { target: { value: '15/12/2026' } })
        fireEvent.change(screen.getByLabelText(/subscriptions\.duration/), { target: { value: '1' } })
        save()

        expect(onSubmit).toHaveBeenCalledWith({ kind: 'period', startDate: '2026-12-15', durationMonths: 1 })
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
                    kind: 'period',
                    startDate: '2026-09-10T00:00:00.000Z',
                    durationMonths: 6,
                    endDate: '2027-03-10T00:00:00.000Z',
                    programCount: null,
                    createdAt: '2026-09-10T10:00:00.000Z',
                }}
                defaultStartDate="2026-10-03"
                defaultKind="period"
                programBalance={0}
                todayForInput="2026-10-10"
                isSaving={false}
                onClose={onClose}
                onSubmit={onSubmit}
            />
        )

        expect(screen.getByText('subscriptions.editTitle')).toBeInTheDocument()
        expect(screen.getByLabelText(/subscriptions\.startDate/)).toHaveValue('10/09/2026')
        expect(screen.getByLabelText(/subscriptions\.duration/)).toHaveValue(6)
    })

    it('closes on cancel', () => {
        renderCreate()

        fireEvent.click(screen.getByRole('button', { name: 'common:common.cancel' }))

        expect(onClose).toHaveBeenCalled()
    })

    it('opens on the months form by default', () => {
        renderCreate()

        expect(screen.getByLabelText(/subscriptions\.duration/)).toBeInTheDocument()
        expect(screen.queryByLabelText(/subscriptions\.programCount/)).not.toBeInTheDocument()
    })

    it('opens on the programs form when that is the current mode, dated today', () => {
        renderCreate('2027-01-31', { defaultKind: 'programs' })

        expect(countInput()).toBeInTheDocument()
        // A package is bought today, not the day after the current expiry
        expect(screen.getByLabelText(/subscriptions\.purchaseDate/)).toHaveValue('10/10/2026')
    })

    it('submits a package with the purchase date and the count', () => {
        renderCreate()
        pickPrograms()
        fireEvent.change(countInput(), { target: { value: '5' } })
        save()

        expect(onSubmit).toHaveBeenCalledWith({ kind: 'programs', startDate: '2026-10-10', programCount: 5 })
    })

    it('fills the count from a shortcut', () => {
        renderCreate()
        pickPrograms()

        const shortcuts = screen.getAllByRole('button', { name: 'subscriptions.programCountShortcut' })
        expect(shortcuts).toHaveLength(4)
        fireEvent.click(shortcuts[2]) // 5 programs

        expect(countInput()).toHaveValue(5)
    })

    it('previews the balance after the registration, starting from the current balance', () => {
        renderCreate('2027-01-31', { programBalance: -1 })
        pickPrograms()
        fireEvent.change(countInput(), { target: { value: '5' } })

        expect(screen.getByTestId('renewal-balance-preview')).toHaveTextContent('4')
    })

    it.each(['0', '51', '2.5'])('rejects a count of %s without submitting', (value) => {
        renderCreate()
        pickPrograms()
        fireEvent.change(countInput(), { target: { value } })
        save()

        expect(onSubmit).not.toHaveBeenCalled()
        expect(screen.getByText('validation.programCountRange')).toBeInTheDocument()
    })

    it('keeps save disabled while the count is empty', () => {
        renderCreate()
        pickPrograms()

        expect(screen.getByRole('button', { name: 'common:common.save' })).toBeDisabled()
    })

    it('locks the kind when editing a package and previews the corrected balance', () => {
        render(
            <SubscriptionRenewalFormModal
                mode="edit"
                initial={{
                    id: 'p-1',
                    traineeId: 't-1',
                    kind: 'programs',
                    startDate: '2026-10-01T00:00:00.000Z',
                    durationMonths: null,
                    endDate: null,
                    programCount: 5,
                    createdAt: '2026-10-01T10:00:00.000Z',
                }}
                defaultStartDate="2026-10-10"
                defaultKind="period"
                programBalance={1}
                todayForInput="2026-10-10"
                isSaving={false}
                onClose={onClose}
                onSubmit={onSubmit}
            />
        )

        expect(screen.getByRole('button', { name: 'subscriptions.kind.period' })).toBeDisabled()
        expect(countInput()).toHaveValue(5)

        fireEvent.change(countInput(), { target: { value: '2' } })
        // balance 1 already includes this package's 5: 1 - 5 + 2
        expect(screen.getByTestId('renewal-balance-preview')).toHaveTextContent('-2')
    })
})
