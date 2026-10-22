import { describe, it, expect } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import WeightExplanationPopover, { createNumberFormatter, stepLine } from '@/components/WeightExplanationPopover'
import { explainWeight } from '@/lib/weight-explanation'
import type { WeightExplanationInput, WeightExplanationStep } from '@/lib/weight-explanation'

function input(overrides: Partial<WeightExplanationInput> = {}): WeightExplanationInput {
    return {
        weightType: 'percentage_1rm',
        weight: 85,
        reps: '5',
        targetRpe: null,
        isBodyweightLoaded: false,
        latestRecord: { weight: 120, reps: 5, recordDate: '2026-09-30' },
        bodyweight: null,
        previous: null,
        saved: null,
        ...overrides,
    }
}

const explanation = () => explainWeight(input())

describe('WeightExplanationPopover', () => {
    it('renders nothing without an explanation', () => {
        const { container } = render(<WeightExplanationPopover explanation={null} />)
        expect(container).toBeEmptyDOMElement()
        expect(screen.queryByRole('button')).not.toBeInTheDocument()
    })

    it('renders a closed accessible button', () => {
        render(<WeightExplanationPopover explanation={explanation()} />)
        const button = screen.getByRole('button', { name: 'weightExplanation.buttonLabel' })
        expect(button).toHaveAttribute('aria-expanded', 'false')
    })

    it('opens on click with one row per step and closes on second click', () => {
        render(<WeightExplanationPopover explanation={explanation()} />)
        const button = screen.getByRole('button')
        fireEvent.click(button)
        expect(button).toHaveAttribute('aria-expanded', 'true')
        const dialog = screen.getByRole('dialog')
        expect(dialog.querySelectorAll('li')).toHaveLength(3)
        expect(dialog).toHaveTextContent('weightExplanation.latestRecord')
        expect(dialog).toHaveTextContent('weightExplanation.oneRmTuchscherer')
        expect(dialog).toHaveTextContent('weightExplanation.percentOfOneRm')
        fireEvent.click(button)
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })

    it('does not open on hover or focus', () => {
        render(<WeightExplanationPopover explanation={explanation()} />)
        const button = screen.getByRole('button')
        fireEvent.mouseEnter(button)
        fireEvent.focus(button)
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })

    it('closes on Escape', () => {
        render(<WeightExplanationPopover explanation={explanation()} />)
        fireEvent.click(screen.getByRole('button'))
        fireEvent.keyDown(document, { key: 'Escape' })
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })

    it('closes on mousedown outside but not inside', () => {
        render(<WeightExplanationPopover explanation={explanation()} />)
        fireEvent.click(screen.getByRole('button'))
        fireEvent.mouseDown(screen.getByRole('dialog'))
        expect(screen.getByRole('dialog')).toBeInTheDocument()
        fireEvent.mouseDown(document.body)
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })

    it('closes on touchstart outside', () => {
        render(<WeightExplanationPopover explanation={explanation()} />)
        fireEvent.click(screen.getByRole('button'))
        fireEvent.touchStart(document.body)
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })

    it('shows the missing reason', () => {
        render(<WeightExplanationPopover explanation={explainWeight(input({ latestRecord: null }))} />)
        fireEvent.click(screen.getByRole('button'))
        expect(screen.getByRole('dialog')).toHaveTextContent('weightExplanation.reasons.noRecord')
    })

    it('uses the no-current key when the saved weight cannot be recalculated', () => {
        const e = explainWeight(input({ latestRecord: null, saved: { kind: 'kg', kg: 100 } }))
        render(<WeightExplanationPopover explanation={e} />)
        fireEvent.click(screen.getByRole('button'))
        expect(screen.getByRole('dialog')).toHaveTextContent('weightExplanation.savedDiffersNoCurrent')
    })
})

describe('stepLine', () => {
    // Echoes key and options so interpolation can be asserted
    const t = (key: string, options?: Record<string, unknown>) => `${key}|${JSON.stringify(options ?? {})}`
    const fmt = createNumberFormatter('it')

    it('substitutes the noDate key when the record date is null', () => {
        const step: WeightExplanationStep = { kind: 'latestRecord', weightKg: 120, reps: 5, recordDate: null, totalLoad: false }
        expect(stepLine(step, t, fmt)).toContain('"date":"weightExplanation.noDate|{}"')
    })

    it('formats decimals with a comma in Italian and a dot in English', () => {
        expect(createNumberFormatter('it')(104.25)).toBe('104,25')
        expect(createNumberFormatter('en')(104.25)).toBe('104.25')
    })

    it('shows previous-row percentages as absolute values', () => {
        const step: WeightExplanationStep = { kind: 'percentOfPrevious', baseKg: 100, percent: -10, rawKg: 90, resultKg: 90 }
        expect(stepLine(step, t, fmt)).toContain('"percent":"10"')
    })

    it('maps bodyweight ballast kinds to their keys', () => {
        const base = { kind: 'bodyweight' as const, bodyweightKg: 80, measuredAt: '2026-10-15' }
        expect(stepLine({ ...base, ballast: { kind: 'ballast', kg: 10 } }, t, fmt)).toContain('bodyweightBallast|')
        expect(stepLine({ ...base, ballast: { kind: 'ballastRange', minKg: 5, maxKg: 10 } }, t, fmt)).toContain('bodyweightBallastRange|')
        expect(stepLine({ ...base, ballast: { kind: 'bodyweight' } }, t, fmt)).toContain('bodyweightOnly|')
        expect(stepLine({ ...base, ballast: { kind: 'missingBodyweight' } }, t, fmt)).toContain('missingBodyweight|')
    })

    it('handles absolute ballast variants', () => {
        const zero: WeightExplanationStep = { kind: 'absoluteBallast', ballastKg: 0, bodyweightKg: 80, measuredAt: null, totalKg: 80 }
        const noBw: WeightExplanationStep = { kind: 'absoluteBallast', ballastKg: 10, bodyweightKg: null, measuredAt: null, totalKg: null }
        expect(stepLine(zero, t, fmt)).toContain('absoluteBodyweightOnly|')
        expect(stepLine(noBw, t, fmt)).toContain('absoluteBallastNoBodyweight|')
    })
})
