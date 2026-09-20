import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// The page pulls PersonalRecordsExplorer, RPEOneRMTable and SkeletonTable from
// the '@/components' barrel, which drags in MUI and recharts: importing it for
// real costs ~48s under jsdom. Stub the barrel with just what the page uses.
vi.mock('@/components', () => ({
    PersonalRecordsExplorer: () => <div data-testid="records-explorer" />,
    RPEOneRMTable: () => <div data-testid="rpe-table" />,
    SkeletonTable: () => <div data-testid="skeleton-table" />,
}))

// Redeclared on purpose: the global mock in tests/unit/setup.ts returns
// useParams: () => ({}), while this page needs the trainee id.
vi.mock('next/navigation', () => ({
    useParams: () => ({ id: 'trainee-1' }),
    useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn() }),
    usePathname: () => '/trainer/trainees/trainee-1/records',
    useSearchParams: () => new URLSearchParams(),
    redirect: vi.fn(),
}))

vi.mock('@/components/ToastNotification', () => ({
    useToast: () => ({ showToast: vi.fn() }),
}))

import TraineeRecordsContent from '@/app/trainer/trainees/[id]/records/_content'

const trainee = { id: 'trainee-1', firstName: 'Mario', lastName: 'Rossi' }
const exercises = [
    { id: 'ex-1', name: 'Panca Piana', type: 'fundamental' },
    { id: 'ex-2', name: 'Squat', type: 'fundamental' },
]

function mockFetchByUrl() {
    return vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input)
        if (url.startsWith('/api/users/')) {
            return { ok: true, json: async () => ({ data: { user: trainee } }) } as Response
        }
        if (url.startsWith('/api/personal-records')) {
            return { ok: true, json: async () => ({ data: { items: [] } }) } as Response
        }
        if (url.startsWith('/api/exercises')) {
            return { ok: true, json: async () => ({ data: { items: exercises } }) } as Response
        }
        throw new Error(`Unexpected fetch call: ${url}`)
    })
}

describe('TraineeRecordsContent modal exercise field', () => {
    const originalFetch = global.fetch

    beforeEach(() => {
        global.fetch = mockFetchByUrl() as unknown as typeof fetch
    })

    afterEach(() => {
        global.fetch = originalFetch
        vi.clearAllMocks()
    })

    it('renders an input field (AutocompleteSearch) not a native select for exercise', async () => {
        const { container } = render(<TraineeRecordsContent />)

        const addButton = await screen.findByRole('button', { name: /aggiungi massimale/i })
        fireEvent.click(addButton)

        expect(container.querySelector('select')).toBeNull()

        const exerciseInput = screen.getByRole('combobox')
        expect(exerciseInput.tagName).toBe('INPUT')
    })

    it('loads the trainee and the exercise list on mount', async () => {
        render(<TraineeRecordsContent />)

        await waitFor(() => expect(screen.getByText('Mario Rossi')).toBeInTheDocument())

        expect(global.fetch).toHaveBeenCalledWith('/api/users/trainee-1')
        expect(global.fetch).toHaveBeenCalledWith('/api/personal-records?traineeId=trainee-1')
        expect(global.fetch).toHaveBeenCalledWith('/api/exercises?limit=500')
    })
})
