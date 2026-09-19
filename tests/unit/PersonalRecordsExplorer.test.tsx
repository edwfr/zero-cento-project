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
    it('renders edit action buttons and delete drop zone (no delete icon buttons)', () => {
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
        const deleteButtons = screen.queryAllByTitle('common.delete')
        const dropZoneLabel = screen.getByText('common.personalRecordsExplorer.dragToDelete')

        expect(editButtons).toHaveLength(2)
        expect(deleteButtons).toHaveLength(0)
        expect(dropZoneLabel).toBeInTheDocument()

        editButtons.forEach((button) => {
            expect(button).toHaveClass('bg-green-600')
            expect(button).not.toHaveClass('text-blue-600')
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

    it('calls onDeleteRecord when dropping a dragged row on trash zone', () => {
        const onEdit = vi.fn()
        const onDelete = vi.fn()

        render(
            <PersonalRecordsExplorer
                records={mockRecords}
                onEditRecord={onEdit}
                onDeleteRecord={onDelete}
            />
        )

        const firstRow = screen
            .getAllByRole('row')
            .find((row) => row.getAttribute('draggable') === 'true')
        const dropZone = screen.getByText('common.personalRecordsExplorer.dragToDelete').closest('div')

        expect(firstRow).toBeTruthy()
        expect(dropZone).toBeTruthy()

        fireEvent.dragStart(firstRow as HTMLElement)
        fireEvent.dragOver(dropZone as HTMLElement)
        fireEvent.drop(dropZone as HTMLElement)

        expect(onDelete).toHaveBeenCalledTimes(1)
        expect(onDelete).toHaveBeenCalledWith(
            expect.objectContaining({ id: 'rec-1' })
        )
    })
})
