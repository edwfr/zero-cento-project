import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'

import ExerciseForm from '@/components/ExerciseForm'
import { DEFAULT_EXERCISE_TYPE } from '@/lib/exercise-type'

const fetchMock = vi.fn()

const jsonResponse = (data: unknown, ok = true, status = ok ? 200 : 400) => ({
    ok,
    status,
    json: async () => data,
})

const postCalls = () =>
    fetchMock.mock.calls.filter(([url, init]) => url === '/api/exercises' && init?.method === 'POST')

const postBody = () => {
    const calls = postCalls()
    expect(calls).toHaveLength(1)
    return JSON.parse(calls[0][1].body as string)
}

let postResponse: () => ReturnType<typeof jsonResponse>

const renderForm = () => {
    const onSuccess = vi.fn()
    const onCancel = vi.fn()
    render(<ExerciseForm onSuccess={onSuccess} onCancel={onCancel} />)
    return { onSuccess, onCancel }
}

const waitForPatterns = async () => {
    await waitFor(() => expect(screen.getByRole('option', { name: 'Pull' })).toBeInTheDocument())
}

const fillName = (value = 'Trazioni') => {
    fireEvent.change(screen.getByPlaceholderText('exercises.exerciseNamePlaceholder'), {
        target: { value },
    })
}

const submit = () => {
    fireEvent.click(screen.getByRole('button', { name: 'exercises.createExercise' }))
}

describe('ExerciseForm', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        postResponse = () => jsonResponse({ data: { exercise: { id: 'ex1', name: 'Trazioni' } } }, true, 201)
        fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
            if (url === '/api/muscle-groups') return jsonResponse({ data: { items: [{ id: 'mg1', name: 'Dorsali' }] } })
            if (url === '/api/movement-patterns')
                return jsonResponse({
                    data: {
                        items: [
                            { id: 'mp1', name: 'Pull' },
                            { id: 'mp2', name: 'Push' },
                        ],
                    },
                })
            if (url === '/api/exercises' && init?.method === 'POST') return postResponse()
            return jsonResponse({})
        })
        vi.stubGlobal('fetch', fetchMock)
    })

    it('defaults the movement pattern select to the first pattern', async () => {
        renderForm()
        await waitForPatterns()
        const select = screen.getByRole('combobox', { name: 'exercises.movementPattern' }) as HTMLSelectElement
        await waitFor(() => expect(select.value).toBe('mp1'))
    })

    it('shows nameRequired and does not POST when name is empty', async () => {
        renderForm()
        await waitForPatterns()
        fireEvent.submit(screen.getByRole('button', { name: 'exercises.createExercise' }).closest('form')!)
        expect(await screen.findByText('exercises.nameRequired')).toBeInTheDocument()
        expect(postCalls()).toHaveLength(0)
    })

    it('POSTs the page body: blank variants dropped, no youtubeUrl when empty', async () => {
        renderForm()
        await waitForPatterns()
        fillName()
        fireEvent.click(screen.getByRole('button', { name: 'exercises.addVariant' }))
        fireEvent.click(screen.getByRole('button', { name: 'exercises.addVariant' }))
        const variantInputs = screen.getAllByPlaceholderText('exercises.variantPlaceholder')
        fireEvent.change(variantInputs[0], { target: { value: 'A' } })
        fireEvent.change(variantInputs[1], { target: { value: '  ' } })
        submit()
        await waitFor(() => expect(postCalls()).toHaveLength(1))
        const body = postBody()
        expect(body).toEqual({
            name: 'Trazioni',
            type: DEFAULT_EXERCISE_TYPE,
            isBodyweightLoaded: false,
            movementPatternId: 'mp1',
            muscleGroups: [],
            notes: ['A'],
        })
        expect(body).not.toHaveProperty('youtubeUrl')
    })

    it('includes youtubeUrl when filled', async () => {
        renderForm()
        await waitForPatterns()
        fillName()
        fireEvent.change(screen.getByPlaceholderText('https://www.youtube.com/watch?v=...'), {
            target: { value: 'https://youtube.com/watch?v=1' },
        })
        submit()
        await waitFor(() => expect(postCalls()).toHaveLength(1))
        expect(postBody().youtubeUrl).toBe('https://youtube.com/watch?v=1')
    })

    it('calls onSuccess once with the created exercise', async () => {
        const { onSuccess } = renderForm()
        await waitForPatterns()
        fillName()
        submit()
        await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1))
        expect(onSuccess).toHaveBeenCalledWith({ id: 'ex1', name: 'Trazioni' })
    })

    it('shows the API error, skips onSuccess and re-enables submit on 400', async () => {
        postResponse = () =>
            jsonResponse(
                { error: { code: 'VALIDATION_ERROR', message: 'Invalid', details: [{ message: 'Nome già usato' }] } },
                false,
                400,
            )
        const { onSuccess } = renderForm()
        await waitForPatterns()
        fillName()
        submit()
        expect(await screen.findByText('Nome già usato')).toBeInTheDocument()
        expect(onSuccess).not.toHaveBeenCalled()
        expect(screen.getByRole('button', { name: 'exercises.createExercise' })).toBeEnabled()
    })

    it('calls onCancel without POSTing when Cancel is clicked', async () => {
        const { onCancel } = renderForm()
        await waitForPatterns()
        fireEvent.click(screen.getByRole('button', { name: 'exercises.cancel' }))
        expect(onCancel).toHaveBeenCalledTimes(1)
        expect(postCalls()).toHaveLength(0)
    })
})
