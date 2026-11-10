import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import ProgramTraineeTable, {
    type ProgramTraineeTableProgram,
    type ProgramTraineeTableProps,
} from '@/components/ProgramTraineeTable'

const program = (id: string, status: ProgramTraineeTableProgram['status']): ProgramTraineeTableProgram => ({
    id,
    title: `Program ${id}`,
    status,
    durationWeeks: 4,
    workoutsPerWeek: 3,
    startDate: status === 'draft' ? null : '2026-10-01T00:00:00.000Z',
    trainee: { firstName: 'Mario', lastName: 'Rossi' },
})

const programs = [program('draft-1', 'draft'), program('active-1', 'active'), program('completed-1', 'completed')]

function renderTable(overrides: Partial<ProgramTraineeTableProps> = {}) {
    const props: ProgramTraineeTableProps = {
        programs,
        loading: false,
        error: null,
        activeTab: 'active',
        statusCounts: { draft: 1, active: 1, completed: 1 },
        searchTerm: '',
        appliedSearchTerm: '',
        isRefreshing: false,
        currentPage: 1,
        totalPages: 1,
        totalItems: programs.length,
        visiblePages: [1],
        newProgramHref: '/trainer/programs/new',
        emptyStateCtaHref: '/trainer/programs/new',
        onSearchChange: vi.fn(),
        onSearchSubmit: vi.fn(),
        onTabChange: vi.fn(),
        onPageChange: vi.fn(),
        onDeleteProgram: vi.fn(),
        getEditHref: (p) => `/edit/${p.id}`,
        getViewHref: (p) => `/view/${p.id}`,
        getCloneHref: (p) => `/clone/${p.id}`,
        getViewTestsHref: (p) => `/tests/${p.id}`,
        ...overrides,
    }
    return render(<ProgramTraineeTable {...props} />)
}

const exportButtons = () => screen.queryAllByRole('button', { name: 'programs.exportPdf' })

describe('ProgramTraineeTable — export PDF action', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('shows the action on active and completed rows only', () => {
        renderTable({ onExportPdf: vi.fn() })

        expect(exportButtons()).toHaveLength(2)
        const rowOf = (title: string) => screen.getByText(title).closest('tr') as HTMLElement
        expect(within(rowOf('Program draft-1')).queryByRole('button', { name: 'programs.exportPdf' })).toBeNull()
        expect(within(rowOf('Program active-1')).getByRole('button', { name: 'programs.exportPdf' })).toBeInTheDocument()
        expect(within(rowOf('Program completed-1')).getByRole('button', { name: 'programs.exportPdf' })).toBeInTheDocument()
    })

    it('passes the clicked program to onExportPdf', () => {
        const onExportPdf = vi.fn()
        renderTable({ onExportPdf })

        fireEvent.click(exportButtons()[0])

        expect(onExportPdf).toHaveBeenCalledWith(programs[1])
    })

    it('disables only the row being exported', () => {
        renderTable({ onExportPdf: vi.fn(), exportingProgramId: 'active-1' })

        const [activeButton, completedButton] = exportButtons()
        expect(activeButton).toBeDisabled()
        expect(completedButton).toBeEnabled()
    })

    it('renders no export action without onExportPdf', () => {
        renderTable()

        expect(exportButtons()).toHaveLength(0)
    })
})
