import { useRef, useCallback } from 'react'

interface SwipeHandlers {
    onSwipeLeft?: () => void
    onSwipeRight?: () => void
    threshold?: number // min px to trigger (default 60)
}

/**
 * useSwipe — lightweight touch swipe detection hook.
 * Returns ref to attach to the element and touch event handlers.
 *
 * Usage:
 *   const { handlers } = useSwipe({ onSwipeLeft: () => next(), onSwipeRight: () => prev() })
 *   <div {...handlers}>...</div>
 */
export function useSwipe({ onSwipeLeft, onSwipeRight, threshold = 60 }: SwipeHandlers) {
    const touchStartX = useRef<number | null>(null)
    const touchStartY = useRef<number | null>(null)

    const onTouchStart = useCallback((e: React.TouchEvent) => {
        touchStartX.current = e.touches[0].clientX
        touchStartY.current = e.touches[0].clientY
    }, [])

    const onTouchEnd = useCallback(
        (e: React.TouchEvent) => {
            if (touchStartX.current === null || touchStartY.current === null) return

            const dx = e.changedTouches[0].clientX - touchStartX.current
            const dy = e.changedTouches[0].clientY - touchStartY.current

            // Only treat as horizontal swipe if horizontal movement dominates
            if (Math.abs(dx) < threshold || Math.abs(dx) < Math.abs(dy)) {
                touchStartX.current = null
                touchStartY.current = null
                return
            }

            if (dx < 0) {
                onSwipeLeft?.()
            } else {
                onSwipeRight?.()
            }

            touchStartX.current = null
            touchStartY.current = null
        },
        [onSwipeLeft, onSwipeRight, threshold]
    )

    return {
        handlers: {
            onTouchStart,
            onTouchEnd,
        },
    }
}
