import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'

const showToast = vi.hoisted(() => vi.fn())
const exportProgramToPdf = vi.hoisted(() => vi.fn())

vi.mock('@/components/ToastNotification', () => ({
    useToast: () => ({ showToast }),
}))

vi.mock('@/lib/program-pdf-export', () => ({
    exportProgramToPdf,
}))

import type { TFunction } from 'i18next'
import { getApiErrorMessage } from '@/lib/api-error'
import { useTrainerProgramPdfExport } from '@/lib/use-trainer-program-pdf-export'

const apiProgram = {
    id: 'p1',
    title: 'Blocco A',
    startDate: '2026-11-02',
    trainee: { firstName: 'Mario', lastName: 'Rossi' },
    trainer: { firstName: 'Luca', lastName: 'Bianchi' },
    weeks: [
        {
            weekNumber: 1,
            weekType: 'volume',
            workouts: [
                {
                    id: 'w-1',
                    dayIndex: 1,
                    workoutExercises: [
                        {
                            id: 'we-1',
                            variant: null,
                            sets: 3,
                            reps: '5',
                            targetRpe: 8,
                            weightType: 'absolute',
                            weight: null,
                            effectiveWeight: null,
                            rpeWeightMin: null,
                            rpeWeightMax: null,
                            ballast: { kind: 'ballast', kg: 10 },
                            restTime: 'm2',
                            isWarmup: false,
                            isJumpSet: false,
                            isSuperSet: false,
                            exercise: { name: 'Trazioni', type: 'fundamental' },
                        },
                    ],
                },
            ],
        },
    ],
}

const okResponse = (body: unknown) => ({ ok: true, json: async () => body }) as Response
const errorResponse = (body: unknown) => ({ ok: false, json: async () => body }) as Response

describe('useTrainerProgramPdfExport', () => {
    const fetchMock = vi.fn()

    beforeEach(() => {
        vi.clearAllMocks()
        vi.stubGlobal('fetch', fetchMock)
        exportProgramToPdf.mockResolvedValue(undefined)
    })

    afterEach(() => {
        vi.unstubAllGlobals()
    })

    it('fetches with the resolve flag and exports the mapped athlete PDF', async () => {
        fetchMock.mockResolvedValue(okResponse({ data: { program: apiProgram } }))
        const { result } = renderHook(() => useTrainerProgramPdfExport())

        await act(async () => {
            await result.current.exportProgramPdf('p1')
        })

        expect(fetchMock).toHaveBeenCalledWith(
            '/api/programs/p1?resolveWeights=trainee',
            expect.objectContaining({ cache: 'no-store' })
        )
        expect(exportProgramToPdf).toHaveBeenCalledTimes(1)
        const [data, labels, options] = exportProgramToPdf.mock.calls[0]
        expect(data).toMatchObject({
            title: 'Blocco A',
            traineeName: 'Mario Rossi',
            trainerName: 'Luca Bianchi',
            weeks: [
                {
                    weekNumber: 1,
                    workouts: [
                        {
                            id: 'w-1',
                            dayIndex: 1,
                            exercises: [
                                {
                                    id: 'we-1',
                                    name: 'Trazioni',
                                    weightLabelOverride: 'common:common.bodyweightLoad.ballast',
                                },
                            ],
                        },
                    ],
                },
            ],
        })
        expect(labels).toMatchObject({ tableExercise: 'trainee:currentProgram.tableExercise' })
        expect(options).toEqual({ fileNamePrefix: 'trainee:currentProgram.pdfFileNamePrefix', locale: 'en-GB' })
        expect(showToast).not.toHaveBeenCalled()
        expect(result.current.exportingProgramId).toBeNull()
    })

    it('tracks the exporting id and ignores a second export while one runs', async () => {
        let resolveFetch: (value: Response) => void = () => {}
        fetchMock.mockReturnValue(new Promise<Response>((resolve) => { resolveFetch = resolve }))
        const { result } = renderHook(() => useTrainerProgramPdfExport())

        let first: Promise<void> = Promise.resolve()
        act(() => {
            first = result.current.exportProgramPdf('p1')
        })
        expect(result.current.exportingProgramId).toBe('p1')

        await act(async () => {
            await result.current.exportProgramPdf('p2')
        })
        expect(fetchMock).toHaveBeenCalledTimes(1)

        await act(async () => {
            resolveFetch(okResponse({ data: { program: apiProgram } }))
            await first
        })
        expect(result.current.exportingProgramId).toBeNull()
        expect(exportProgramToPdf).toHaveBeenCalledTimes(1)
    })

    it('shows the API error and does not export when the fetch fails', async () => {
        const errorBody = { error: { code: 'FORBIDDEN', message: 'Access denied', key: 'program.viewDenied' } }
        fetchMock.mockResolvedValue(errorResponse(errorBody))
        const { result } = renderHook(() => useTrainerProgramPdfExport())

        await act(async () => {
            await result.current.exportProgramPdf('p1')
        })

        const identity = ((key: string) => key) as unknown as TFunction
        expect(showToast).toHaveBeenCalledWith(
            getApiErrorMessage(errorBody, 'programs.exportPdfError', identity),
            'error'
        )
        expect(exportProgramToPdf).not.toHaveBeenCalled()
        await waitFor(() => expect(result.current.exportingProgramId).toBeNull())
    })

    it('shows the generic error when the PDF generation fails', async () => {
        fetchMock.mockResolvedValue(okResponse({ data: { program: apiProgram } }))
        exportProgramToPdf.mockRejectedValue('boom')
        const { result } = renderHook(() => useTrainerProgramPdfExport())

        await act(async () => {
            await result.current.exportProgramPdf('p1')
        })

        expect(showToast).toHaveBeenCalledWith('programs.exportPdfError', 'error')
        expect(result.current.exportingProgramId).toBeNull()
    })
})
