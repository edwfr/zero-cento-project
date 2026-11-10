import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'

import ExerciseQuickCreateModal from '@/components/ExerciseQuickCreateModal'

const fetchMock = vi.fn()

const jsonResponse = (data: unknown, ok = true, status = ok ? 200 : 400) => ({
    ok,
    status,
    json: async () => data,
})

const renderModal = () => {
    const onClose = vi.fn()
    const onCreated = vi.fn()
    render(<ExerciseQuickCreateModal onClose={onClose} onCreated={onCreated} />)
    return { onClose, onCreated }
}

describe('ExerciseQuickCreateModal', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
            if (url === '/api/muscle-groups') return jsonResponse({ data: { items: [] } })
            if (url === '/api/movement-patterns') return jsonResponse({ data: { items: [{ id: 'mp1', name: 'Pull' }] } })
            if (url === '/api/exercises' && init?.method === 'POST')
                return jsonResponse({ data: { exercise: { id: 'ex1', name: 'Trazioni' } } }, true, 201)
            return jsonResponse({})
        })
        vi.stubGlobal('fetch', fetchMock)
    })

    it('renders an accessible modal dialog labelled by the title', async () => {
        renderModal()
        const dialog = screen.getByRole('dialog', { name: 'exercises.newExerciseTitle' })
        expect(dialog).toHaveAttribute('aria-modal', 'true')
        await waitFor(() => expect(screen.getByRole('option', { name: 'Pull' })).toBeInTheDocument())
    })

    it('calls onCreated with the created exercise after a successful submit', async () => {
        const { onCreated } = renderModal()
        await waitFor(() => expect(screen.getByRole('option', { name: 'Pull' })).toBeInTheDocument())
        fireEvent.change(screen.getByPlaceholderText('exercises.exerciseNamePlaceholder'), {
            target: { value: 'Trazioni' },
        })
        fireEvent.click(screen.getByRole('button', { name: 'exercises.createExercise' }))
        await waitFor(() => expect(onCreated).toHaveBeenCalledWith({ id: 'ex1', name: 'Trazioni' }))
        expect(onCreated).toHaveBeenCalledTimes(1)
    })

    it('calls onClose when the form Cancel is clicked', () => {
        const { onClose } = renderModal()
        fireEvent.click(screen.getByRole('button', { name: 'exercises.cancel' }))
        expect(onClose).toHaveBeenCalledTimes(1)
    })

    it('calls onClose when the close icon is clicked', () => {
        const { onClose } = renderModal()
        fireEvent.click(screen.getByRole('button', { name: 'common:common.close' }))
        expect(onClose).toHaveBeenCalledTimes(1)
    })

    it('calls onClose on Escape', () => {
        const { onClose } = renderModal()
        fireEvent.keyDown(document, { key: 'Escape' })
        expect(onClose).toHaveBeenCalledTimes(1)
    })

    it('does not close on backdrop click', () => {
        const { onClose } = renderModal()
        fireEvent.click(screen.getByTestId('exercise-quick-create-backdrop'))
        expect(onClose).not.toHaveBeenCalled()
    })

    it('ignores Escape and disables the close icon while the POST is in flight', async () => {
        let resolvePost: (value: ReturnType<typeof jsonResponse>) => void = () => {}
        fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
            if (url === '/api/muscle-groups') return jsonResponse({ data: { items: [] } })
            if (url === '/api/movement-patterns') return jsonResponse({ data: { items: [{ id: 'mp1', name: 'Pull' }] } })
            if (url === '/api/exercises' && init?.method === 'POST')
                return new Promise((resolve) => { resolvePost = resolve })
            return jsonResponse({})
        })
        const { onClose, onCreated } = renderModal()
        await waitFor(() => expect(screen.getByRole('option', { name: 'Pull' })).toBeInTheDocument())
        fireEvent.change(screen.getByPlaceholderText('exercises.exerciseNamePlaceholder'), {
            target: { value: 'Trazioni' },
        })
        fireEvent.click(screen.getByRole('button', { name: 'exercises.createExercise' }))

        const closeIcon = screen.getByRole('button', { name: 'common:common.close' })
        await waitFor(() => expect(closeIcon).toBeDisabled())
        fireEvent.keyDown(document, { key: 'Escape' })
        expect(onClose).not.toHaveBeenCalled()

        resolvePost(jsonResponse({ data: { exercise: { id: 'ex1', name: 'Trazioni' } } }, true, 201))
        await waitFor(() => expect(onCreated).toHaveBeenCalledTimes(1))
    })
})
