'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useTranslation } from 'react-i18next'
import '@/lib/i18n/client'
import { Button } from '@/components/Button'
import { ActionIconButton } from '@/components/ActionIconButton'
import { Input } from '@/components/Input'
import AutocompleteSearch, { type AutocompleteOption } from '@/components/AutocompleteSearch'
import { useNavigationLoader } from '@/components/NavigationLoadingProvider'
import { getApiErrorMessage } from '@/lib/api-error'
import { workoutTemplateSchema } from '@/schemas/workout-template'
import { computeExerciseGroupColors } from '@/app/trainer/programs/[id]/edit/row-utils'

export type TemplateRestTime = 's30' | 'm1' | 'm1s30' | 'm2' | 'm3' | 'm5'

const REST_TIMES: TemplateRestTime[] = ['s30', 'm1', 'm1s30', 'm2', 'm3', 'm5']

export interface WorkoutTemplateEditorProps {
    initialTemplate?: {
        id: string
        name: string
        workoutsPerWeek: number
        workouts: {
            dayIndex: number
            exercises: {
                exerciseId: string
                sets: number
                reps: string
                restTime: TemplateRestTime
            }[]
        }[]
    }
}

interface EditorRow {
    id: string
    exerciseId: string
    sets: string
    reps: string
    restTime: TemplateRestTime
}

export default function WorkoutTemplateEditor({ initialTemplate }: WorkoutTemplateEditorProps) {
    const { t } = useTranslation(['trainer', 'common', 'errors'])
    const router = useRouter()
    const navigationLoader = useNavigationLoader()
    const rowCounter = useRef(0)
    const nextRowId = () => `row-${rowCounter.current++}`

    const [name, setName] = useState(initialTemplate?.name ?? '')
    const [workoutsPerWeek, setWorkoutsPerWeek] = useState(initialTemplate?.workoutsPerWeek ?? 3)
    // Raw field text: resize happens on blur only, so an empty field mid-typing never drops days.
    const [workoutsInput, setWorkoutsInput] = useState(String(initialTemplate?.workoutsPerWeek ?? 3))
    const [workouts, setWorkouts] = useState<EditorRow[][]>(() => {
        const count = initialTemplate?.workoutsPerWeek ?? 3
        return Array.from({ length: count }, (_, day) => {
            const source = initialTemplate?.workouts.find((w) => w.dayIndex === day)
            return (source?.exercises ?? []).map((ex) => ({
                id: nextRowId(),
                exerciseId: ex.exerciseId,
                sets: String(ex.sets),
                reps: ex.reps,
                restTime: ex.restTime,
            }))
        })
    })
    const [exerciseOptions, setExerciseOptions] = useState<AutocompleteOption[]>([])
    const [error, setError] = useState<string | null>(null)
    const [isSaving, setIsSaving] = useState(false)

    useEffect(() => {
        let cancelled = false
        const load = async () => {
            try {
                const res = await fetch('/api/exercises?limit=500')
                const json = await res.json()
                if (!res.ok) throw new Error(getApiErrorMessage(json, t('trainer:templates.loadError'), t))
                if (cancelled) return
                setExerciseOptions(
                    (json.data.items as { id: string; name: string }[]).map((e) => ({
                        id: e.id,
                        label: e.name,
                    }))
                )
            } catch (err) {
                if (!cancelled) {
                    setError(err instanceof Error ? err.message : t('trainer:templates.loadError'))
                }
            }
        }
        void load()
        return () => {
            cancelled = true
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    const commitWorkoutsPerWeek = () => {
        const next = Number(workoutsInput)
        if (workoutsInput.trim() === '' || !Number.isInteger(next) || next < 1 || next > 7) {
            setWorkoutsInput(String(workoutsPerWeek))
            return
        }
        if (next === workoutsPerWeek) return
        const dropsExercises = workouts.slice(next).some((rows) => rows.length > 0)
        if (dropsExercises && !window.confirm(t('trainer:templates.confirmShrinkWorkouts'))) {
            setWorkoutsInput(String(workoutsPerWeek))
            return
        }
        setWorkoutsPerWeek(next)
        setWorkouts((current) => {
            if (next <= current.length) return current.slice(0, next)
            return [...current, ...Array.from({ length: next - current.length }, () => [] as EditorRow[])]
        })
    }

    const updateRow = (day: number, rowId: string, patch: Partial<EditorRow>) => {
        setWorkouts((current) =>
            current.map((rows, d) =>
                d === day ? rows.map((r) => (r.id === rowId ? { ...r, ...patch } : r)) : rows
            )
        )
    }

    const addRow = (day: number) => {
        setWorkouts((current) =>
            current.map((rows, d) =>
                d === day
                    ? [
                          ...rows,
                          { id: nextRowId(), exerciseId: '', sets: '3', reps: '8', restTime: 'm2' as TemplateRestTime },
                      ]
                    : rows
            )
        )
    }

    const removeRow = (day: number, rowId: string) => {
        setWorkouts((current) =>
            current.map((rows, d) => (d === day ? rows.filter((r) => r.id !== rowId) : rows))
        )
    }

    const moveRow = (day: number, rowId: string, direction: -1 | 1) => {
        setWorkouts((current) =>
            current.map((rows, d) => {
                if (d !== day) return rows
                const from = rows.findIndex((r) => r.id === rowId)
                const to = from + direction
                if (from < 0 || to < 0 || to >= rows.length) return rows
                const next = [...rows]
                ;[next[from], next[to]] = [next[to], next[from]]
                return next
            })
        )
    }

    const colorsByDay = useMemo(() => workouts.map((rows) => computeExerciseGroupColors(rows)), [workouts])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError(null)

        const body = {
            name,
            workoutsPerWeek,
            workouts: workouts.map((rows, dayIndex) => ({
                dayIndex,
                exercises: rows.map((r) => ({
                    exerciseId: r.exerciseId,
                    sets: Number(r.sets),
                    reps: r.reps.trim(),
                    restTime: r.restTime,
                })),
            })),
        }

        const parsed = workoutTemplateSchema.safeParse(body)
        if (!parsed.success) {
            const message = parsed.error.issues[0]?.message ?? ''
            setError(message.startsWith('validation.') ? t(`errors:${message}`) : t('trainer:templates.saveError'))
            return
        }

        setIsSaving(true)
        try {
            const res = await fetch(
                initialTemplate ? `/api/workout-templates/${initialTemplate.id}` : '/api/workout-templates',
                {
                    method: initialTemplate ? 'PUT' : 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(parsed.data),
                }
            )
            const json = await res.json()
            if (!res.ok) throw new Error(getApiErrorMessage(json, t('trainer:templates.saveError'), t))
            navigationLoader.start()
            router.push('/trainer/templates')
        } catch (err) {
            navigationLoader.stop()
            setError(err instanceof Error ? err.message : t('trainer:templates.saveError'))
            setIsSaving(false)
        }
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-6" noValidate>
            <h1 className="text-2xl font-bold text-gray-900">
                {initialTemplate ? t('trainer:templates.editorEditTitle') : t('trainer:templates.editorNewTitle')}
            </h1>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                <div>
                    <label htmlFor="template-name" className="block text-sm font-medium text-gray-700 mb-1">
                        {t('trainer:templates.nameLabel')}
                    </label>
                    <Input
                        id="template-name"
                        name="name"
                        value={name}
                        maxLength={100}
                        onChange={(e) => setName(e.target.value)}
                    />
                </div>
                <div>
                    <label htmlFor="template-workouts" className="block text-sm font-medium text-gray-700 mb-1">
                        {t('trainer:templates.workoutsPerWeekLabel')}
                    </label>
                    <Input
                        id="template-workouts"
                        name="workoutsPerWeek"
                        type="number"
                        min={1}
                        max={7}
                        value={workoutsInput}
                        onChange={(e) => setWorkoutsInput(e.target.value)}
                        onBlur={commitWorkoutsPerWeek}
                    />
                </div>
            </div>

            {workouts.map((rows, day) => (
                <section
                    key={day}
                    data-testid={`template-workout-${day}`}
                    className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 space-y-3"
                >
                    <h2 className="text-lg font-semibold text-gray-900">
                        {t('trainer:templates.workoutLabel', { n: day + 1 })}
                    </h2>

                    {rows.length > 0 && (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="text-left text-gray-600">
                                        <th className="px-1 py-1 font-medium">{t('trainer:templates.colExercise')}</th>
                                        <th className="px-1 py-1 font-medium w-20">{t('trainer:templates.colSets')}</th>
                                        <th className="px-1 py-1 font-medium w-28">{t('trainer:templates.colReps')}</th>
                                        <th className="px-1 py-1 font-medium w-36">{t('trainer:templates.colRest')}</th>
                                        <th className="px-1 py-1 w-28" />
                                    </tr>
                                </thead>
                                <tbody>
                                    {rows.map((row, rowIndex) => {
                                        const group = colorsByDay[day].get(row.id)
                                        return (
                                            <tr
                                                key={row.id}
                                                className={group === 'odd' ? 'bg-gray-50' : 'bg-white'}
                                            >
                                                <td className="px-1 py-1">
                                                    <AutocompleteSearch
                                                        id={`template-exercise-${row.id}`}
                                                        options={exerciseOptions}
                                                        value={row.exerciseId || undefined}
                                                        placeholder={t('trainer:templates.selectExercise')}
                                                        onSelect={(option) =>
                                                            updateRow(day, row.id, { exerciseId: option?.id ?? '' })
                                                        }
                                                        compact
                                                    />
                                                </td>
                                                <td className="px-1 py-1">
                                                    <input
                                                        type="number"
                                                        min={1}
                                                        max={20}
                                                        aria-label={t('trainer:templates.colSets')}
                                                        placeholder={t('trainer:templates.setsPlaceholder')}
                                                        value={row.sets}
                                                        onChange={(e) => updateRow(day, row.id, { sets: e.target.value })}
                                                        className="w-full rounded border border-gray-300 px-1 py-1 min-h-[36px]"
                                                    />
                                                </td>
                                                <td className="px-1 py-1">
                                                    <input
                                                        type="text"
                                                        aria-label={t('trainer:templates.colReps')}
                                                        placeholder={t('trainer:templates.repsPlaceholder')}
                                                        value={row.reps}
                                                        onChange={(e) => updateRow(day, row.id, { reps: e.target.value })}
                                                        className="w-full rounded border border-gray-300 px-1 py-1 min-h-[36px]"
                                                    />
                                                </td>
                                                <td className="px-1 py-1">
                                                    <select
                                                        aria-label={t('trainer:templates.colRest')}
                                                        value={row.restTime}
                                                        onChange={(e) =>
                                                            updateRow(day, row.id, {
                                                                restTime: e.target.value as TemplateRestTime,
                                                            })
                                                        }
                                                        className="w-full rounded border border-gray-300 px-1 py-1 min-h-[36px] bg-white"
                                                    >
                                                        {REST_TIMES.map((rt) => (
                                                            <option key={rt} value={rt}>
                                                                {t(`trainer:templates.restOptions.${rt}`)}
                                                            </option>
                                                        ))}
                                                    </select>
                                                </td>
                                                <td className="px-1 py-1 text-right">
                                                    <div className="flex items-center justify-end gap-1">
                                                    <button
                                                        type="button"
                                                        onClick={() => moveRow(day, row.id, -1)}
                                                        disabled={rowIndex === 0}
                                                        title={t('trainer:templates.moveUp')}
                                                        aria-label={t('trainer:templates.moveUp')}
                                                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-gray-600 hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed"
                                                    >
                                                        <ChevronUp className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => moveRow(day, row.id, 1)}
                                                        disabled={rowIndex === rows.length - 1}
                                                        title={t('trainer:templates.moveDown')}
                                                        aria-label={t('trainer:templates.moveDown')}
                                                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-gray-600 hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed"
                                                    >
                                                        <ChevronDown className="w-4 h-4" />
                                                    </button>
                                                    <ActionIconButton
                                                        variant="delete"
                                                        label={t('trainer:templates.removeExercise')}
                                                        onClick={() => removeRow(day, row.id)}
                                                    />
                                                    </div>
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}

                    <Button type="button" variant="secondary" size="sm" onClick={() => addRow(day)}>
                        {t('trainer:templates.addExercise')}
                    </Button>
                </section>
            ))}

            {error && (
                <p role="alert" className="text-state-error">
                    {error}
                </p>
            )}

            <div className="flex justify-end gap-3">
                <Button type="button" variant="secondary" onClick={() => router.push('/trainer/templates')}>
                    {t('trainer:templates.cancel')}
                </Button>
                <Button type="submit" isLoading={isSaving} loadingText={t('common:common.saving')}>
                    {t('trainer:templates.saveToLibrary')}
                </Button>
            </div>
        </form>
    )
}
