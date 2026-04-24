'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Trans, useTranslation } from 'react-i18next'
import { getApiErrorMessage } from '@/lib/api-error'
import Link from 'next/link'
import LoadingSpinner from '@/components/LoadingSpinner'
import { BarChart3, ArrowLeft } from 'lucide-react'
import { Input } from '@/components/Input'
import { FormLabel } from '@/components/FormLabel'

interface Trainee {
    id: string
    firstName: string
    lastName: string
}

interface NewProgramContentProps {
    trainees: Trainee[]
    initialTraineeId: string
    backContext: 'trainee' | 'programs'
}

export default function NewProgramContent({
    trainees,
    initialTraineeId,
    backContext,
}: NewProgramContentProps) {
    const router = useRouter()
    const { t } = useTranslation(['trainer', 'common', 'navigation'])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    // Form state
    const [title, setTitle] = useState('')
    const [traineeId, setTraineeId] = useState(initialTraineeId)
    const [isSbdProgram, setIsSbdProgram] = useState(false)
    const [durationWeeks, setDurationWeeks] = useState(4)
    const [workoutsPerWeek, setWorkoutsPerWeek] = useState(3)
    const backHref = backContext === 'trainee' && traineeId
        ? `/trainer/trainees/${traineeId}`
        : '/trainer/programs'
    const backLabel = backContext === 'trainee'
        ? t('navigation:breadcrumbs.backToAthleteProfile')
        : t('navigation:breadcrumbs.backToPrograms')

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError(null)

        if (!title.trim()) {
            setError(t('programs.programNameRequired'))
            return
        }

        if (!traineeId) {
            setError(t('programs.selectTraineeRequired'))
            return
        }

        if (durationWeeks < 1 || durationWeeks > 52) {
            setError(t('programs.durationWeeksRangeError'))
            return
        }

        if (workoutsPerWeek < 1 || workoutsPerWeek > 7) {
            setError(t('programs.workoutsPerWeekRangeError'))
            return
        }

        try {
            setLoading(true)

            const res = await fetch('/api/programs', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title,
                    traineeId,
                    isSbdProgram,
                    durationWeeks,
                    workoutsPerWeek,
                }),
            })

            const data = await res.json()

            if (!res.ok) {
                throw new Error(getApiErrorMessage(data, t('programs.createError'), t))
            }

            router.push(`/trainer/programs/${data.data.program.id}/edit`)
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : t('programs.createError'))
            setLoading(false)
        }
    }

    if (trainees.length === 0 && !error) {
        return (
            <div className="flex items-center justify-center py-16">
                <div className="bg-white rounded-lg shadow-md p-8 max-w-md text-center">
                    <div className="text-5xl mb-4">👥</div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">
                        {t('programs.noAvailableTraineesTitle')}
                    </h2>
                    <p className="text-gray-600 mb-6">
                        {t('programs.noAvailableTraineesDescription')}
                    </p>
                    <Link
                        href="/trainer/trainees/new"
                        className="inline-block bg-brand-primary hover:bg-brand-primary-hover text-white font-semibold px-6 py-3 rounded-lg transition-colors"
                    >
                        {t('athletes.newAthlete')}
                    </Link>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gray-50">
            <div className="max-w-[1700px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="mb-8">
                <div className="flex items-center justify-center gap-4 mb-4">
                    <div className="flex items-center">
                        <div className="w-10 h-10 bg-brand-primary text-white rounded-full flex items-center justify-center font-bold">
                            1
                        </div>
                        <span className="ml-2 font-semibold text-gray-900">{t('editProgram.stepSetup')}</span>
                    </div>
                    <div className="w-16 h-1 bg-brand-primary"></div>
                    <div className="flex items-center">
                        <div className="w-10 h-10 bg-gray-300 text-gray-600 rounded-full flex items-center justify-center font-bold">
                            2
                        </div>
                        <span className="ml-2 text-gray-500">{t('editProgram.stepStructure')}</span>
                    </div>
                    <div className="w-16 h-1 bg-gray-300"></div>
                    <div className="flex items-center">
                        <div className="w-10 h-10 bg-gray-300 text-gray-600 rounded-full flex items-center justify-center font-bold">
                            3
                        </div>
                        <span className="ml-2 text-gray-500">{t('editProgram.stepExercises')}</span>
                    </div>
                    <div className="w-16 h-1 bg-gray-300"></div>
                    <div className="flex items-center">
                        <div className="w-10 h-10 bg-gray-300 text-gray-600 rounded-full flex items-center justify-center font-bold">
                            4
                        </div>
                        <span className="ml-2 text-gray-500">{t('editProgram.stepReview')}</span>
                    </div>
                    <div className="w-16 h-1 bg-gray-300"></div>
                    <div className="flex items-center">
                        <div className="w-10 h-10 bg-gray-300 text-gray-600 rounded-full flex items-center justify-center font-bold">
                            5
                        </div>
                        <span className="ml-2 text-gray-500">{t('editProgram.stepPublish')}</span>
                    </div>
                </div>
            </div>

            <div className="max-w-3xl mx-auto">
            <div className="mb-8">
                <Link
                    href={backHref}
                    className="text-brand-primary hover:text-brand-primary/80 text-sm font-semibold mb-4 inline-flex items-center gap-1"
                >
                    <ArrowLeft className="w-4 h-4" />
                    {backLabel}
                </Link>
                <h1 className="text-3xl font-bold text-gray-900">{t('programs.newProgramSetupTitle')}</h1>
                <p className="text-gray-600 mt-2">
                    {t('programs.newProgramSetupDescription')}
                </p>
            </div>

            {error && (
                <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg mb-6">
                    {error}
                </div>
            )}

            <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-md p-6 space-y-6">
                <div>
                    <FormLabel>
                        {t('programs.programNameLabel')}
                    </FormLabel>
                    <Input
                        type="text"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        disabled={loading}
                        placeholder={t('programs.programNamePlaceholder')}
                        inputSize="md"
                        required
                    />
                </div>

                <div>
                    <FormLabel>
                        {t('programs.athleteLabel')}
                    </FormLabel>
                    <select
                        value={traineeId}
                        onChange={(e) => setTraineeId(e.target.value)}
                        disabled={loading}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
                        required
                    >
                        <option value="" disabled>
                            {t('programs.selectTraineePlaceholder')}
                        </option>
                        {trainees.map((trainee) => (
                            <option key={trainee.id} value={trainee.id}>
                                {trainee.firstName} {trainee.lastName}
                            </option>
                        ))}
                    </select>
                </div>

                <div className="rounded-xl border border-brand-primary/20 bg-brand-primary/5 p-4">
                    <label className="flex items-start gap-3">
                        <input
                            type="checkbox"
                            checked={isSbdProgram}
                            onChange={(e) => setIsSbdProgram(e.target.checked)}
                            disabled={loading}
                            className="mt-1 h-4 w-4 rounded border-gray-300 text-brand-primary focus:ring-brand-primary"
                        />
                        <span>
                            <span className="block text-sm font-semibold text-gray-900">{t('programs.sbdProgramLabel')}</span>
                            <span className="block text-sm text-gray-600">
                                {t('programs.sbdProgramDescription')}
                            </span>
                        </span>
                    </label>
                </div>

                <div>
                    <FormLabel>
                        {t('programs.durationWeeksLabel')}
                    </FormLabel>
                    <div className="flex items-center space-x-4">
                        <div className="flex-1">
                            <Input
                                type="number"
                                min="1"
                                max="52"
                                value={durationWeeks}
                                onChange={(e) => setDurationWeeks(parseInt(e.target.value))}
                                disabled={loading}
                                inputSize="md"
                                required
                            />
                        </div>
                        <div className="flex space-x-2">
                            {[3, 4, 5, 6].map((weeks) => (
                                <button
                                    key={weeks}
                                    type="button"
                                    onClick={() => setDurationWeeks(weeks)}
                                    disabled={loading}
                                    className={`px-3 py-1 text-sm font-semibold rounded ${durationWeeks === weeks
                                        ? 'bg-brand-primary text-white'
                                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                                        } disabled:opacity-50 disabled:cursor-not-allowed`}
                                >
                                    {weeks}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                <div>
                    <FormLabel>
                        {t('programs.workoutsPerWeekLabel')}
                    </FormLabel>
                    <div className="flex items-center space-x-4">
                        <div className="flex-1">
                            <Input
                                type="number"
                                min="1"
                                max="7"
                                value={workoutsPerWeek}
                                onChange={(e) => setWorkoutsPerWeek(parseInt(e.target.value))}
                                disabled={loading}
                                inputSize="md"
                                required
                            />
                        </div>
                        <div className="flex space-x-2">
                            {[2, 3, 4].map((workouts) => (
                                <button
                                    key={workouts}
                                    type="button"
                                    onClick={() => setWorkoutsPerWeek(workouts)}
                                    disabled={loading}
                                    className={`px-3 py-1 text-sm font-semibold rounded ${workoutsPerWeek === workouts
                                        ? 'bg-brand-primary text-white'
                                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                                        } disabled:opacity-50 disabled:cursor-not-allowed`}
                                >
                                    {workouts}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="mb-2 flex items-center gap-2 text-blue-900">
                        <BarChart3 className="h-4 w-4" />
                        <p className="text-sm font-semibold">{t('editProgram.stepReview')}</p>
                    </div>
                    <p className="text-sm text-blue-700">
                        <Trans
                            i18nKey="trainer:programs.setupSummaryDescription"
                            values={{
                                durationWeeks,
                                workoutsPerWeek,
                                totalWorkouts: durationWeeks * workoutsPerWeek,
                            }}
                            components={{
                                weeks: <span className="font-semibold" />,
                                workouts: <span className="font-semibold" />,
                                total: <span className="font-semibold" />,
                            }}
                        />
                    </p>
                </div>

                <div className="flex space-x-4 pt-4">
                    <button
                        type="submit"
                        disabled={loading}
                        className="flex-1 bg-brand-primary hover:bg-brand-primary-hover disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 px-6 rounded-lg transition-colors flex items-center justify-center"
                    >
                        {loading ? (
                            <LoadingSpinner size="sm" color="white" />
                        ) : (
                            t('programs.nextConfigureExercises')
                        )}
                    </button>
                    <Link
                        href={backHref}
                        className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-800 font-semibold py-3 px-6 rounded-lg text-center transition-colors"
                    >
                        {t('common:common.cancel')}
                    </Link>
                </div>
            </form>
            </div>
            </div>
        </div>
    )
}
