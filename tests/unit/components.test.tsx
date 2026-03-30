import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import StatCard from '@/components/StatCard'
import ProgressBar from '@/components/ProgressBar'
import LoadingSpinner from '@/components/LoadingSpinner'
import MovementPatternTag from '@/components/MovementPatternTag'
import RoleGuard from '@/components/RoleGuard'

// ─── StatCard ─────────────────────────────────────────────────────────────────

describe('StatCard', () => {
    it('renders title and value', () => {
        render(<StatCard title="Totale Atleti" value={42} />)
        expect(screen.getByText('Totale Atleti')).toBeInTheDocument()
        expect(screen.getByText('42')).toBeInTheDocument()
    })

    it('renders subtitle when provided', () => {
        render(<StatCard title="Programmi" value={10} subtitle="Attivi questo mese" />)
        expect(screen.getByText('Attivi questo mese')).toBeInTheDocument()
    })

    it('renders icon when provided', () => {
        render(<StatCard title="Test" value={1} icon="🏋️" />)
        expect(screen.getByText('🏋️')).toBeInTheDocument()
    })

    it('renders trend indicator when provided', () => {
        render(
            <StatCard
                title="Volume"
                value="12.5t"
                trend={{ value: 5, label: 'rispetto la scorsa settimana', isPositive: true }}
            />
        )
        expect(screen.getAllByText(/5/).length).toBeGreaterThan(0)
    })

    it('calls onClick when card is clicked', () => {
        const handleClick = vi.fn()
        render(<StatCard title="Test" value={0} onClick={handleClick} />)
        fireEvent.click(screen.getByText('Test'))
        expect(handleClick).toHaveBeenCalledTimes(1)
    })

    it('renders string value', () => {
        render(<StatCard title="Volume" value="15,000 kg" />)
        expect(screen.getByText('15,000 kg')).toBeInTheDocument()
    })
})

// ─── ProgressBar ──────────────────────────────────────────────────────────────

describe('ProgressBar', () => {
    it('renders with correct percentage', () => {
        render(<ProgressBar current={3} total={10} />)
        expect(screen.getByText('30%')).toBeInTheDocument()
    })

    it('renders 0% when total is 0', () => {
        render(<ProgressBar current={0} total={0} />)
        expect(screen.getByText('0%')).toBeInTheDocument()
    })

    it('renders 100% when current equals total', () => {
        render(<ProgressBar current={5} total={5} />)
        expect(screen.getByText('100%')).toBeInTheDocument()
    })

    it('renders label when provided', () => {
        render(<ProgressBar current={2} total={8} label="Settimane completate" />)
        expect(screen.getByText('Settimane completate')).toBeInTheDocument()
    })

    it('hides percentage when showPercentage is false', () => {
        render(<ProgressBar current={3} total={10} showPercentage={false} />)
        expect(screen.queryByText('30%')).not.toBeInTheDocument()
    })

    it('has correct aria attributes', () => {
        render(<ProgressBar current={4} total={8} />)
        const bar = screen.getByRole('progressbar')
        expect(bar).toHaveAttribute('aria-valuenow', '4')
        expect(bar).toHaveAttribute('aria-valuemax', '8')
    })
})

// ─── LoadingSpinner ───────────────────────────────────────────────────────────

describe('LoadingSpinner', () => {
    it('renders without crashing', () => {
        const { container } = render(<LoadingSpinner />)
        expect(container.firstChild).toBeInTheDocument()
    })

    it('renders label when provided', () => {
        render(<LoadingSpinner label="Caricamento..." />)
        expect(screen.getByText('Caricamento...')).toBeInTheDocument()
    })

    it('renders without label when not provided', () => {
        render(<LoadingSpinner />)
        expect(screen.queryByText('Caricamento...')).not.toBeInTheDocument()
    })
})

// ─── MovementPatternTag ───────────────────────────────────────────────────────

describe('MovementPatternTag', () => {
    it('renders pattern name', () => {
        render(<MovementPatternTag name="Spinta Orizzontale" />)
        expect(screen.getByText('Spinta Orizzontale')).toBeInTheDocument()
    })

    it('calls onClick when clicked (if provided)', () => {
        const handleClick = vi.fn()
        render(<MovementPatternTag name="Tirata Verticale" onClick={handleClick} />)
        fireEvent.click(screen.getByText('Tirata Verticale'))
        expect(handleClick).toHaveBeenCalledTimes(1)
    })

    it('renders with custom color prop without crashing', () => {
        const { container } = render(
            <MovementPatternTag name="Squat Pattern" color="#3B82F6" />
        )
        expect(container.firstChild).toBeInTheDocument()
    })
})

// ─── RoleGuard ────────────────────────────────────────────────────────────────

describe('RoleGuard', () => {
    it('renders children when role is allowed', () => {
        render(
            <RoleGuard allowedRoles={['trainer']} userRole="trainer">
                <p>Contenuto trainer</p>
            </RoleGuard>
        )
        expect(screen.getByText('Contenuto trainer')).toBeInTheDocument()
    })

    it('renders fallback when role is not allowed and fallback is provided', () => {
        render(
            <RoleGuard
                allowedRoles={['admin']}
                userRole="trainee"
                fallback={<p>Accesso negato</p>}
            >
                <p>Contenuto admin</p>
            </RoleGuard>
        )
        expect(screen.getByText('Accesso negato')).toBeInTheDocument()
        expect(screen.queryByText('Contenuto admin')).not.toBeInTheDocument()
    })

    it('renders nothing (not fallback, not children) when no fallback + unauthorized', () => {
        render(
            <RoleGuard allowedRoles={['admin']} userRole="trainee">
                <p>Admin content</p>
            </RoleGuard>
        )
        expect(screen.queryByText('Admin content')).not.toBeInTheDocument()
    })
})
