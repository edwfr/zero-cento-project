import { useRef, useCallback } from 'react'

interface SwipeHandlers {
    onSwipeLeft?: () => void
    onSwipeRight?: () => void
    threshold?: number // min px to trigger (default 60)
}

const INTERACTIVE_SELECTOR = 'a, button, input, select, textarea, iframe, video, [role="button"], [data-swipe-ignore="true"]'

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
    const shouldIgnoreSwipe = useRef(false)

    const onTouchStart = useCallback((e: React.TouchEvent) => {
        shouldIgnoreSwipe.current = !!e.target.closest?.(INTERACTIVE_SELECTOR)

        if (shouldIgnoreSwipe.current) {
            touchStartX.current = null
            touchStartY.current = null
            return
        }

        touchStartX.current = e.touches[0].clientX
        touchStartY.current = e.touches[0].clientY
    }, [])

    const onTouchEnd = useCallback(
        (e: React.TouchEvent) => {
            if (shouldIgnoreSwipe.current) {
                shouldIgnoreSwipe.current = false
                return
            }

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
            shouldIgnoreSwipe.current = false
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
