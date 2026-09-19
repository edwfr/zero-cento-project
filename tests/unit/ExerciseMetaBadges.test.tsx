import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import ExerciseMetaBadges from '@/components/ExerciseMetaBadges'

describe('ExerciseMetaBadges', () => {
    it.each([
        ['fundamental', 'bg-red-100'],
        ['accessory', 'bg-blue-100'],
        ['postural', 'bg-emerald-100'],
    ] as const)('renders %s type badge with its color', (type, colorClass) => {
        render(<ExerciseMetaBadges exerciseType={type} />)
        const badge = screen.getByText(`common:exerciseTypes.${type}.label`)
        expect(badge.className).toContain(colorClass)
    })

    it('renders nothing without badges', () => {
        const { container } = render(<ExerciseMetaBadges />)
        expect(container.firstChild).toBeNull()
    })
})
