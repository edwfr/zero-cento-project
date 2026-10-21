import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'

vi.mock('next/navigation', () => ({
    useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
    useParams: () => ({ id: 'ex-1' }),
}))

import ExerciseEditContent from '@/app/trainer/exercises/[id]/edit/_content'

const fetchMock = vi.fn()
const jsonResponse = (data: unknown, ok = true) => ({ ok, json: async () => data })

const exercise = (isBodyweightLoaded: boolean) => ({
    id: 'ex-1',
    name: 'Trazioni',
    youtubeUrl: null,
    type: 'fundamental',
    isBodyweightLoaded,
    movementPatternId: 'mp1',
    notes: [],
    exerciseMuscleGroups: [],
})

const setup = (isBodyweightLoaded: boolean) => {
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
        if (url === '/api/exercises/ex-1' && !init?.method) {
            return jsonResponse({ data: { exercise: exercise(isBodyweightLoaded) } })
        }
        if (url === '/api/muscle-groups') return jsonResponse({ data: { items: [] } })
        if (url === '/api/movement-patterns') {
            return jsonResponse({ data: { items: [{ id: 'mp1', name: 'Pull' }] } })
        }
        if (init?.method === 'PUT') return jsonResponse({ data: {} })
        return jsonResponse({})
    })
    vi.stubGlobal('fetch', fetchMock)
}

const putBody = () => {
    const call = fetchMock.mock.calls.find(([, init]) => init?.method === 'PUT')
    expect(call).toBeDefined()
    return JSON.parse(call![1].body as string)
}

describe('Exercise edit page - bodyweight loaded checkbox', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('loads a saved true flag into the checkbox and sends true in PUT', async () => {
        setup(true)
        render(<ExerciseEditContent />)
        const checkbox = (await screen.findByLabelText(
            'exercises.bodyweightLoadedLabel'
        )) as HTMLInputElement
        expect(checkbox.checked).toBe(true)

        fireEvent.click(screen.getByRole('button', { name: 'exercises.saveChanges' }))
        await waitFor(() => expect(fetchMock.mock.calls.some(([, i]) => i?.method === 'PUT')).toBe(true))
        expect(putBody().isBodyweightLoaded).toBe(true)
    })

    it('sends false when the saved flag is false', async () => {
        setup(false)
        render(<ExerciseEditContent />)
        const checkbox = (await screen.findByLabelText(
            'exercises.bodyweightLoadedLabel'
        )) as HTMLInputElement
        expect(checkbox.checked).toBe(false)

        fireEvent.click(screen.getByRole('button', { name: 'exercises.saveChanges' }))
        await waitFor(() => expect(fetchMock.mock.calls.some(([, i]) => i?.method === 'PUT')).toBe(true))
        expect(putBody().isBodyweightLoaded).toBe(false)
    })
})
