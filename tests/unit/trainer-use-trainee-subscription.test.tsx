import { describe, it, expect, vi } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import { useTraineeSubscription } from '@/app/trainer/trainees/[id]/_use-trainee-subscription'

const current = { status: 'expiring', endDate: '2026-10-10T00:00:00.000Z', daysLeft: 7 }
const items = [{ id: 'r-1', traineeId: 't-1', startDate: '2026-09-10', durationMonths: 1, endDate: '2026-10-10', createdAt: '2026-09-10' }]

describe('useTraineeSubscription', () => {
    it('loads the renewals and the current status of the trainee', async () => {
        global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: { items, current } }) }) as never

        const { result } = renderHook(() => useTraineeSubscription('t-1'))

        await waitFor(() => expect(result.current.loading).toBe(false))
        expect(global.fetch).toHaveBeenCalledWith('/api/subscription-renewals?traineeId=t-1')
        expect(result.current.renewals).toEqual(items)
        expect(result.current.current).toEqual(current)
        expect(result.current.error).toBe(false)
    })

    it('flags an error when the request fails', async () => {
        global.fetch = vi.fn().mockResolvedValue({ ok: false, json: async () => ({}) }) as never

        const { result } = renderHook(() => useTraineeSubscription('t-1'))

        await waitFor(() => expect(result.current.loading).toBe(false))
        expect(result.current.error).toBe(true)
    })

    it('clears the status after a reload that finds no renewals', async () => {
        global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: { items, current } }) }) as never
        const { result } = renderHook(() => useTraineeSubscription('t-1'))
        await waitFor(() => expect(result.current.current).toEqual(current))

        global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: { items: [], current: null } }) }) as never
        await act(() => result.current.reload())

        expect(result.current.renewals).toEqual([])
        expect(result.current.current).toBeNull()
    })
})
