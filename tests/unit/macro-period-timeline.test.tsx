import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render } from '@testing-library/react'

interface StubItem {
    id: string
    group: string
    start_time: number
    end_time: number
    canMove: boolean
    canResize: false | 'both'
}

interface StubTimelineProps {
    items: StubItem[]
    selected: string[]
    minZoom: number
    maxZoom: number
    visibleTimeStart: number
    visibleTimeEnd: number
    moveResizeValidator: (action: 'move' | 'resize', item: StubItem, time: number) => number
    onItemMove: (itemId: string, dragTime: number, newGroupOrder: number) => void
    onItemResize: (itemId: string, time: number, edge: 'left' | 'right') => void
    onItemClick: (itemId: string) => void
    onItemSelect: (itemId: string) => void
    onCanvasClick: (groupId: string, time: number) => void
    onTimeChange: (start: number, end: number) => void
}

const captured = vi.hoisted(() => ({ props: null as StubTimelineProps | null }))

vi.mock('react-calendar-timeline', () => {
    const Empty = () => null
    return {
        default: (props: StubTimelineProps) => {
            captured.props = props
            return <div data-testid="timeline" />
        },
        TimelineHeaders: Empty,
        SidebarHeader: Empty,
        DateHeader: Empty,
        CustomHeader: Empty,
        TimelineMarkers: Empty,
        TodayMarker: Empty,
    }
})

vi.mock('react-calendar-timeline/style.css', () => ({}))

import MacroPeriodTimeline, { type MacroPeriodTimelineProps } from '@/components/MacroPeriodTimeline'
import { VIEW_SPAN_MS, dayToLocalMs, type MacroPeriodDto, type PlanProgramDto } from '@/lib/macro-periods'

const ms = dayToLocalMs
const HOUR = 3_600_000

const period = (id: string, startDate: string, endDate: string): MacroPeriodDto => ({
    id,
    startDate,
    endDate,
    note: null,
    phaseType: { id: 'ph', name: `Fase ${id}`, color: '#1e3a8a', isActive: true },
})

const PERIODS = [period('a', '2026-10-05', '2026-10-18'), period('b', '2026-11-02', '2026-11-08')]
const PROGRAMS: PlanProgramDto[] = [{ id: 'g1', title: 'Scheda A', status: 'active', startDate: '2026-10-07', durationWeeks: 4 }]

const handlers = {
    onVisibleRangeChange: vi.fn(),
    onDraftChange: vi.fn(),
    onDraftCommit: vi.fn(),
    onPeriodChange: vi.fn(),
    onPeriodConflict: vi.fn(),
    onPeriodClick: vi.fn(),
    onProgramClick: vi.fn(),
}

const renderTimeline = (props: Partial<MacroPeriodTimelineProps> = {}) =>
    render(
        <MacroPeriodTimeline
            periods={PERIODS}
            programs={PROGRAMS}
            view="weeks"
            visibleStart={ms('2026-09-28')}
            visibleEnd={ms('2026-09-28') + VIEW_SPAN_MS.weeks}
            draft={null}
            labels={{ phases: 'Fasi', programs: 'Schede', draft: 'Nuovo' }}
            {...handlers}
            {...props}
        />
    )

function timeline(): StubTimelineProps {
    if (!captured.props) throw new Error('timeline not rendered')
    return captured.props
}

describe('MacroPeriodTimeline', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        captured.props = null
    })

    it('maps periods, programs and the draft to library items', () => {
        renderTimeline({ draft: { startDate: '2026-10-19', endDate: '2026-10-25' } })

        expect(timeline().items).toEqual([
            expect.objectContaining({
                id: 'period:a',
                group: 'phases',
                start_time: ms('2026-10-05'),
                end_time: ms('2026-10-19'), // exclusive: the Monday after the last Sunday
                canMove: true,
                canResize: 'both',
            }),
            expect.objectContaining({ id: 'period:b', start_time: ms('2026-11-02'), end_time: ms('2026-11-09') }),
            expect.objectContaining({
                id: 'program:g1',
                group: 'programs',
                start_time: ms('2026-10-07'),
                end_time: ms('2026-11-04'),
                canMove: false,
                canResize: false,
            }),
            expect.objectContaining({
                id: 'draft',
                group: 'phases',
                start_time: ms('2026-10-19'),
                end_time: ms('2026-10-26'),
                canMove: false,
                canResize: false,
            }),
        ])
    })

    it('keeps every period selected so it can be dragged without a first click', () => {
        renderTimeline()

        expect(timeline().selected).toEqual(['period:a', 'period:b'])
    })

    it('locks the zoom to the span of the current view', () => {
        renderTimeline()
        expect(timeline().minZoom).toBe(VIEW_SPAN_MS.weeks)
        expect(timeline().maxZoom).toBe(VIEW_SPAN_MS.weeks)

        renderTimeline({ view: 'month' })
        expect(timeline().minZoom).toBe(VIEW_SPAN_MS.month)
        expect(timeline().maxZoom).toBe(VIEW_SPAN_MS.month)
    })

    it('snaps a drag in the middle of a week to the nearest Monday', () => {
        renderTimeline()
        const { moveResizeValidator, items } = timeline()

        // Wednesday 15:00 → back to Monday; Friday 09:00 → forward to next Monday
        expect(moveResizeValidator('move', items[0], ms('2026-10-21') + 15 * HOUR)).toBe(ms('2026-10-19'))
        expect(moveResizeValidator('resize', items[0], ms('2026-10-23') + 9 * HOUR)).toBe(ms('2026-10-26'))
    })

    it('reports a move onto free weeks, keeping the length', () => {
        renderTimeline()

        timeline().onItemMove('period:a', ms('2026-10-19'), 0)

        expect(handlers.onPeriodChange).toHaveBeenCalledWith('a', { startDate: '2026-10-19', endDate: '2026-11-01' })
        expect(handlers.onPeriodConflict).not.toHaveBeenCalled()
    })

    it('reports a conflict instead of a change when a move overlaps another period', () => {
        renderTimeline()

        timeline().onItemMove('period:a', ms('2026-10-26'), 0)

        expect(handlers.onPeriodConflict).toHaveBeenCalledTimes(1)
        expect(handlers.onPeriodChange).not.toHaveBeenCalled()
    })

    it('ignores a move that lands where the period already is', () => {
        renderTimeline()

        timeline().onItemMove('period:a', ms('2026-10-05'), 0)

        expect(handlers.onPeriodChange).not.toHaveBeenCalled()
        expect(handlers.onPeriodConflict).not.toHaveBeenCalled()
    })

    it('reports a resize of either edge', () => {
        renderTimeline()

        timeline().onItemResize('period:a', ms('2026-10-26'), 'right')
        expect(handlers.onPeriodChange).toHaveBeenLastCalledWith('a', { startDate: '2026-10-05', endDate: '2026-10-25' })

        timeline().onItemResize('period:a', ms('2026-09-28'), 'left')
        expect(handlers.onPeriodChange).toHaveBeenLastCalledWith('a', { startDate: '2026-09-28', endDate: '2026-10-18' })
    })

    it('keeps one week when an edge is dragged past the other', () => {
        renderTimeline()

        timeline().onItemResize('period:a', ms('2026-12-07'), 'left')

        expect(handlers.onPeriodChange).toHaveBeenCalledWith('a', { startDate: '2026-10-12', endDate: '2026-10-18' })
    })

    it('reports a conflict when a resize runs into the next period', () => {
        renderTimeline()

        timeline().onItemResize('period:a', ms('2026-11-09'), 'right')

        expect(handlers.onPeriodConflict).toHaveBeenCalledTimes(1)
        expect(handlers.onPeriodChange).not.toHaveBeenCalled()
    })

    it('ignores move and resize events for items that are not periods', () => {
        renderTimeline()

        timeline().onItemMove('program:g1', ms('2026-11-02'), 1)
        timeline().onItemResize('draft', ms('2026-11-02'), 'right')
        timeline().onItemMove('period:missing', ms('2026-11-02'), 0)

        expect(handlers.onPeriodChange).not.toHaveBeenCalled()
        expect(handlers.onPeriodConflict).not.toHaveBeenCalled()
    })

    it('routes a tap on a period to onPeriodClick and on a program to onProgramClick', () => {
        renderTimeline()

        timeline().onItemClick('period:b')
        expect(handlers.onPeriodClick).toHaveBeenCalledWith('b')

        // a program bar is never selected, so the library reports its first tap as a select
        timeline().onItemSelect('program:g1')
        expect(handlers.onProgramClick).toHaveBeenCalledWith('g1')

        timeline().onItemClick('draft')
        expect(handlers.onPeriodClick).toHaveBeenCalledTimes(1)
    })

    it('turns a tap on a free week of the phases row into a one-week draft', () => {
        renderTimeline()

        timeline().onCanvasClick('phases', ms('2026-10-21') + 10 * HOUR)

        expect(handlers.onDraftChange).toHaveBeenCalledWith({ startDate: '2026-10-19', endDate: '2026-10-25' })
        expect(handlers.onDraftCommit).toHaveBeenCalledWith({ startDate: '2026-10-19', endDate: '2026-10-25' })
    })

    it('ignores a tap on the programs row', () => {
        renderTimeline()

        timeline().onCanvasClick('programs', ms('2026-10-21'))

        expect(handlers.onDraftCommit).not.toHaveBeenCalled()
    })

    it('forwards panning to the parent', () => {
        renderTimeline()

        timeline().onTimeChange(10, 20)

        expect(handlers.onVisibleRangeChange).toHaveBeenCalledWith(10, 20)
    })
})
