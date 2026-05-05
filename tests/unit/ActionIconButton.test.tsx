import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ActionIconButton, InlineActions } from '@/components/ActionIconButton'

vi.mock('next/link', () => ({
    default: ({
        href,
        children,
        ...props
    }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
        <a href={href} {...props}>
            {children}
        </a>
    ),
}))

describe('ActionIconButton', () => {
    it('renders as a link when href is provided', () => {
        render(<ActionIconButton variant="view" label="Visualizza" href="/programs/1" />)
        const el = screen.getByRole('link', { name: 'Visualizza' })
        expect(el).toBeInTheDocument()
        expect(el).toHaveAttribute('href', '/programs/1')
    })

    it('renders as a button when onClick is provided', () => {
        render(<ActionIconButton variant="delete" label="Elimina" onClick={vi.fn()} />)
        expect(screen.getByRole('button', { name: 'Elimina' })).toBeInTheDocument()
    })

    it('calls onClick when button is clicked', () => {
        const handleClick = vi.fn()
        render(<ActionIconButton variant="delete" label="Elimina" onClick={handleClick} />)
        fireEvent.click(screen.getByRole('button', { name: 'Elimina' }))
        expect(handleClick).toHaveBeenCalledTimes(1)
    })

    it('renders as disabled button when disabled is true (even with href)', () => {
        render(<ActionIconButton variant="view-test" label="Test" href="/tests" disabled />)
        const el = screen.getByRole('button', { name: 'Test' })
        expect(el).toBeDisabled()
    })

    it('applies correct title attribute', () => {
        render(<ActionIconButton variant="edit" label="Modifica" onClick={vi.fn()} />)
        expect(screen.getByTitle('Modifica')).toBeInTheDocument()
    })

    it('renders as disabled button when isLoading is true', () => {
        render(<ActionIconButton variant="delete" label="Elimina" onClick={vi.fn()} isLoading />)
        expect(screen.getByRole('button', { name: 'Elimina' })).toBeDisabled()
    })

    it('renders activate variant as a button', () => {
        render(<ActionIconButton variant="activate" label="Attiva" onClick={vi.fn()} />)
        expect(screen.getByRole('button', { name: 'Attiva' })).toBeInTheDocument()
    })

    it('renders deactivate variant as a button', () => {
        render(<ActionIconButton variant="deactivate" label="Disattiva" onClick={vi.fn()} />)
        expect(screen.getByRole('button', { name: 'Disattiva' })).toBeInTheDocument()
    })
})

describe('InlineActions', () => {
    it('renders children', () => {
        render(
            <InlineActions>
                <span>child1</span>
                <span>child2</span>
            </InlineActions>
        )
        expect(screen.getByText('child1')).toBeInTheDocument()
        expect(screen.getByText('child2')).toBeInTheDocument()
    })
})
