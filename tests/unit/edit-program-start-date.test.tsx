import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const showToast = vi.fn()
vi.mock('@/components/ToastNotification', () => ({
    useToast: () => ({ showToast }),
}))

import EditProgramStartDate from '@/app/trainer/programs/[id]/edit/EditProgramStartDate'

// Local "today": 2026-10-04
const renderComponent = (overrides: Partial<Parameters<typeof EditProgramStartDate>[0]> = {}) => {
    const onUpdate = vi.fn()
    render(
        <EditProgramStartDate
            programId="prog-1"
            status="active"
            startDate="2026-10-12T00:00:00.000Z"
            onUpdate={onUpdate}
            {...overrides}
        />
    )
    return { onUpdate }
}

describe('EditProgramStartDate', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        vi.useFakeTimers({ toFake: ['Date'] })
        vi.setSystemTime(new Date('2026-10-04T10:00:00'))
    })

    afterEach(() => {
        vi.useRealTimers()
        vi.unstubAllGlobals()
    })

    it('shows the button for a published program that has not started yet', () => {
        renderComponent()
        expect(screen.getByRole('button', { name: 'programMetadata.editStartDate' })).toBeInTheDocument()
    })

    it('renders nothing for a draft program', () => {
        const { container } = render(
            <EditProgramStartDate programId="prog-1" status="draft" startDate={null} onUpdate={vi.fn()} />
        )
        expect(container).toBeEmptyDOMElement()
    })

    it('renders nothing once the program has started', () => {
        const { container } = render(
            <EditProgramStartDate
                programId="prog-1"
                status="active"
                startDate="2026-10-04T00:00:00.000Z"
                onUpdate={vi.fn()}
            />
        )
        expect(container).toBeEmptyDOMElement()
    })

    it('opens the dialog with the current date in dd/MM/yyyy', () => {
        renderComponent()
        fireEvent.click(screen.getByRole('button', { name: 'programMetadata.editStartDate' }))

        expect(screen.getByRole('dialog')).toBeInTheDocument()
        expect(screen.getByLabelText(/programMetadata\.newStartDateLabel/)).toHaveValue('12/10/2026')
    })

    it('saves the new date and notifies the parent', async () => {
        const fetchMock = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ data: { startDate: '2026-10-19T00:00:00.000Z' } }),
        })
        vi.stubGlobal('fetch', fetchMock)
        const { onUpdate } = renderComponent()

        fireEvent.click(screen.getByRole('button', { name: 'programMetadata.editStartDate' }))
        fireEvent.change(screen.getByLabelText(/programMetadata\.newStartDateLabel/), {
            target: { value: '19/10/2026' },
        })
        fireEvent.click(screen.getByRole('button', { name: 'common:common.save' }))

        await waitFor(() => expect(onUpdate).toHaveBeenCalled())
        expect(fetchMock).toHaveBeenCalledWith('/api/programs/prog-1/start-date', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ startDate: '2026-10-19' }),
        })
        expect(showToast).toHaveBeenCalledWith('programMetadata.startDateUpdateSuccess', 'success')
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })

    it('rejects a past date without calling the API', () => {
        const fetchMock = vi.fn()
        vi.stubGlobal('fetch', fetchMock)
        renderComponent()

        fireEvent.click(screen.getByRole('button', { name: 'programMetadata.editStartDate' }))
        fireEvent.change(screen.getByLabelText(/programMetadata\.newStartDateLabel/), {
            target: { value: '01/10/2026' },
        })
        fireEvent.click(screen.getByRole('button', { name: 'common:common.save' }))

        expect(fetchMock).not.toHaveBeenCalled()
        expect(showToast).toHaveBeenCalledWith('publish.pastDateError', 'error')
    })

    it('shows the API error and keeps the dialog open', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn().mockResolvedValue({
                ok: false,
                json: async () => ({ error: { code: 'VALIDATION_ERROR', message: 'Nope' } }),
            })
        )
        const { onUpdate } = renderComponent()

        fireEvent.click(screen.getByRole('button', { name: 'programMetadata.editStartDate' }))
        fireEvent.click(screen.getByRole('button', { name: 'common:common.save' }))

        await waitFor(() => expect(showToast).toHaveBeenCalledWith(expect.any(String), 'error'))
        expect(onUpdate).not.toHaveBeenCalled()
        expect(screen.getByRole('dialog')).toBeInTheDocument()
    })
})
