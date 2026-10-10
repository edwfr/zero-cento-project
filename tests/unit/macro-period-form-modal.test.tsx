import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'

import MacroPeriodFormModal, { type MacroPeriodFormModalProps } from '@/components/MacroPeriodFormModal'
import type { MacroPhaseTypeDto } from '@/lib/macro-periods'

const phase = (overrides: Partial<MacroPhaseTypeDto>): MacroPhaseTypeDto => ({
    id: 'p1',
    name: 'Forza',
    description: null,
    color: '#2563eb',
    sortOrder: 0,
    isActive: true,
    usageCount: 0,
    ...overrides,
})

const PHASES = [
    phase({ id: 'p1', name: 'Forza' }),
    phase({ id: 'p2', name: 'Scarico', sortOrder: 1 }),
    phase({ id: 'p3', name: 'Vecchia', sortOrder: 2, isActive: false }),
]

const onSubmit = vi.fn()
const onClose = vi.fn()
const onDelete = vi.fn()

const renderModal = (props: Partial<MacroPeriodFormModalProps> = {}) =>
    render(
        <MacroPeriodFormModal
            mode="create"
            initial={{}}
            phaseTypes={PHASES}
            isSaving={false}
            error={null}
            onClose={onClose}
            onSubmit={onSubmit}
            {...props}
        />
    )

const save = () => screen.getByRole('button', { name: 'common:common.save' })

describe('MacroPeriodFormModal', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        vi.useFakeTimers()
        vi.setSystemTime(new Date('2026-10-07T10:00:00.000Z')) // a Wednesday
    })

    afterEach(() => {
        vi.useRealTimers()
    })

    it('defaults to four weeks from the current week and the first active phase', () => {
        renderModal()
        fireEvent.click(save())

        expect(onSubmit).toHaveBeenCalledWith({
            phaseTypeId: 'p1',
            startDate: '2026-10-05',
            endDate: '2026-11-01',
            note: null,
        })
    })

    it('opens prefilled with the drawn range', () => {
        renderModal({ initial: { startDate: '2026-11-02', endDate: '2026-11-22' } })

        expect(screen.getByLabelText(/planning\.startWeek/)).toHaveValue('2026-11-02')
        expect(screen.getByLabelText(/planning\.endWeek/)).toHaveValue('2026-11-22')
    })

    it('snaps a typed start to its Monday and a typed end to its Sunday on leaving the field', () => {
        renderModal({ initial: { startDate: '2026-11-02', endDate: '2026-11-22' } })

        fireEvent.change(screen.getByLabelText(/planning\.startWeek/), { target: { value: '2026-11-11' } })
        fireEvent.blur(screen.getByLabelText(/planning\.startWeek/))
        fireEvent.change(screen.getByLabelText(/planning\.endWeek/), { target: { value: '2026-11-25' } })
        fireEvent.blur(screen.getByLabelText(/planning\.endWeek/))

        expect(screen.getByLabelText(/planning\.startWeek/)).toHaveValue('2026-11-09')
        expect(screen.getByLabelText(/planning\.endWeek/)).toHaveValue('2026-11-29')
    })

    it('leaves a date alone while it is being typed', () => {
        renderModal({ initial: { startDate: '2026-11-02', endDate: '2026-11-22' } })

        // typing "12" in the day segment passes through the 1st, which belongs to the previous month's last week
        fireEvent.change(screen.getByLabelText(/planning\.startWeek/), { target: { value: '2026-11-01' } })

        expect(screen.getByLabelText(/planning\.startWeek/)).toHaveValue('2026-11-01')
    })

    it('submits whole weeks even when the field was never left', () => {
        renderModal({ initial: { startDate: '2026-11-02', endDate: '2026-11-22' } })

        fireEvent.change(screen.getByLabelText(/planning\.startWeek/), { target: { value: '2026-11-11' } })
        fireEvent.change(screen.getByLabelText(/planning\.endWeek/), { target: { value: '2026-11-25' } })
        fireEvent.click(save())

        expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ startDate: '2026-11-09', endDate: '2026-11-29' }))
    })

    it('submits the chosen phase and a trimmed note', () => {
        renderModal({ initial: { startDate: '2026-11-02', endDate: '2026-11-22' } })

        fireEvent.change(screen.getByLabelText(/planning\.phase/), { target: { value: 'p2' } })
        fireEvent.change(screen.getByLabelText('planning.note'), { target: { value: '  Blocco 1  ' } })
        fireEvent.click(save())

        expect(onSubmit).toHaveBeenCalledWith({
            phaseTypeId: 'p2',
            startDate: '2026-11-02',
            endDate: '2026-11-22',
            note: 'Blocco 1',
        })
    })

    it('blocks saving when the end is not after the start', () => {
        renderModal({ initial: { startDate: '2026-11-02', endDate: '2026-11-22' } })

        fireEvent.change(screen.getByLabelText(/planning\.endWeek/), { target: { value: '2026-10-20' } })

        expect(save()).toBeDisabled()
        expect(screen.getByText('planning.invalidRange')).toBeInTheDocument()
    })

    it('offers only active phases when creating', () => {
        renderModal()

        const options = screen.getAllByRole('option').map((option) => option.textContent)
        expect(options).toEqual(['Forza', 'Scarico'])
    })

    it('keeps the archived phase of the period being edited selectable', () => {
        renderModal({
            mode: 'edit',
            initial: { phaseTypeId: 'p3', startDate: '2026-11-02', endDate: '2026-11-22', note: 'x' },
            onDelete,
        })

        expect(screen.getByLabelText(/planning\.phase/)).toHaveValue('p3')
        expect(screen.getAllByRole('option')).toHaveLength(3)
    })

    it('has nothing to choose when every phase is archived: save disabled, link to the profile', () => {
        renderModal({ phaseTypes: [phase({ id: 'p3', isActive: false })] })

        expect(save()).toBeDisabled()
        expect(screen.getByText('planning.noActivePhases')).toBeInTheDocument()
        expect(screen.getByRole('link', { name: 'planning.managePhases' })).toHaveAttribute('href', '/profile')
        fireEvent.click(save())
        expect(onSubmit).not.toHaveBeenCalled()
    })

    it('shows delete only when editing', () => {
        renderModal()
        expect(screen.queryByRole('button', { name: 'planning.deletePeriod' })).not.toBeInTheDocument()
    })

    it('calls onDelete from the edit dialog', () => {
        renderModal({
            mode: 'edit',
            initial: { phaseTypeId: 'p1', startDate: '2026-11-02', endDate: '2026-11-22', note: null },
            onDelete,
        })

        fireEvent.click(screen.getByRole('button', { name: 'planning.deletePeriod' }))

        expect(onDelete).toHaveBeenCalledTimes(1)
    })

    it('shows the error passed by the parent', () => {
        renderModal({ error: 'errors:macroPeriod.overlap' })

        expect(screen.getByRole('alert')).toHaveTextContent('errors:macroPeriod.overlap')
    })

    it('closes on cancel', () => {
        renderModal()

        fireEvent.click(screen.getByRole('button', { name: 'common:common.cancel' }))

        expect(onClose).toHaveBeenCalledTimes(1)
    })
})
