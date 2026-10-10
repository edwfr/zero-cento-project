'use client'

import { useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import Timeline, {
    CustomHeader,
    DateHeader,
    SidebarHeader,
    TimelineHeaders,
    TimelineMarkers,
    TodayMarker,
    type Id,
    type ReactCalendarTimelineProps,
    type TimelineItemBase,
} from 'react-calendar-timeline'
import 'react-calendar-timeline/style.css'
import {
    VIEW_SPAN_MS,
    addDays,
    clampRangeToFree,
    dayToLocalMs,
    findOverlap,
    formatTimelineLabel,
    localMsToDay,
    movePeriod,
    programToRange,
    readableTextColor,
    resizePeriod,
    snapToWeekStart,
    type DayRange,
    type MacroPeriodDto,
    type PlanProgramDto,
    type TimelineLabelStyle,
    type TimelineView,
} from '@/lib/macro-periods'
import { useDraftPeriodDrag } from './useDraftPeriodDrag'

export interface MacroPeriodTimelineProps {
    periods: MacroPeriodDto[]
    programs: PlanProgramDto[]
    view: TimelineView
    visibleStart: number
    visibleEnd: number
    /** Range being drawn, or waiting in the dialog; rendered as a dashed bar */
    draft: DayRange | null
    labels: { phases: string; programs: string; draft: string }
    onVisibleRangeChange: (start: number, end: number) => void
    onDraftChange: (range: DayRange | null) => void
    onDraftCommit: (range: DayRange) => void
    /** Whole-week range, different from the current one, overlapping nothing */
    onPeriodChange: (id: string, range: DayRange) => void
    onPeriodConflict: () => void
    onPeriodClick: (id: string) => void
    onProgramClick: (id: string) => void
}

const DAY_MS = 86_400_000
const LINE_HEIGHT = 48
const SIDEBAR_WIDTH = 96
const PHASES_GROUP = 'phases'
const PROGRAMS_GROUP = 'programs'

interface PlanItem extends TimelineItemBase<number> {
    id: string
    group: string
    kind: 'period' | 'program' | 'draft'
    label: string
    tooltip: string
    background: string
    textColor: string
}

/** The library works with an exclusive end: the midnight after the last day. */
const toSpan = (range: DayRange) => ({
    start_time: dayToLocalMs(range.startDate),
    end_time: dayToLocalMs(addDays(range.endDate, 1)),
})

const renderItem: NonNullable<ReactCalendarTimelineProps<PlanItem>['itemRenderer']> = ({
    item,
    itemContext,
    getItemProps,
    getResizeProps,
}) => {
    const { left: leftResizeProps, right: rightResizeProps } = getResizeProps()
    const { key, ...itemProps } = getItemProps({
        style: {
            background: item.background,
            color: item.textColor,
            border: item.kind === 'draft' ? '2px dashed #6b7280' : '1px solid rgba(17, 24, 39, 0.15)',
            borderRadius: 6,
            cursor: item.kind === 'draft' ? 'default' : 'pointer',
        },
    })

    return (
        <div key={key} {...itemProps} title={item.tooltip} data-kind={item.kind}>
            {itemContext.useResizeHandle ? <div {...leftResizeProps} /> : null}
            <div
                className="truncate px-2 text-xs font-semibold"
                style={{ height: itemContext.dimensions.height, lineHeight: `${itemContext.dimensions.height}px` }}
            >
                {item.label}
            </div>
            {itemContext.useResizeHandle ? <div {...rightResizeProps} /> : null}
        </div>
    )
}

/** `period:<id>` → `['period', '<id>']`. Ids are UUIDs: no colon inside. */
const parseItemId = (itemId: Id): [string, string] => {
    const [kind, id = ''] = String(itemId).split(':')
    return [kind, id]
}

/**
 * Lane timeline of a trainee's plan: an editable phases row and a read-only
 * programs row. Loaded with next/dynamic (ssr: false) — never import it statically.
 */
export default function MacroPeriodTimeline({
    periods,
    programs,
    view,
    visibleStart,
    visibleEnd,
    draft,
    labels,
    onVisibleRangeChange,
    onDraftChange,
    onDraftCommit,
    onPeriodChange,
    onPeriodConflict,
    onPeriodClick,
    onProgramClick,
}: MacroPeriodTimelineProps) {
    const { i18n } = useTranslation()
    // The library formats with dayjs' default (English) locale: write month and year ourselves
    const headerLabel = (style: TimelineLabelStyle) => ([start]: [{ valueOf: () => number }, unknown]) =>
        formatTimelineLabel(start.valueOf(), style, i18n.language)

    const containerRef = useRef<HTMLDivElement>(null)
    const scrollElementRef = useRef<HTMLDivElement | null>(null)
    const visibleRangeRef = useRef({ start: visibleStart, end: visibleEnd })
    visibleRangeRef.current = { start: visibleStart, end: visibleEnd }

    const { consumeCanvasClick } = useDraftPeriodDrag({
        containerRef,
        getScrollElement: () => scrollElementRef.current,
        getVisibleRange: () => visibleRangeRef.current,
        rowHeight: LINE_HEIGHT,
        periods,
        enabled: true,
        onDraftChange,
        onCommit: onDraftCommit,
    })

    const groups = useMemo(
        () => [
            { id: PHASES_GROUP, title: labels.phases },
            { id: PROGRAMS_GROUP, title: labels.programs },
        ],
        [labels.phases, labels.programs]
    )

    const items = useMemo<PlanItem[]>(() => {
        const periodItems = periods.map<PlanItem>((period) => ({
            id: `period:${period.id}`,
            group: PHASES_GROUP,
            kind: 'period',
            label: period.phaseType.name,
            tooltip: period.note ? `${period.phaseType.name} — ${period.note}` : period.phaseType.name,
            background: period.phaseType.color,
            textColor: readableTextColor(period.phaseType.color),
            canMove: true,
            canResize: 'both',
            ...toSpan(period),
        }))

        const programItems = programs.map<PlanItem>((program) => ({
            id: `program:${program.id}`,
            group: PROGRAMS_GROUP,
            kind: 'program',
            label: program.title,
            tooltip: program.title,
            background: '#e5e7eb',
            textColor: '#374151',
            canMove: false,
            canResize: false,
            ...toSpan(programToRange(program.startDate, program.durationWeeks)),
        }))

        const draftItems: PlanItem[] = draft
            ? [
                  {
                      id: 'draft',
                      group: PHASES_GROUP,
                      kind: 'draft',
                      label: labels.draft,
                      tooltip: labels.draft,
                      background: '#f3f4f6',
                      textColor: '#374151',
                      canMove: false,
                      canResize: false,
                      ...toSpan(draft),
                  },
              ]
            : []

        return [...periodItems, ...programItems, ...draftItems]
    }, [periods, programs, draft, labels.draft])

    // The library arms drag and resize on selected items only: keep every period selected
    const selected = useMemo(() => periods.map((period) => `period:${period.id}`), [periods])

    const findPeriod = (itemId: Id) => {
        const [kind, id] = parseItemId(itemId)
        return kind === 'period' ? periods.find((period) => period.id === id) : undefined
    }

    const applyChange = (period: MacroPeriodDto, next: DayRange) => {
        if (next.startDate === period.startDate && next.endDate === period.endDate) return
        if (findOverlap(next, periods, period.id)) {
            onPeriodConflict()
            return
        }
        onPeriodChange(period.id, next)
    }

    const handleItemMove = (itemId: Id, dragTime: number) => {
        const period = findPeriod(itemId)
        if (period) applyChange(period, movePeriod(period, localMsToDay(dragTime)))
    }

    const handleItemResize = (itemId: Id, time: number, edge: 'left' | 'right') => {
        const period = findPeriod(itemId)
        if (period) applyChange(period, resizePeriod(period, edge, localMsToDay(time)))
    }

    const handleItemActivate = (itemId: Id) => {
        const [kind, id] = parseItemId(itemId)
        if (kind === 'period') onPeriodClick(id)
        if (kind === 'program') onProgramClick(id)
    }

    // Touch path (and fallback): a tap on a free week. A mouse press is handled by the drag hook,
    // which also swallows the click the browser fires after it.
    const handleCanvasClick = (groupId: Id, time: number) => {
        if (groupId !== PHASES_GROUP || consumeCanvasClick()) return
        const day = localMsToDay(time)
        const range = clampRangeToFree(day, day, periods)
        if (!range) return
        onDraftChange(range)
        onDraftCommit(range)
    }

    return (
        <div ref={containerRef} className="overflow-hidden rounded-lg border border-gray-200 bg-white">
            <Timeline<PlanItem>
                groups={groups}
                items={items}
                selected={selected}
                visibleTimeStart={visibleStart}
                visibleTimeEnd={visibleEnd}
                onTimeChange={(start, end) => onVisibleRangeChange(start, end)}
                minZoom={VIEW_SPAN_MS[view]}
                maxZoom={VIEW_SPAN_MS[view]}
                dragSnap={DAY_MS}
                lineHeight={LINE_HEIGHT}
                itemHeightRatio={0.7}
                sidebarWidth={SIDEBAR_WIDTH}
                stackItems={false}
                canMove
                canChangeGroup={false}
                canResize="both"
                scrollRef={(element) => {
                    scrollElementRef.current = element
                }}
                itemRenderer={renderItem}
                // dragSnap is epoch-aligned and cannot land on Mondays: snap here instead
                moveResizeValidator={(_action, _item, time) => dayToLocalMs(snapToWeekStart(localMsToDay(time)))}
                onItemMove={handleItemMove}
                onItemResize={handleItemResize}
                onItemClick={handleItemActivate}
                onItemSelect={handleItemActivate}
                onCanvasClick={handleCanvasClick}
            >
                {/* The library paints the header root red (#c52020): it shows through every header without its own background */}
                <TimelineHeaders style={{ background: '#f9fafb' }}>
                    <SidebarHeader>{({ getRootProps }) => <div {...getRootProps()} />}</SidebarHeader>
                    {view === 'weeks' ? (
                        <>
                            <DateHeader unit="month" labelFormat={headerLabel('monthYear')} />
                            {/* The library has no week unit: draw Mondays over day intervals, seven days wide */}
                            <CustomHeader unit="day" height={28}>
                                {({ headerContext: { intervals }, getRootProps, getIntervalProps }) => (
                                    <div {...getRootProps()}>
                                        {intervals
                                            .filter((interval) => interval.startTime.day() === 1)
                                            .map((interval) => {
                                                const intervalProps = getIntervalProps({ interval })
                                                return (
                                                    <div
                                                        {...intervalProps}
                                                        key={intervalProps.key}
                                                        className="border-l border-gray-200 text-center text-xs leading-7 text-gray-600"
                                                        style={{
                                                            ...intervalProps.style,
                                                            width: Number(intervalProps.style?.width ?? 0) * 7,
                                                        }}
                                                    >
                                                        {interval.startTime.format('D/M')}
                                                    </div>
                                                )
                                            })}
                                    </div>
                                )}
                            </CustomHeader>
                        </>
                    ) : (
                        <>
                            <DateHeader unit="year" labelFormat={headerLabel('year')} />
                            <DateHeader unit="month" labelFormat={headerLabel('month')} />
                        </>
                    )}
                </TimelineHeaders>
                <TimelineMarkers>
                    <TodayMarker />
                </TimelineMarkers>
            </Timeline>
        </div>
    )
}
