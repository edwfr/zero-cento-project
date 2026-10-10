'use client'

import { useEffect, useRef, type RefObject } from 'react'
import {
    clampRangeToFree,
    localMsToDay,
    xToMs,
    type DayRange,
    type IsoDay,
    type PeriodRange,
} from '@/lib/macro-periods'

export interface DraftPeriodDragOptions {
    /** Element wrapping the timeline: the press is intercepted here, before the library sees it */
    containerRef: RefObject<HTMLElement | null>
    /** The library's scroll element: its box is the visible canvas */
    getScrollElement: () => HTMLElement | null
    getVisibleRange: () => { start: number; end: number }
    /** Height of the first row (the phases row); presses below it are left to the library */
    rowHeight: number
    periods: PeriodRange[]
    enabled: boolean
    onDraftChange: (range: DayRange | null) => void
    onCommit: (range: DayRange) => void
}

interface DragSession {
    anchor: IsoDay
    range: DayRange
    cancelled: boolean
}

/**
 * Draw a new period by dragging across free weeks of the phases row.
 *
 * The timeline library has no such gesture and pans on a canvas drag, so the press
 * is caught in the capture phase and stopped there — on the phases row only, so
 * panning keeps working everywhere else. Touch is left alone: a finger drag scrolls.
 */
export function useDraftPeriodDrag(options: DraftPeriodDragOptions): { consumeCanvasClick: () => boolean } {
    const latest = useRef(options)
    latest.current = options

    // True between a release and the `click` the browser fires right after it
    const swallowClick = useRef(false)

    const { containerRef } = options

    useEffect(() => {
        const container = containerRef.current
        if (!container) return

        let session: DragSession | null = null

        const dayAt = (clientX: number, scrollElement: HTMLElement): IsoDay => {
            const rect = scrollElement.getBoundingClientRect()
            const { start, end } = latest.current.getVisibleRange()
            return localMsToDay(xToMs(clientX - rect.left, rect.width, start, end))
        }

        const stopListening = () => {
            window.removeEventListener('pointermove', onMove)
            window.removeEventListener('pointerup', onUp)
            window.removeEventListener('pointercancel', onCancel)
            window.removeEventListener('keydown', onKeyDown)
        }

        const cancel = () => {
            if (!session || session.cancelled) return
            session.cancelled = true
            latest.current.onDraftChange(null)
        }

        function onMove(event: PointerEvent) {
            const scrollElement = latest.current.getScrollElement()
            if (!session || session.cancelled || !scrollElement) return

            const next = clampRangeToFree(session.anchor, dayAt(event.clientX, scrollElement), latest.current.periods)
            if (!next) return
            session.range = next
            latest.current.onDraftChange(next)
        }

        function onUp() {
            if (!session) return
            const { range, cancelled } = session
            session = null
            stopListening()

            swallowClick.current = true
            setTimeout(() => {
                swallowClick.current = false
            }, 0)

            if (!cancelled) latest.current.onCommit(range)
        }

        function onCancel() {
            cancel()
            session = null
            stopListening()
        }

        function onKeyDown(event: KeyboardEvent) {
            if (event.key === 'Escape') cancel()
        }

        function onDown(event: PointerEvent) {
            const { enabled, getScrollElement, rowHeight, periods, onDraftChange } = latest.current
            if (!enabled || session || event.pointerType === 'touch' || event.button !== 0) return

            const scrollElement = getScrollElement()
            const target = event.target
            if (!scrollElement || !(target instanceof Element) || !scrollElement.contains(target)) return
            if (target.closest('.rct-item')) return

            const y = event.clientY - scrollElement.getBoundingClientRect().top
            if (y < 0 || y >= rowHeight) return

            const anchor = dayAt(event.clientX, scrollElement)
            const range = clampRangeToFree(anchor, anchor, periods)
            if (!range) return

            event.stopPropagation()
            session = { anchor, range, cancelled: false }
            onDraftChange(range)

            window.addEventListener('pointermove', onMove)
            window.addEventListener('pointerup', onUp)
            window.addEventListener('pointercancel', onCancel)
            window.addEventListener('keydown', onKeyDown)
        }

        container.addEventListener('pointerdown', onDown, true)
        return () => {
            container.removeEventListener('pointerdown', onDown, true)
            stopListening()
        }
    }, [containerRef])

    return { consumeCanvasClick: () => swallowClick.current }
}
