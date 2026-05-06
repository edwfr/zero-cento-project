import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'

vi.mock('next/navigation', async (importOriginal) => {
    const actual = await importOriginal<typeof import('next/navigation')>()
    return {
        ...actual,
        useParams: () => ({ id: 'trainee-1' }),
        useRouter: () => ({ push: vi.fn() }),
    }
})

vi.mock('@/components/ToastNotification', () => ({
    useToast: () => ({ showToast: vi.fn() }),
}))

global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ data: { items: [] } }),
}) as unknown as typeof fetch

describe('TraineeRecordsContent modal exercise field', () => {
    it('renders an input field (AutocompleteSearch) not a native select for exercise', async () => {
        const { default: TraineeRecordsContent } = await import(
            '@/app/trainer/trainees/[id]/records/_content'
        )

        const { container } = render(<TraineeRecordsContent />)

        const addButton = await screen.findByRole('button', { name: /aggiungi massimale/i })
        fireEvent.click(addButton)

        expect(container.querySelector('select')).toBeNull()

        const exerciseInput = screen.getByLabelText(/personalRecords\.exercise/i)
        expect(exerciseInput.tagName).toBe('INPUT')
    }, 15000)
})
