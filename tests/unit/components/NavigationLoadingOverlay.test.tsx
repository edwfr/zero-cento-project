import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import NavigationLoadingOverlay from '@/components/NavigationLoadingOverlay'

describe('NavigationLoadingOverlay', () => {
    it('renders a spinner with role=status', () => {
        render(<NavigationLoadingOverlay />)
        expect(screen.getByRole('status')).toBeInTheDocument()
    })

    it('uses fixed inset overlay class', () => {
        const { container } = render(<NavigationLoadingOverlay />)
        const overlay = container.firstChild as HTMLElement
        expect(overlay.className).toContain('fixed')
        expect(overlay.className).toContain('inset-0')
        expect(overlay.className).toContain('z-50')
    })

    it('renders with label when provided', () => {
        render(<NavigationLoadingOverlay label="Loading page..." />)
        expect(screen.getByText('Loading page...')).toBeInTheDocument()
    })
})
