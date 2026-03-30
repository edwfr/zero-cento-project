import { describe, it, expect, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useSwipe } from '@/lib/useSwipe'

function makeTouchEvent(clientX: number, clientY: number): React.TouchEvent {
    return {
        touches: [{ clientX, clientY }],
        changedTouches: [{ clientX, clientY }],
    } as unknown as React.TouchEvent
}

describe('useSwipe', () => {
    it('returns handlers object with onTouchStart and onTouchEnd', () => {
        const { result } = renderHook(() =>
            useSwipe({ onSwipeLeft: vi.fn(), onSwipeRight: vi.fn() })
        )
        expect(result.current.handlers).toHaveProperty('onTouchStart')
        expect(result.current.handlers).toHaveProperty('onTouchEnd')
        expect(typeof result.current.handlers.onTouchStart).toBe('function')
        expect(typeof result.current.handlers.onTouchEnd).toBe('function')
    })

    it('calls onSwipeLeft when swiping left beyond threshold', () => {
        const onSwipeLeft = vi.fn()
        const onSwipeRight = vi.fn()

        const { result } = renderHook(() =>
            useSwipe({ onSwipeLeft, onSwipeRight, threshold: 60 })
        )

        const { onTouchStart, onTouchEnd } = result.current.handlers

        onTouchStart(makeTouchEvent(200, 100))
        onTouchEnd(makeTouchEvent(100, 100)) // dx = -100 (left swipe)

        expect(onSwipeLeft).toHaveBeenCalledTimes(1)
        expect(onSwipeRight).not.toHaveBeenCalled()
    })

    it('calls onSwipeRight when swiping right beyond threshold', () => {
        const onSwipeLeft = vi.fn()
        const onSwipeRight = vi.fn()

        const { result } = renderHook(() =>
            useSwipe({ onSwipeLeft, onSwipeRight, threshold: 60 })
        )

        const { onTouchStart, onTouchEnd } = result.current.handlers

        onTouchStart(makeTouchEvent(100, 100))
        onTouchEnd(makeTouchEvent(200, 100)) // dx = +100 (right swipe)

        expect(onSwipeRight).toHaveBeenCalledTimes(1)
        expect(onSwipeLeft).not.toHaveBeenCalled()
    })

    it('does not trigger when horizontal movement is below threshold', () => {
        const onSwipeLeft = vi.fn()
        const onSwipeRight = vi.fn()

        const { result } = renderHook(() =>
            useSwipe({ onSwipeLeft, onSwipeRight, threshold: 60 })
        )

        const { onTouchStart, onTouchEnd } = result.current.handlers

        onTouchStart(makeTouchEvent(100, 100))
        onTouchEnd(makeTouchEvent(130, 100)) // dx = 30 (below 60 threshold)

        expect(onSwipeLeft).not.toHaveBeenCalled()
        expect(onSwipeRight).not.toHaveBeenCalled()
    })

    it('does not trigger when vertical movement dominates', () => {
        const onSwipeLeft = vi.fn()
        const onSwipeRight = vi.fn()

        const { result } = renderHook(() =>
            useSwipe({ onSwipeLeft, onSwipeRight, threshold: 60 })
        )

        const { onTouchStart, onTouchEnd } = result.current.handlers

        // dx = 80, dy = 150 → vertical dominates
        onTouchStart(makeTouchEvent(100, 100))
        onTouchEnd(makeTouchEvent(20, 250))

        expect(onSwipeLeft).not.toHaveBeenCalled()
        expect(onSwipeRight).not.toHaveBeenCalled()
    })

    it('does nothing on onTouchEnd if onTouchStart was never called', () => {
        const onSwipeLeft = vi.fn()

        const { result } = renderHook(() =>
            useSwipe({ onSwipeLeft })
        )

        // Call onTouchEnd without a prior onTouchStart
        result.current.handlers.onTouchEnd(makeTouchEvent(50, 50))

        expect(onSwipeLeft).not.toHaveBeenCalled()
    })

    it('works without optional callbacks', () => {
        const { result } = renderHook(() => useSwipe({}))

        const { onTouchStart, onTouchEnd } = result.current.handlers

        // Should not throw even without callbacks
        onTouchStart(makeTouchEvent(200, 100))
        expect(() => onTouchEnd(makeTouchEvent(100, 100))).not.toThrow()
    })

    it('uses default threshold of 60 when not specified', () => {
        const onSwipeLeft = vi.fn()

        const { result } = renderHook(() => useSwipe({ onSwipeLeft }))

        const { onTouchStart, onTouchEnd } = result.current.handlers

        // Exactly at threshold - 1 (59px), should NOT trigger
        onTouchStart(makeTouchEvent(200, 100))
        onTouchEnd(makeTouchEvent(141, 100)) // dx = -59

        expect(onSwipeLeft).not.toHaveBeenCalled()
    })
})
