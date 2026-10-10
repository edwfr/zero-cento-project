import { useRef } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen } from '@testing-library/react'

import { useDraftPeriodDrag } from '@/components/useDraftPeriodDrag'
import { WEEK_MS, dayToLocalMs, type PeriodRange } from '@/lib/macro-periods'

const onDraftChange = vi.fn()
const onCommit = vi.fn()

// Visible range: 12 weeks from Monday 2026-10-05, drawn 1200px wide starting at x=100 → 100px per week.
const VISIBLE_START = dayToLocalMs('2026-10-05')
const RANGE = { start: VISIBLE_START, end: VISIBLE_START + 12 * WEEK_MS }
const ROW_HEIGHT = 48

// Week 4 (2026-11-02 → 2026-11-08) is taken.
const PERIODS: PeriodRange[] = [{ id: 'p2', startDate: '2026-11-02', endDate: '2026-11-08' }]

function Harness({ enabled = true, periods = PERIODS }: { enabled?: boolean; periods?: PeriodRange[] }) {
    const containerRef = useRef<HTMLDivElement>(null)
    const scrollRef = useRef<HTMLDivElement>(null)
    const { consumeCanvasClick } = useDraftPeriodDrag({
        containerRef,
        getScrollElement: () => scrollRef.current,
        getVisibleRange: () => RANGE,
        rowHeight: ROW_HEIGHT,
        periods,
        enabled,
        onDraftChange,
        onCommit,
    })

    return (
        <div ref={containerRef}>
            <div data-testid="header" />
            <div ref={scrollRef} data-testid="scroll">
                <div className="rct-item" data-testid="item" />
            </div>
            <output data-testid="consume">{String(consumeCanvasClick())}</output>
            <button type="button" onClick={() => onCommit({ startDate: String(consumeCanvasClick()), endDate: '' })}>
                probe
            </button>
        </div>
    )
}

/** jsdom has no layout: give the scroll element the geometry the hook reads. */
function mount(props: Parameters<typeof Harness>[0] = {}) {
    render(<Harness {...props} />)
    const scroll = screen.getByTestId('scroll')
    scroll.getBoundingClientRect = () =>
        ({ left: 100, top: 50, width: 1200, height: 96, right: 1300, bottom: 146, x: 100, y: 50, toJSON: () => ({}) }) as DOMRect
    return scroll
}

/** Pointer events as plain MouseEvents: jsdom's PointerEvent support varies, the hook only reads these fields. */
function pointer(type: string, target: EventTarget, init: MouseEventInit & { pointerType?: string } = {}) {
    const { pointerType, ...mouseInit } = init
    const event = new MouseEvent(type, { bubbles: true, cancelable: true, button: 0, ...mouseInit })
    if (pointerType) Object.defineProperty(event, 'pointerType', { value: pointerType })
    // The stop-propagation flag is cleared once dispatch ends, so record whether the event got past the capture phase.
    let reachedTarget = false
    const mark = () => {
        reachedTarget = true
    }
    target.addEventListener(type, mark)
    act(() => {
        target.dispatchEvent(event)
    })
    target.removeEventListener(type, mark)
    return { event, reachedTarget }
}

const xOfWeek = (index: number) => 100 + index * 100 + 50 // middle of week `index`
const ROW_0_Y = 50 + 20
const ROW_1_Y = 50 + ROW_HEIGHT + 20

describe('useDraftPeriodDrag', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        vi.useFakeTimers()
    })

    afterEach(() => {
        vi.useRealTimers()
    })

    it('starts a one-week draft on a press over a free week of row 0', () => {
        const scroll = mount()

        const { reachedTarget } = pointer('pointerdown', scroll, { clientX: xOfWeek(1), clientY: ROW_0_Y })

        expect(onDraftChange).toHaveBeenCalledWith({ startDate: '2026-10-12', endDate: '2026-10-18' })
        // keeps the library from starting a pan
        expect(reachedTarget).toBe(false)
    })

    it('grows with the pointer and stops at the next period', () => {
        const scroll = mount()
        pointer('pointerdown', scroll, { clientX: xOfWeek(1), clientY: ROW_0_Y })

        pointer('pointermove', window, { clientX: xOfWeek(2) })
        expect(onDraftChange).toHaveBeenLastCalledWith({ startDate: '2026-10-12', endDate: '2026-10-25' })

        pointer('pointermove', window, { clientX: xOfWeek(8) })
        expect(onDraftChange).toHaveBeenLastCalledWith({ startDate: '2026-10-12', endDate: '2026-11-01' })
    })

    it('grows to the left of the anchor too', () => {
        const scroll = mount()
        pointer('pointerdown', scroll, { clientX: xOfWeek(2), clientY: ROW_0_Y })

        pointer('pointermove', window, { clientX: xOfWeek(0) })

        expect(onDraftChange).toHaveBeenLastCalledWith({ startDate: '2026-10-05', endDate: '2026-10-25' })
    })

    it('commits the drawn range on release and swallows the click that follows', () => {
        const scroll = mount()
        pointer('pointerdown', scroll, { clientX: xOfWeek(1), clientY: ROW_0_Y })
        pointer('pointermove', window, { clientX: xOfWeek(2) })

        pointer('pointerup', window, { clientX: xOfWeek(2) })

        expect(onCommit).toHaveBeenCalledWith({ startDate: '2026-10-12', endDate: '2026-10-25' })

        // the browser fires `click` right after `pointerup`: the canvas-click handler must ignore it
        onCommit.mockClear()
        act(() => screen.getByRole('button', { name: 'probe' }).click())
        expect(onCommit).toHaveBeenCalledWith({ startDate: 'true', endDate: '' })

        act(() => {
            vi.runAllTimers()
        })
        onCommit.mockClear()
        act(() => screen.getByRole('button', { name: 'probe' }).click())
        expect(onCommit).toHaveBeenCalledWith({ startDate: 'false', endDate: '' })
    })

    it('commits a one-week range for a press without movement', () => {
        const scroll = mount()
        pointer('pointerdown', scroll, { clientX: xOfWeek(6), clientY: ROW_0_Y })

        pointer('pointerup', window, { clientX: xOfWeek(6) })

        expect(onCommit).toHaveBeenCalledWith({ startDate: '2026-11-16', endDate: '2026-11-22' })
    })

    it('discards the draft on Escape and does not commit on release', () => {
        const scroll = mount()
        pointer('pointerdown', scroll, { clientX: xOfWeek(1), clientY: ROW_0_Y })

        act(() => {
            window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
        })
        expect(onDraftChange).toHaveBeenLastCalledWith(null)

        pointer('pointermove', window, { clientX: xOfWeek(2) })
        pointer('pointerup', window, { clientX: xOfWeek(2) })

        expect(onCommit).not.toHaveBeenCalled()
        expect(onDraftChange).toHaveBeenLastCalledWith(null)
    })

    it('stops listening after a release', () => {
        const scroll = mount()
        pointer('pointerdown', scroll, { clientX: xOfWeek(1), clientY: ROW_0_Y })
        pointer('pointerup', window, { clientX: xOfWeek(1) })
        onDraftChange.mockClear()

        pointer('pointermove', window, { clientX: xOfWeek(3) })

        expect(onDraftChange).not.toHaveBeenCalled()
    })

    it.each([
        ['a press on an existing bar', () => screen.getByTestId('item'), { clientX: xOfWeek(1), clientY: ROW_0_Y }],
        ['a press on the programs row', () => screen.getByTestId('scroll'), { clientX: xOfWeek(1), clientY: ROW_1_Y }],
        ['a press outside the canvas', () => screen.getByTestId('header'), { clientX: xOfWeek(1), clientY: ROW_0_Y }],
        ['a press on an occupied week', () => screen.getByTestId('scroll'), { clientX: xOfWeek(4), clientY: ROW_0_Y }],
        ['a right-button press', () => screen.getByTestId('scroll'), { clientX: xOfWeek(1), clientY: ROW_0_Y, button: 2 }],
        ['a touch press', () => screen.getByTestId('scroll'), { clientX: xOfWeek(1), clientY: ROW_0_Y, pointerType: 'touch' }],
    ])('ignores %s and lets the event through', (_label, target, init) => {
        mount()

        const { reachedTarget } = pointer('pointerdown', target(), init)

        expect(onDraftChange).not.toHaveBeenCalled()
        expect(reachedTarget).toBe(true)
    })

    it('does nothing while disabled', () => {
        const scroll = mount({ enabled: false })

        pointer('pointerdown', scroll, { clientX: xOfWeek(1), clientY: ROW_0_Y })

        expect(onDraftChange).not.toHaveBeenCalled()
    })
})
