'use client'

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { Info } from 'lucide-react'
import { formatDate } from '@/lib/date-format'
import type { WeightExplanation, WeightExplanationStep, WeightValue } from '@/lib/weight-explanation'

export interface WeightExplanationPopoverProps {
    explanation: WeightExplanation | null
    className?: string
}

type Translate = (key: string, options?: Record<string, unknown>) => string
type NumberFormatter = (value: number) => string

const POPOVER_WIDTH = 288
const POPOVER_GAP = 8

/** Number formatter: comma decimals for Italian, never en-US; at most 2 decimals. */
export function createNumberFormatter(language: string): NumberFormatter {
    const formatter = new Intl.NumberFormat(language.startsWith('it') ? 'it-IT' : 'en-GB', {
        maximumFractionDigits: 2,
    })
    return (value) => formatter.format(value)
}

function valueLine(value: WeightValue, t: Translate, fmt: NumberFormatter): string {
    return value.kind === 'kg'
        ? t('weightExplanation.valueKg', { weight: fmt(value.kg) })
        : t('weightExplanation.valueRange', { min: fmt(value.minKg), max: fmt(value.maxKg) })
}

/** Translates one structured step into a line of the popover. */
export function stepLine(step: WeightExplanationStep, t: Translate, fmt: NumberFormatter): string {
    const date = (iso: string | null) => (iso ? formatDate(iso) : t('weightExplanation.noDate'))
    switch (step.kind) {
        case 'latestRecord':
            return t(step.totalLoad ? 'weightExplanation.latestRecordTotal' : 'weightExplanation.latestRecord', {
                weight: fmt(step.weightKg),
                reps: fmt(step.reps),
                date: date(step.recordDate),
            })
        case 'oneRm': {
            const key =
                step.chart === 'tuchscherer'
                    ? 'weightExplanation.oneRmTuchscherer'
                    : step.chart === 'bodyweightLoaded'
                      ? 'weightExplanation.oneRmBodyweightLoaded'
                      : 'weightExplanation.oneRmEpley'
            return t(key, {
                weight: fmt(step.recordWeightKg),
                percent: step.chartPercent === null ? '' : fmt(step.chartPercent),
                reps: fmt(step.reps),
                raw: fmt(step.rawKg),
                oneRm: fmt(step.oneRmKg),
            })
        }
        case 'percentOfOneRm':
            return t(step.totalLoad ? 'weightExplanation.percentOfOneRmTotal' : 'weightExplanation.percentOfOneRm', {
                percent: fmt(step.percent),
                oneRm: fmt(step.oneRmKg),
                raw: fmt(step.rawKg),
                result: fmt(step.resultKg),
            })
        case 'previousBase':
            return t(step.ballastKg === null ? 'weightExplanation.previousBase' : 'weightExplanation.previousBaseBallast', {
                row: step.rowNumber,
                exercise: step.exerciseName,
                base: fmt(step.baseKg),
                ballast: step.ballastKg === null ? '' : fmt(step.ballastKg),
            })
        case 'percentOfPrevious':
            return t('weightExplanation.percentOfPrevious', {
                base: fmt(step.baseKg),
                percent: fmt(Math.abs(step.percent)),
                raw: fmt(step.rawKg),
                result: fmt(step.resultKg),
            })
        case 'previousRange':
            return t('weightExplanation.previousRange', {
                row: step.rowNumber,
                exercise: step.exerciseName,
                min: fmt(step.minKg),
                max: fmt(step.maxKg),
            })
        case 'percentOfPreviousRange':
            return t('weightExplanation.percentOfPreviousRange', {
                min: fmt(step.minKg),
                max: fmt(step.maxKg),
                percent: fmt(Math.abs(step.percent)),
                resultMin: fmt(step.resultMinKg),
                resultMax: fmt(step.resultMaxKg),
            })
        case 'rpeIntensity':
            return t(
                step.chart === 'tuchscherer'
                    ? 'weightExplanation.rpeIntensityTuchscherer'
                    : 'weightExplanation.rpeIntensityBodyweightLoaded',
                {
                    reps: fmt(step.reps),
                    rpe: fmt(step.rpe),
                    percent: fmt(step.chartPercent),
                    center: fmt(step.centerKg),
                }
            )
        case 'rpeRange':
            return t('weightExplanation.rpeRange', {
                tolerance: fmt(step.tolerancePercent),
                rawMin: fmt(step.rawMinKg),
                rawMax: fmt(step.rawMaxKg),
                min: fmt(step.minKg),
                max: fmt(step.maxKg),
            })
        case 'absoluteBallast':
            if (step.ballastKg === 0) return t('weightExplanation.absoluteBodyweightOnly')
            if (step.bodyweightKg === null || step.totalKg === null) {
                return t('weightExplanation.absoluteBallastNoBodyweight', { ballast: fmt(step.ballastKg) })
            }
            return t('weightExplanation.absoluteBallast', {
                ballast: fmt(step.ballastKg),
                bodyweight: fmt(step.bodyweightKg),
                date: date(step.measuredAt),
                total: fmt(step.totalKg),
            })
        case 'bodyweight': {
            const base = { bodyweight: fmt(step.bodyweightKg), date: date(step.measuredAt) }
            switch (step.ballast.kind) {
                case 'ballast':
                    return t('weightExplanation.bodyweightBallast', { ...base, ballast: fmt(step.ballast.kg) })
                case 'ballastRange':
                    return t('weightExplanation.bodyweightBallastRange', {
                        ...base,
                        min: fmt(step.ballast.minKg),
                        max: fmt(step.ballast.maxKg),
                    })
                case 'bodyweight':
                    return t('weightExplanation.bodyweightOnly', base)
                default:
                    return t('weightExplanation.missingBodyweight')
            }
        }
        case 'missingBodyweight':
            return t('weightExplanation.missingBodyweight')
        case 'savedDiffers':
            return step.current === null
                ? t('weightExplanation.savedDiffersNoCurrent', { saved: valueLine(step.saved, t, fmt) })
                : t('weightExplanation.savedDiffers', {
                      saved: valueLine(step.saved, t, fmt),
                      current: valueLine(step.current, t, fmt),
                  })
    }
}

/**
 * Info button that opens, on click or tap only, the step-by-step derivation of a
 * trainer-facing weight. Renders nothing when there is nothing to explain.
 */
export default function WeightExplanationPopover({ explanation, className = '' }: WeightExplanationPopoverProps) {
    const { t, i18n } = useTranslation('trainer')
    const [open, setOpen] = useState(false)
    const [popoverStyle, setPopoverStyle] = useState<CSSProperties>({})
    const buttonRef = useRef<HTMLButtonElement>(null)
    const popoverRef = useRef<HTMLDivElement>(null)
    const popoverId = useId()

    // Fixed position in a portal: tables sit in overflow-x-auto containers
    const updatePosition = useCallback(() => {
        const rect = buttonRef.current?.getBoundingClientRect()
        if (!rect) return
        const width = Math.min(POPOVER_WIDTH, window.innerWidth - 2 * POPOVER_GAP)
        const height = popoverRef.current?.scrollHeight ?? 0
        const left = Math.min(Math.max(POPOVER_GAP, rect.left), window.innerWidth - width - POPOVER_GAP)
        const spaceBelow = window.innerHeight - rect.bottom - 2 * POPOVER_GAP
        const spaceAbove = rect.top - 2 * POPOVER_GAP
        const below = height <= spaceBelow || (height > spaceAbove && spaceBelow >= spaceAbove)
        const maxHeight = below ? spaceBelow : spaceAbove
        setPopoverStyle({
            position: 'fixed',
            top: below ? rect.bottom + POPOVER_GAP : rect.top - POPOVER_GAP - Math.min(height, maxHeight),
            left,
            width,
            maxHeight,
            overflowY: 'auto',
            zIndex: 9999,
        })
    }, [])

    useLayoutEffect(() => {
        if (!open) return
        updatePosition()
        window.addEventListener('scroll', updatePosition, true)
        window.addEventListener('resize', updatePosition)
        return () => {
            window.removeEventListener('scroll', updatePosition, true)
            window.removeEventListener('resize', updatePosition)
        }
    }, [open, updatePosition])

    useEffect(() => {
        if (!open) return
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') setOpen(false)
        }
        const onPointerDown = (event: Event) => {
            const target = event.target as Node
            if (!buttonRef.current?.contains(target) && !popoverRef.current?.contains(target)) setOpen(false)
        }
        document.addEventListener('keydown', onKeyDown)
        document.addEventListener('mousedown', onPointerDown)
        document.addEventListener('touchstart', onPointerDown)
        return () => {
            document.removeEventListener('keydown', onKeyDown)
            document.removeEventListener('mousedown', onPointerDown)
            document.removeEventListener('touchstart', onPointerDown)
        }
    }, [open])

    if (!explanation) return null

    const fmt = createNumberFormatter(i18n.language)
    const lines = explanation.steps.map((step) => stepLine(step, t, fmt))
    if (explanation.missingReason) lines.push(t(`weightExplanation.reasons.${explanation.missingReason}`))
    const title = t('weightExplanation.title')

    return (
        <>
            <button
                ref={buttonRef}
                type="button"
                className={`-m-1 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded text-gray-500 hover:text-brand-primary ${className}`.trim()}
                aria-label={t('weightExplanation.buttonLabel')}
                aria-expanded={open}
                aria-haspopup="dialog"
                aria-controls={open ? popoverId : undefined}
                onClick={() => setOpen((value) => !value)}
            >
                <Info className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
            {open &&
                createPortal(
                    <div
                        ref={popoverRef}
                        id={popoverId}
                        role="dialog"
                        aria-label={title}
                        style={popoverStyle}
                        className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-left"
                    >
                        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">{title}</p>
                        <ul className="space-y-1.5">
                            {lines.map((line, index) => (
                                <li key={index} className="text-sm text-gray-900">
                                    {line}
                                </li>
                            ))}
                        </ul>
                    </div>,
                    document.body
                )}
        </>
    )
}

export { WeightExplanationPopover }
