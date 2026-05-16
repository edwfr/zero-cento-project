import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import NewProgramContent from '@/app/trainer/programs/new/NewProgramContent'

const routerPush = vi.fn()

vi.mock('next/navigation', () => ({
    useRouter: () => ({ push: routerPush }),
}))

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string) => key,
        i18n: { language: 'en', changeLanguage: vi.fn() },
    }),
    Trans: ({ i18nKey, values }: { i18nKey: string; values?: Record<string, string> }) => (
        <>{`${i18nKey}:${values?.title ?? ''}`}</>
    ),
    initReactI18next: { type: '3rdParty', init: vi.fn() },
}))

const trainees = [
    { id: 't-1', firstName: 'Mario', lastName: 'Atleta' },
    { id: 't-2', firstName: 'Luigi', lastName: 'Plumber' },
]

const cloneSource = {
    id: '00000000-0000-0000-0000-000000000111',
    title: 'Block A',
    traineeId: 't-2',
    workoutsPerWeek: 4,
    isSbdProgram: true,
}

describe('NewProgramContent - clone source prefill', () => {
    beforeEach(() => {
        routerPush.mockReset()
        global.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ data: { program: { id: 'new-1' } } }),
        }) as any
    })

    it('prefills trainee, isSbdProgram, and workoutsPerWeek with lock', () => {
        render(
            <NewProgramContent
                trainees={trainees}
                initialTraineeId="t-1"
                cloneSource={cloneSource}
                cloneError={null}
            />
        )

        const traineeSelect = screen.getByRole('combobox') as HTMLSelectElement
        expect(traineeSelect.value).toBe('t-2')

        const sbdCheckbox = screen.getByRole('checkbox') as HTMLInputElement
        expect(sbdCheckbox.checked).toBe(true)

        const valueFourInputs = screen.getAllByDisplayValue('4') as HTMLInputElement[]
        const lockedWorkoutsInput = valueFourInputs.find((input) => input.disabled)
        expect(lockedWorkoutsInput).toBeDefined()

        const workoutsChipTwo = screen.getByRole('button', { name: '2' })
        expect(workoutsChipTwo).toBeDisabled()
    })

    it('renders clone banner with source title and start-blank link', () => {
        render(
            <NewProgramContent
                trainees={trainees}
                initialTraineeId="t-1"
                cloneSource={cloneSource}
                cloneError={null}
                startBlankHref="/trainer/programs/new?traineeId=t-2"
            />
        )

        expect(screen.getByText('trainer:programs.cloneFromBanner:Block A')).toBeInTheDocument()

        const resetLink = screen.getByRole('link', { name: 'programs.cloneCancelLink' })
        expect(resetLink).toHaveAttribute('href', '/trainer/programs/new?traineeId=t-2')
    })

    it('includes cloneFromProgramId in POST body on submit', async () => {
        render(
            <NewProgramContent
                trainees={trainees}
                initialTraineeId="t-1"
                cloneSource={cloneSource}
                cloneError={null}
            />
        )

        fireEvent.change(screen.getByPlaceholderText('programs.programNamePlaceholder'), {
            target: { value: 'Block B' },
        })

        fireEvent.click(screen.getByRole('button', { name: 'programs.nextConfigureExercises' }))

        await waitFor(() => {
            expect(global.fetch).toHaveBeenCalledTimes(1)
        })

        const requestOptions = (global.fetch as any).mock.calls[0][1]
        const body = JSON.parse(requestOptions.body)

        expect(body.cloneFromProgramId).toBe('00000000-0000-0000-0000-000000000111')
        expect(body.workoutsPerWeek).toBe(4)
        expect(body.isSbdProgram).toBe(true)

        await waitFor(() => {
            expect(routerPush).toHaveBeenCalledWith('/trainer/programs/new-1/edit')
        })
    })

    it('renders clone source error banner when cloneError is set', () => {
        render(
            <NewProgramContent
                trainees={trainees}
                initialTraineeId=""
                cloneSource={null}
                cloneError="notFound"
            />
        )

        expect(screen.getByText('programs.cloneSourceErrorNotFound')).toBeInTheDocument()
    })
})
