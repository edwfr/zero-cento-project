import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import ExerciseTypeBadge from '@/components/ExerciseTypeBadge'

describe('ExerciseTypeBadge', () => {
    it('renders the short letter with full label as title/aria-label by default', () => {
        render(<ExerciseTypeBadge type="postural" />)
        const badge = screen.getByText('common:exerciseTypes.postural.short')
        expect(badge).toHaveAttribute('title', 'common:exerciseTypes.postural.label')
        expect(badge).toHaveAttribute('aria-label', 'common:exerciseTypes.postural.label')
        expect(badge.className).toContain('bg-emerald-100')
    })

    it('renders the full label in label variant', () => {
        render(<ExerciseTypeBadge type="fundamental" variant="label" />)
        const badge = screen.getByText('common:exerciseTypes.fundamental.label')
        expect(badge).not.toHaveAttribute('title')
        expect(badge.className).toContain('bg-red-100')
    })

    it('appends custom className', () => {
        render(<ExerciseTypeBadge type="accessory" className="px-2 text-xs" />)
        const badge = screen.getByText('common:exerciseTypes.accessory.short')
        expect(badge.className).toContain('bg-blue-100')
        expect(badge.className).toContain('px-2 text-xs')
    })

    it('renders nothing for an unknown type', () => {
        const { container } = render(<ExerciseTypeBadge type={'unknown' as never} />)
        expect(container.firstChild).toBeNull()
    })
})
