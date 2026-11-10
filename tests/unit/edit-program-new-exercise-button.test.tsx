import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'

vi.mock('next/navigation', () => ({
    useParams: () => ({ id: 'prog-1' }),
    useSearchParams: () => new URLSearchParams(),
    useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn(), back: vi.fn() }),
}))

vi.mock('@/components/ToastNotification', () => ({
    useToast: () => ({ showToast: vi.fn() }),
}))

import EditProgramContent from '@/app/trainer/programs/[id]/edit/_content'

const jsonResponse = (data: unknown, ok = true) => ({ ok, json: async () => data })

const program = {
    id: 'prog-1',
    title: 'Forza',
    status: 'active',
    startDate: '2026-10-12T00:00:00.000Z',
    isSbdProgram: false,
    trainee: { id: 'trainee-1', firstName: 'Mario', lastName: 'Rossi' },
    trainerId: 'trainer-1',
    durationWeeks: 1,
    workoutsPerWeek: 1,
    weeks: [],
    skeleton: [],
}

describe('EditProgramContent new exercise button', () => {
    beforeEach(() => {
        vi.stubGlobal(
            'fetch',
            vi.fn(async (url: string) => {
                if (url.startsWith('/api/programs/prog-1')) return jsonResponse({ data: { program } })
                if (url === '/api/movement-patterns') return jsonResponse({ data: { items: [] } })
                if (url.startsWith('/api/exercises'))
                    return jsonResponse({ data: { items: [], pagination: { hasMore: false } } })
                if (url.startsWith('/api/personal-records')) return jsonResponse({ data: { items: [] } })
                return jsonResponse({ data: {} })
            })
        )
    })

    afterEach(() => {
        vi.unstubAllGlobals()
    })

    it('shows the floating New exercise button when editable', async () => {
        render(<EditProgramContent />)
        expect(
            await screen.findByRole('button', { name: 'editProgram.floatingNewExerciseButton' })
        ).toBeInTheDocument()
    })

    it('hides the floating New exercise button on a read-only program', async () => {
        render(<EditProgramContent readOnly />)
        // Wait for the page to finish loading: the charts button renders in read-only mode
        await screen.findByRole('button', { name: 'editProgram.floatingChartsButton' })
        expect(
            screen.queryByRole('button', { name: 'editProgram.floatingNewExerciseButton' })
        ).not.toBeInTheDocument()
    })
})
