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
        <>{`${i18nKey}:${values?.title ?? values?.name ?? ''}`}</>
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
        }) as unknown as typeof fetch
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

        const requestOptions = vi.mocked(global.fetch).mock.calls[0][1] as RequestInit
        const body = JSON.parse(String(requestOptions.body))

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

const templateSource = { id: 'tpl-1', name: 'Push Pull', workoutsPerWeek: 3 }
const templates = [
    { id: 'tpl-1', name: 'Push Pull', workoutsPerWeek: 3, exerciseCount: 12 },
    { id: 'tpl-2', name: 'Full Body', workoutsPerWeek: 2, exerciseCount: 8 },
]

describe('NewProgramContent - template start', () => {
    beforeEach(() => {
        routerPush.mockReset()
        global.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ data: { program: { id: 'new-1' } } }),
        }) as unknown as typeof fetch
    })

    it('shows chooser and hides the form initially', () => {
        render(<NewProgramContent trainees={trainees} initialTraineeId="t-1" templates={templates} />)
        expect(screen.getByRole('button', { name: /templates.fromScratch/ })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /templates.fromLibrary/ })).toBeInTheDocument()
        expect(screen.queryByPlaceholderText('programs.programNamePlaceholder')).not.toBeInTheDocument()
    })

    it('from scratch shows the form and submits without templateId', async () => {
        render(<NewProgramContent trainees={trainees} initialTraineeId="t-1" templates={templates} />)
        fireEvent.click(screen.getByRole('button', { name: /templates.fromScratch/ }))
        fireEvent.change(screen.getByPlaceholderText('programs.programNamePlaceholder'), {
            target: { value: 'P' },
        })
        fireEvent.click(screen.getByRole('button', { name: 'programs.nextConfigureExercises' }))
        await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1))
        const body = JSON.parse(String((vi.mocked(global.fetch).mock.calls[0][1] as RequestInit).body))
        expect(body.templateId).toBeUndefined()
    })

    it('lists templates from library and navigates on select preserving traineeId', () => {
        render(
            <NewProgramContent
                trainees={trainees}
                initialTraineeId="t-1"
                templates={templates}
                startBlankHref="/trainer/programs/new?traineeId=t-2"
            />
        )
        fireEvent.click(screen.getByRole('button', { name: /templates.fromLibrary/ }))
        expect(screen.getByText('Full Body')).toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: /Push Pull/ }))
        expect(routerPush).toHaveBeenCalledWith('/trainer/programs/new?templateId=tpl-1&traineeId=t-2')
    })

    it('shows CTA when there are no templates', () => {
        render(<NewProgramContent trainees={trainees} initialTraineeId="t-1" templates={[]} />)
        fireEvent.click(screen.getByRole('button', { name: /templates.fromLibrary/ }))
        expect(screen.getByRole('link', { name: 'templates.noTemplatesCta' })).toHaveAttribute(
            'href',
            '/trainer/templates/new'
        )
    })

    it('templateSource skips chooser, locks workouts and submits templateId', async () => {
        render(
            <NewProgramContent
                trainees={trainees}
                initialTraineeId="t-1"
                templateSource={templateSource}
                startBlankHref="/trainer/programs/new"
            />
        )
        expect(screen.getByText('trainer:templates.bannerFromTemplate:Push Pull')).toBeInTheDocument()
        expect(screen.getByRole('link', { name: 'templates.startBlankLink' })).toHaveAttribute(
            'href',
            '/trainer/programs/new'
        )
        const locked = screen.getAllByDisplayValue('3').find((i) => (i as HTMLInputElement).readOnly)
        expect(locked).toBeDefined()
        expect(screen.getByRole('button', { name: '2' })).toBeDisabled()

        fireEvent.change(screen.getByPlaceholderText('programs.programNamePlaceholder'), {
            target: { value: 'P' },
        })
        fireEvent.click(screen.getByRole('button', { name: 'programs.nextConfigureExercises' }))
        await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1))
        const body = JSON.parse(String((vi.mocked(global.fetch).mock.calls[0][1] as RequestInit).body))
        expect(body.templateId).toBe('tpl-1')
        expect(body.workoutsPerWeek).toBe(3)
        expect(body.cloneFromProgramId).toBeUndefined()
    })

    // Selecting a template is a same-route navigation: the component is not remounted,
    // it only receives the new `templateSource` prop.
    it('templateSource arriving after mount leaves the chooser and uses the template workouts', async () => {
        const twoWorkoutTemplate = { ...templateSource, workoutsPerWeek: 2 }
        const { rerender } = render(
            <NewProgramContent trainees={trainees} initialTraineeId="t-1" templates={templates} />
        )
        fireEvent.click(screen.getByRole('button', { name: /templates.fromLibrary/ }))

        rerender(
            <NewProgramContent
                trainees={trainees}
                initialTraineeId="t-1"
                templates={templates}
                templateSource={twoWorkoutTemplate}
            />
        )

        expect(screen.queryByRole('button', { name: /templates.fromScratch/ })).not.toBeInTheDocument()
        const locked = screen.getAllByDisplayValue('2').find((i) => (i as HTMLInputElement).readOnly)
        expect(locked).toBeDefined()

        fireEvent.change(screen.getByPlaceholderText('programs.programNamePlaceholder'), {
            target: { value: 'P' },
        })
        fireEvent.click(screen.getByRole('button', { name: 'programs.nextConfigureExercises' }))
        await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1))
        const body = JSON.parse(String((vi.mocked(global.fetch).mock.calls[0][1] as RequestInit).body))
        expect(body.templateId).toBe('tpl-1')
        expect(body.workoutsPerWeek).toBe(2)
    })

    it('cloneSource skips chooser and sends no templateId', async () => {
        render(<NewProgramContent trainees={trainees} initialTraineeId="t-1" cloneSource={cloneSource} templates={templates} />)
        expect(screen.queryByRole('button', { name: /templates.fromScratch/ })).not.toBeInTheDocument()
        fireEvent.change(screen.getByPlaceholderText('programs.programNamePlaceholder'), {
            target: { value: 'P' },
        })
        fireEvent.click(screen.getByRole('button', { name: 'programs.nextConfigureExercises' }))
        await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1))
        const body = JSON.parse(String((vi.mocked(global.fetch).mock.calls[0][1] as RequestInit).body))
        expect(body.templateId).toBeUndefined()
    })

    it('templateError notFound shows message and chooser stays usable', () => {
        render(<NewProgramContent trainees={trainees} initialTraineeId="t-1" templateError="notFound" templates={templates} />)
        expect(screen.getByText('templates.templateErrorNotFound')).toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: /templates.fromScratch/ }))
        expect(screen.getByPlaceholderText('programs.programNamePlaceholder')).toBeInTheDocument()
    })
})
