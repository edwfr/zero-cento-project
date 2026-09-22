import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'

import MeasurementFormModal from '@/components/MeasurementFormModal'

const onCreate = vi.fn()
const onEdit = vi.fn()
const onClose = vi.fn()

const renderCreate = () =>
    render(
        <MeasurementFormModal
            mode="create"
            isSaving={false}
            onClose={onClose}
            onCreate={onCreate}
            onEdit={onEdit}
        />
    )

describe('MeasurementFormModal — create', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('renders one input per metric', () => {
        renderCreate()

        for (const metric of ['weight', 'height', 'chest', 'arm', 'waist', 'hips', 'thigh', 'calf']) {
            expect(screen.getByLabelText(`measurements.metric.${metric}`)).toBeInTheDocument()
        }
    })

    it('disables submit while every metric field is empty', () => {
        renderCreate()

        expect(screen.getByRole('button', { name: 'common:common.save' })).toBeDisabled()
    })

    it('submits only the filled metrics', () => {
        renderCreate()

        fireEvent.change(screen.getByLabelText('measurements.metric.weight'), { target: { value: '78.5' } })
        fireEvent.change(screen.getByLabelText('measurements.metric.arm'), { target: { value: '38.5' } })
        fireEvent.click(screen.getByRole('button', { name: 'common:common.save' }))

        expect(onCreate).toHaveBeenCalledWith(
            expect.objectContaining({ values: { weight: 78.5, arm: 38.5 } })
        )
    })

    it('shows an inline error for an out-of-range value and does not submit', () => {
        renderCreate()

        fireEvent.change(screen.getByLabelText('measurements.metric.weight'), { target: { value: '5' } })
        fireEvent.click(screen.getByRole('button', { name: 'common:common.save' }))

        expect(screen.getByText('validation.measurementOutOfRange')).toBeInTheDocument()
        expect(onCreate).not.toHaveBeenCalled()
    })

    it('closes on cancel', () => {
        renderCreate()

        fireEvent.click(screen.getByRole('button', { name: 'common:common.cancel' }))

        expect(onClose).toHaveBeenCalled()
    })
})

describe('MeasurementFormModal — edit', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('edits one metric only, prefilled', () => {
        render(
            <MeasurementFormModal
                mode="edit"
                initial={{ id: 'm-1', metric: 'waist', value: 84, measuredAt: '2026-09-20', notes: 'post cena' }}
                isSaving={false}
                onClose={onClose}
                onCreate={onCreate}
                onEdit={onEdit}
            />
        )

        const input = screen.getByLabelText('measurements.metric.waist') as HTMLInputElement
        expect(input.value).toBe('84')
        expect(screen.queryByLabelText('measurements.metric.weight')).not.toBeInTheDocument()

        fireEvent.change(input, { target: { value: '83' } })
        fireEvent.click(screen.getByRole('button', { name: 'common:common.save' }))

        expect(onEdit).toHaveBeenCalledWith({
            id: 'm-1',
            value: 83,
            measuredAt: '2026-09-20',
            notes: 'post cena',
        })
    })
})
