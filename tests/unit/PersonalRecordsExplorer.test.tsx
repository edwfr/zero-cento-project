import { fireEvent, render, screen } from '@testing-library/react'
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
    it('renders standard action icon variants for edit and delete', () => {
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

        editButtons.forEach((button) => {
            expect(button).toHaveClass('bg-green-600')
            expect(button).not.toHaveClass('text-blue-600')
        })

        deleteButtons.forEach((button) => {
            expect(button).toHaveClass('bg-red-600')
            expect(button).not.toHaveClass('text-red-600')
        })
    })
})
