import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, renderHook } from '@testing-library/react'

import { useExerciseCatalog } from '@/app/trainer/programs/[id]/edit/use-exercise-catalog'

const jsonResponse = (data: unknown, ok = true) => ({ ok, json: async () => data })

const exercisesPage = (items: Array<{ id: string; name: string }>) =>
    jsonResponse({
        data: {
            items: items.map((item) => ({ ...item, type: 'fundamental', notes: [], movementPattern: null })),
            pagination: { hasMore: false, nextCursor: null },
        },
    })

describe('useExerciseCatalog', () => {
    const fetchMock = vi.fn()

    beforeEach(() => {
        fetchMock.mockReset()
        vi.stubGlobal('fetch', fetchMock)
    })

    afterEach(() => {
        vi.unstubAllGlobals()
    })

    it('loads the catalog sorted by name', async () => {
        fetchMock.mockImplementation(async (url: string) =>
            url === '/api/movement-patterns'
                ? jsonResponse({ data: { items: [] } })
                : exercisesPage([
                      { id: 'b', name: 'Squat' },
                      { id: 'a', name: 'Panca' },
                  ])
        )
        const { result } = renderHook(() => useExerciseCatalog())

        await act(() => result.current.refreshExerciseCatalog())

        expect(result.current.exerciseCatalog.map((e) => e.name)).toEqual(['Panca', 'Squat'])
    })

    it('keeps the current catalog when a refresh throws', async () => {
        fetchMock.mockImplementation(async (url: string) =>
            url === '/api/movement-patterns'
                ? jsonResponse({ data: { items: [] } })
                : exercisesPage([{ id: 'a', name: 'Panca' }])
        )
        const { result } = renderHook(() => useExerciseCatalog())
        await act(() => result.current.refreshExerciseCatalog())
        expect(result.current.exerciseCatalog).toHaveLength(1)

        fetchMock.mockImplementation(async (url: string) => {
            if (url === '/api/movement-patterns') return jsonResponse({ data: { items: [] } })
            throw new TypeError('Failed to fetch')
        })
        await act(() => result.current.refreshExerciseCatalog())

        expect(result.current.exerciseCatalog.map((e) => e.name)).toEqual(['Panca'])
    })

    it('keeps the current catalog when a refresh gets a non-ok response', async () => {
        fetchMock.mockImplementation(async (url: string) =>
            url === '/api/movement-patterns'
                ? jsonResponse({ data: { items: [] } })
                : exercisesPage([{ id: 'a', name: 'Panca' }])
        )
        const { result } = renderHook(() => useExerciseCatalog())
        await act(() => result.current.refreshExerciseCatalog())

        fetchMock.mockImplementation(async (url: string) =>
            url === '/api/movement-patterns'
                ? jsonResponse({ data: { items: [] } })
                : jsonResponse({ error: { code: 'INTERNAL_ERROR' } }, false)
        )
        await act(() => result.current.refreshExerciseCatalog())

        expect(result.current.exerciseCatalog.map((e) => e.name)).toEqual(['Panca'])
    })
})
