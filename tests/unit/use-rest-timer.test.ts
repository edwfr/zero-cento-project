import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useRestTimer } from '@/lib/useRestTimer'

describe('useRestTimer', () => {
    beforeEach(() => {
        vi.useFakeTimers()
    })

    afterEach(() => {
        vi.useRealTimers()
    })

    it('starts idle with secondsLeft null and isRunning false', () => {
        const { result } = renderHook(() => useRestTimer({ onExpire: vi.fn() }))
        expect(result.current.secondsLeft).toBeNull()
        expect(result.current.isRunning).toBe(false)
        expect(result.current.totalSeconds).toBe(0)
    })

    it('sets secondsLeft and totalSeconds immediately on start', () => {
        const { result } = renderHook(() => useRestTimer({ onExpire: vi.fn() }))

        act(() => {
            result.current.start(120)
        })

        expect(result.current.secondsLeft).toBe(120)
        expect(result.current.totalSeconds).toBe(120)
        expect(result.current.isRunning).toBe(true)
    })

    it('counts down one second per tick', () => {
        const { result } = renderHook(() => useRestTimer({ onExpire: vi.fn() }))

        act(() => {
            result.current.start(5)
        })

        act(() => {
            vi.advanceTimersByTime(1000)
        })
        expect(result.current.secondsLeft).toBe(4)

        act(() => {
            vi.advanceTimersByTime(2000)
        })
        expect(result.current.secondsLeft).toBe(2)
    })

    it('calls onExpire exactly once when countdown finishes', () => {
        const onExpire = vi.fn()
        const { result } = renderHook(() => useRestTimer({ onExpire }))

        act(() => {
            result.current.start(3)
        })

        act(() => {
            vi.advanceTimersByTime(3000)
        })

        expect(onExpire).toHaveBeenCalledTimes(1)
    })

    it('sets secondsLeft to 0 briefly after expire, then null after 500ms', () => {
        const { result } = renderHook(() => useRestTimer({ onExpire: vi.fn() }))

        act(() => {
            result.current.start(1)
        })

        act(() => {
            vi.advanceTimersByTime(1000)
        })

        expect(result.current.secondsLeft).toBe(0)
        expect(result.current.isRunning).toBe(false)

        act(() => {
            vi.advanceTimersByTime(500)
        })

        expect(result.current.secondsLeft).toBeNull()
    })

    it('stop() sets secondsLeft to null and prevents onExpire from firing', () => {
        const onExpire = vi.fn()
        const { result } = renderHook(() => useRestTimer({ onExpire }))

        act(() => {
            result.current.start(10)
        })

        act(() => {
            vi.advanceTimersByTime(3000)
        })

        act(() => {
            result.current.stop()
        })

        expect(result.current.secondsLeft).toBeNull()
        expect(result.current.isRunning).toBe(false)

        act(() => {
            vi.advanceTimersByTime(10000)
        })

        expect(onExpire).not.toHaveBeenCalled()
    })

    it('start() while running restarts from the new duration', () => {
        const onExpire = vi.fn()
        const { result } = renderHook(() => useRestTimer({ onExpire }))

        act(() => {
            result.current.start(10)
        })

        act(() => {
            vi.advanceTimersByTime(5000)
        })

        act(() => {
            result.current.start(8)
        })

        expect(result.current.secondsLeft).toBe(8)
        expect(result.current.totalSeconds).toBe(8)

        act(() => {
            vi.advanceTimersByTime(8000)
        })

        expect(onExpire).toHaveBeenCalledTimes(1)
    })
})
