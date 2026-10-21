import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'

import ExerciseCreateModal from '@/components/ExerciseCreateModal'

const fetchMock = vi.fn()

const jsonResponse = (data: unknown, ok = true) => ({ ok, json: async () => data })

const postBody = () => {
    const call = fetchMock.mock.calls.find(([url, init]) => url === '/api/exercises' && init?.method === 'POST')
    expect(call).toBeDefined()
    return JSON.parse(call![1].body as string)
}

const submit = async () => {
    fireEvent.change(document.getElementById('name')!, { target: { value: 'Trazioni' } })
    fireEvent.change(document.getElementById('youtubeUrl')!, {
        target: { value: 'https://youtube.com/watch?v=1' },
    })
    await waitFor(() => expect(screen.getAllByRole('option', { name: 'Pull' }).length).toBeGreaterThan(0))
    fireEvent.change(document.getElementById('movementPattern')!, { target: { value: 'mp1' } })
    fireEvent.click(screen.getByRole('button', { name: 'exercises.createExercise' }))
    await waitFor(() => expect(fetchMock.mock.calls.some(([, i]) => i?.method === 'POST')).toBe(true))
}

describe('ExerciseCreateModal - bodyweight loaded checkbox', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
            if (url === '/api/muscle-groups') return jsonResponse({ data: { items: [] } })
            if (url === '/api/movement-patterns') return jsonResponse({ data: { items: [{ id: 'mp1', name: 'Pull' }] } })
            if (init?.method === 'POST') return jsonResponse({ data: {} })
            return jsonResponse({})
        })
        vi.stubGlobal('fetch', fetchMock)
    })

    it('shows the checkbox unchecked by default', () => {
        render(<ExerciseCreateModal onClose={vi.fn()} onExerciseCreated={vi.fn()} />)
        const checkbox = screen.getByLabelText('exercises.bodyweightLoadedLabel') as HTMLInputElement
        expect(checkbox.checked).toBe(false)
    })

    it('sends isBodyweightLoaded true when checked', async () => {
        render(<ExerciseCreateModal onClose={vi.fn()} onExerciseCreated={vi.fn()} />)
        fireEvent.click(screen.getByLabelText('exercises.bodyweightLoadedLabel'))
        await submit()
        expect(postBody().isBodyweightLoaded).toBe(true)
    })

    it('sends isBodyweightLoaded false when unchecked', async () => {
        render(<ExerciseCreateModal onClose={vi.fn()} onExerciseCreated={vi.fn()} />)
        await submit()
        expect(postBody().isBodyweightLoaded).toBe(false)
    })
})
