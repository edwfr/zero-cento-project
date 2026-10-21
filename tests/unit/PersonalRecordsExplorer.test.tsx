import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import PersonalRecordsExplorer from '@/components/PersonalRecordsExplorer'

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string) => key,
        i18n: { language: 'it' },
    }),
}))

vi.mock('recharts', () => ({
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    LineChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    Line: () => null,
    CartesianGrid: () => null,
    XAxis: () => null,
    YAxis: () => null,
    Tooltip: () => null,
    Legend: () => null,
}))

const mockRecords = [
    {
        id: 'rec-1',
        weight: 100,
        reps: 5,
        recordDate: '2026-01-15',
        notes: null,
        exercise: { id: 'ex-1', name: 'Squat', type: 'fundamental' },
    },
    {
        id: 'rec-2',
        weight: 95,
        reps: 5,
        recordDate: '2026-01-10',
        notes: null,
        exercise: { id: 'ex-1', name: 'Squat', type: 'fundamental' },
    },
]

describe('PersonalRecordsExplorer action buttons', () => {
    it('renders inline edit and delete buttons on every row, no drag and drop', () => {
        const onEdit = vi.fn()
        const onDelete = vi.fn()

        render(
            <PersonalRecordsExplorer
                records={mockRecords}
                onEditRecord={onEdit}
                onDeleteRecord={onDelete}
            />
        )

        fireEvent.click(screen.getByLabelText('common.personalRecordsExplorer.expand'))

        const editButtons = screen.getAllByTitle('common.edit')
        const deleteButtons = screen.getAllByTitle('common.delete')

        expect(editButtons).toHaveLength(2)
        expect(deleteButtons).toHaveLength(2)
        expect(screen.getAllByRole('row').some((row) => row.getAttribute('draggable') === 'true')).toBe(false)

        editButtons.forEach((button) => {
            expect(button).toHaveClass('bg-green-600')
            expect(button).not.toHaveClass('text-blue-600')
        })
        deleteButtons.forEach((button) => {
            expect(button).toHaveClass('bg-red-600')
        })
    })

    it('orders exercise groups fundamental, accessory, postural before alphabetical', () => {
        const onEdit = vi.fn()
        const onDelete = vi.fn()

        const typedRecords = [
            {
                id: 'rec-postural',
                weight: 0,
                reps: 20,
                recordDate: '2026-01-12',
                notes: null,
                exercise: { id: 'ex-postural', name: 'Addome Plank', type: 'postural' },
            },
            {
                id: 'rec-accessory',
                weight: 60,
                reps: 8,
                recordDate: '2026-01-12',
                notes: null,
                exercise: { id: 'ex-accessory', name: 'Bench', type: 'accessory' },
            },
            {
                id: 'rec-fundamental',
                weight: 140,
                reps: 3,
                recordDate: '2026-01-12',
                notes: null,
                exercise: { id: 'ex-fundamental', name: 'Squat', type: 'fundamental' },
            },
        ]

        render(
            <PersonalRecordsExplorer
                records={typedRecords}
                onEditRecord={onEdit}
                onDeleteRecord={onDelete}
            />
        )

        const names = within(screen.getByRole('table'))
            .getAllByText(/^(Squat|Bench|Addome Plank)$/)
            .map((el) => el.textContent)
        expect(names).toEqual(['Squat', 'Bench', 'Addome Plank'])
    })

    it('calls onDeleteRecord with the row record when clicking its delete button', () => {
        const onEdit = vi.fn()
        const onDelete = vi.fn()

        render(
            <PersonalRecordsExplorer
                records={mockRecords}
                onEditRecord={onEdit}
                onDeleteRecord={onDelete}
            />
        )

        fireEvent.click(screen.getByLabelText('common.personalRecordsExplorer.expand'))

        const [latestDelete, historyDelete] = screen.getAllByTitle('common.delete')

        fireEvent.click(latestDelete)
        expect(onDelete).toHaveBeenLastCalledWith(expect.objectContaining({ id: 'rec-1' }))

        fireEvent.click(historyDelete)
        expect(onDelete).toHaveBeenLastCalledWith(expect.objectContaining({ id: 'rec-2' }))
        expect(onDelete).toHaveBeenCalledTimes(2)
    })
})
