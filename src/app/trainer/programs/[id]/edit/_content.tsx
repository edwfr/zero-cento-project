'use client'

import { useState, useEffect, useRef, useCallback, useMemo, type CSSProperties } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useTranslation } from 'react-i18next'
import { RestTime, WeightType } from '@prisma/client'
import { getApiErrorMessage } from '@/lib/api-error'
import LoadingSpinner from '@/components/LoadingSpinner'
import ConfirmationModal from '@/components/ConfirmationModal'
import { useToast } from '@/components/ToastNotification'
import EditProgramMetadata from './EditProgramMetadata'
import MovementPatternTag from '@/components/MovementPatternTag'
import WeekTypeBadge from '@/components/WeekTypeBadge'
import AutocompleteSearch from '@/components/AutocompleteSearch'
import { Input } from '@/components/Input'
import { ActionIconButton } from '@/components'
import {
    ArrowLeft,
    BarChart3,
    ChevronDown,
    ChevronUp,
    Copy,
    Dumbbell,
    FileEdit,
    Flame,
    GripVertical,
    Info,
    Lock,
    LockOpen,
    Plus,
    Save,
    Trash2,
} from 'lucide-react'
import {
    buildStructureRowsForWorkout,
    type WorkoutStructureTemplateRow,
} from './structure-utils'
import { transformApiWeek } from './transform-utils'
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    type DragEndEvent,
} from '@dnd-kit/core'
import {
    SortableContext,
    sortableKeyboardCoordinates,
    useSortable,
    verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

const PRIMARY_COLOR = 'rgb(var(--brand-primary))'
const RPE_OPTIONS = [5, 5.5, 6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10]
const REST_TIME_OPTIONS: Array<{ value: RestTime; label: string }> = [
    { value: 's30', label: '30s' },
    { value: 'm1', label: '1m' },
    { value: 'm2', label: '2m' },
    { value: 'm3', label: '3m' },
    { value: 'm5', label: '5m' },
]

interface MovementPattern {
    id: string
    name: string
    color: string
}

interface ExerciseReference {
    id: string
    name: string
    type: 'fundamental' | 'accessory'
    notes: string[]
    movementPattern: MovementPattern | null
    exerciseMuscleGroups: Array<{
        coefficient: number
        muscleGroup: {
            id: string
            name: string
        }
    }>
}

interface WorkoutExercise {
    id: string
    order: number
    variant: string | null
    sets: number
    reps: string
    targetRpe: number | null
    weightType: WeightType
    weight: number | null
    effectiveWeight: number | null
    restTime: RestTime
    isWarmup: boolean
    isSkeletonExercise: boolean
    notes: string | null
    exercise: ExerciseReference
}

interface Workout {
    id: string
    dayIndex: number
    workoutExercises: WorkoutExercise[]
}

interface Week {
    id: string
    weekNumber: number
    weekType: 'normal' | 'test' | 'deload'
    workouts: Workout[]
}

interface Program {
    id: string
    title: string
    status: 'draft' | 'active' | 'completed'
    isSbdProgram: boolean
    trainee: {
        id: string
        firstName: string
        lastName: string
    }
    durationWeeks: number
    workoutsPerWeek: number
    weeks: Week[]
}

interface PersonalRecord {
    id?: string
    exerciseId: string
    reps: number
    weight: number
    recordDate?: string
    exercise?: {
        id: string
        name: string
        type: 'fundamental' | 'accessory'
    }
}

interface ExerciseCatalogItem {
    id: string
    name: string
    type: 'fundamental' | 'accessory'
    notes: string[]
    movementPattern: MovementPattern | null
}

interface EditableWorkoutExerciseRow {
    id: string
    workoutId: string
    exerciseId: string
    variant: string
    sets: string
    reps: string
    targetRpe: string
    weight: string
    isWarmup: boolean
    order: number
    restTime: RestTime
    notes: string | null
    isDraft: boolean
}

interface EditProgramContentProps {
    readOnly?: boolean
}

type ParsedWeightInputMode =
    | 'empty'
    | 'absolute'
    | 'percentage_1rm'
    | 'percentage_rm'
    | 'percentage_previous'
    | 'invalid'

interface ParsedWeightInputValue {
    mode: ParsedWeightInputMode
    value: number | null
}

interface ParsedWeightInputResult {
    weightType: WeightType
    weight: number | null
    effectiveWeight: number | null
}

type WeightInputParsingErrorCode =
    | 'invalid_format'
    | 'missing_previous_occurrence'
    | 'missing_previous_weight'
    | 'missing_1rm'

type ResolveWeightInputOutcome =
    | { parsedWeight: ParsedWeightInputResult }
    | { errorCode: WeightInputParsingErrorCode }

function parseRepsValue(repsValue: string): number {
    const match = repsValue.match(/^\d+/)
    return match ? parseInt(match[0], 10) : 0
}

function estimateOneRMValue(weight: number, reps: number): number {
    if (reps <= 1) return weight
    return weight * (1 + reps / 30)
}

function formatWeightInputFromStoredValues(weightType: WeightType, weight: number | null): string {
    if (typeof weight !== 'number') {
        return ''
    }

    if (weightType === 'absolute') {
        return String(weight)
    }

    if (weightType === 'percentage_1rm') {
        return `%${weight}`
    }

    if (weightType === 'percentage_rm') {
        return `${weight}%RM`
    }

    return `${weight}%`
}

function parseWeightInputValue(rawValue: string): ParsedWeightInputValue {
    const trimmedValue = rawValue.trim()

    if (trimmedValue === '') {
        return { mode: 'empty', value: null }
    }

    const normalizedValue = trimmedValue.replace(/\s+/g, '').replace(',', '.')

    const percentagePreviousMatch = normalizedValue.match(/^-(\d+(?:\.\d+)?)%$/)
    if (percentagePreviousMatch) {
        return {
            mode: 'percentage_previous',
            value: -Number(percentagePreviousMatch[1]),
        }
    }

    const percentageOneRmMatch =
        normalizedValue.match(/^%(\d+(?:\.\d+)?)(?:1rm)?$/i) ||
        normalizedValue.match(/^(\d+(?:\.\d+)?)%1rm$/i) ||
        normalizedValue.match(/^(\d+(?:\.\d+)?)%$/)

    if (percentageOneRmMatch) {
        return {
            mode: 'percentage_1rm',
            value: Number(percentageOneRmMatch[1]),
        }
    }

    const percentageRmMatch =
        normalizedValue.match(/^%(\d+(?:\.\d+)?)rm$/i) ||
        normalizedValue.match(/^(\d+(?:\.\d+)?)%rm$/i)

    if (percentageRmMatch) {
        return {
            mode: 'percentage_rm',
            value: Number(percentageRmMatch[1]),
        }
    }

    const absoluteMatch = normalizedValue.match(/^(\d+(?:\.\d+)?)(?:kg)?$/i)
    if (absoluteMatch) {
        return {
            mode: 'absolute',
            value: Number(absoluteMatch[1]),
        }
    }

    return {
        mode: 'invalid',
        value: null,
    }
}

function roundWeightValue(value: number): number {
    return Math.round((value + Number.EPSILON) * 100) / 100
}

function formatWeightForDisplay(value: number): string {
    const roundedValue = roundWeightValue(value)

    if (Number.isInteger(roundedValue)) {
        return String(roundedValue)
    }

    return roundedValue.toFixed(2).replace(/\.?0+$/, '')
}

function parseRgbColor(color: string): { r: number; g: number; b: number } | null {
    const hexMatch = color.trim().match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i)
    if (hexMatch) {
        return {
            r: parseInt(hexMatch[1], 16),
            g: parseInt(hexMatch[2], 16),
            b: parseInt(hexMatch[3], 16),
        }
    }

    const rgbMatch = color
        .trim()
        .match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*([0-9.]+))?\s*\)$/i)
    if (rgbMatch) {
        return {
            r: Number(rgbMatch[1]),
            g: Number(rgbMatch[2]),
            b: Number(rgbMatch[3]),
        }
    }

    return null
}

function getMovementPatternRowStyle(color?: string | null): CSSProperties | undefined {
    if (!color) {
        return undefined
    }

    if (color.includes('var(--brand-primary)')) {
        return {
            backgroundColor: 'rgba(var(--brand-primary), 0.12)',
            borderLeftColor: 'rgba(var(--brand-primary), 0.8)',
        }
    }

    const rgb = parseRgbColor(color)
    if (!rgb) {
        return undefined
    }

    return {
        backgroundColor: `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.14)`,
        borderLeftColor: `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.85)`,
    }
}

function buildEditableRow(
    workoutId: string,
    workoutExercise: WorkoutExercise,
    isDraft = false
): EditableWorkoutExerciseRow {
    return {
        id: workoutExercise.id,
        workoutId,
        exerciseId: workoutExercise.exercise.id,
        variant: workoutExercise.variant ?? '',
        sets: String(workoutExercise.sets),
        reps: workoutExercise.reps,
        targetRpe:
            typeof workoutExercise.targetRpe === 'number' ? String(workoutExercise.targetRpe) : '',
        weight: formatWeightInputFromStoredValues(
            workoutExercise.weightType,
            workoutExercise.weight
        ),
        isWarmup: workoutExercise.isWarmup,
        order: workoutExercise.order,
        restTime: workoutExercise.restTime,
        notes: workoutExercise.notes,
        isDraft,
    }
}

function normalizeOptionalText(value: string | null): string | null {
    const trimmedValue = value?.trim() ?? ''
    return trimmedValue.length > 0 ? trimmedValue : null
}

function areEditableRowsEquivalent(
    left: EditableWorkoutExerciseRow,
    right: EditableWorkoutExerciseRow
): boolean {
    return (
        left.exerciseId === right.exerciseId &&
        left.variant.trim() === right.variant.trim() &&
        left.sets.trim() === right.sets.trim() &&
        left.reps.trim() === right.reps.trim() &&
        left.targetRpe.trim() === right.targetRpe.trim() &&
        left.weight.trim() === right.weight.trim() &&
        left.isWarmup === right.isWarmup &&
        left.order === right.order &&
        left.restTime === right.restTime &&
        normalizeOptionalText(left.notes) === normalizeOptionalText(right.notes)
    )
}

function SortableExerciseRow({
    id,
    isDraft,
    readOnly,
    children,
}: {
    id: string
    isDraft: boolean
    readOnly: boolean
    children: (dragHandleProps: React.HTMLAttributes<HTMLElement> | null) => React.ReactNode
}) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
        id,
        disabled: isDraft || readOnly,
    })

    const style: React.CSSProperties = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
        position: 'relative',
        zIndex: isDragging ? 1 : 'auto',
    }

    return (
        <tr ref={setNodeRef} style={style}>
            {children(isDraft || readOnly ? null : { ...attributes, ...listeners })}
        </tr>
    )
}

export default function EditProgramContent({ readOnly = false }: EditProgramContentProps) {
    const params = useParams()
    const searchParams = useSearchParams()
    const programId = params.id as string
    const { showToast } = useToast()
    const { t } = useTranslation(['trainer', 'navigation'])

    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [copyingWeekId, setCopyingWeekId] = useState<string | null>(null)
    const [program, setProgram] = useState<Program | null>(null)
    const [exerciseCatalog, setExerciseCatalog] = useState<ExerciseCatalogItem[]>([])
    const [personalRecords, setPersonalRecords] = useState<PersonalRecord[]>([])
    const [error, setError] = useState<string | null>(null)

    const backContext = searchParams.get('backContext')
    const queryTraineeId = searchParams.get('traineeId') ?? ''
    const resolvedTraineeId = program?.trainee.id || queryTraineeId || ''
    const hasTraineeBackContext = backContext === 'trainee' && Boolean(resolvedTraineeId)
    const navigationContextQuery = hasTraineeBackContext
        ? `?backContext=trainee&traineeId=${encodeURIComponent(resolvedTraineeId)}`
        : ''
    const editProgramHref = `/trainer/programs/${programId}/edit${navigationContextQuery}`
    const reviewProgramHref = `/trainer/programs/${programId}/review${navigationContextQuery}`
    const backHref = hasTraineeBackContext
        ? `/trainer/trainees/${resolvedTraineeId}`
        : '/trainer/programs'
    const backLabel = hasTraineeBackContext
        ? t('navigation:breadcrumbs.backToAthleteProfile')
        : t('editProgram.backToPrograms')

    const loadingRef = useRef(false)
    const requestIdRef = useRef(0)
    const lastVisibilityRefreshRef = useRef(0)
    const trainerIdRef = useRef('')

    const [activeWeekId, setActiveWeekId] = useState<string | null>(null)
    const [expandedWeekIds, setExpandedWeekIds] = useState<Record<string, boolean>>({})
    const [expandedWorkoutIds, setExpandedWorkoutIds] = useState<Record<string, boolean>>({})

    const [rowStateById, setRowStateById] = useState<Record<string, EditableWorkoutExerciseRow>>({})
    const [draftRowIdsByWorkout, setDraftRowIdsByWorkout] = useState<Record<string, string[]>>({})
    const [customVariantInputByRowId, setCustomVariantInputByRowId] = useState<Record<string, boolean>>({})
    const [wizardStep, setWizardStep] = useState<'structure' | 'details'>(
        readOnly ? 'details' : 'structure'
    )
    const [structureRowsByWorkoutIndex, setStructureRowsByWorkoutIndex] = useState<
        Record<number, WorkoutStructureTemplateRow[]>
    >({})
    const [applyingStructure, setApplyingStructure] = useState(false)
    const [savingRowId, setSavingRowId] = useState<string | null>(null)
    const [savingWorkoutId, setSavingWorkoutId] = useState<string | null>(null)
    const [deletingRowId, setDeletingRowId] = useState<string | null>(null)
    const [reorderingWorkoutId, setReorderingWorkoutId] = useState<string | null>(null)

    const [confirmCopyNextWeek, setConfirmCopyNextWeek] = useState<Week | null>(null)
    const [confirmDeleteRow, setConfirmDeleteRow] = useState<{
        rowId: string
        workoutId: string
        isDraft: boolean
    } | null>(null)
    const [blockingWeightErrorModal, setBlockingWeightErrorModal] = useState<{
        title: string
        message: string
    } | null>(null)
    const [openHeaderHint, setOpenHeaderHint] = useState<{
        workoutId: string
        field: 'reps' | 'weight'
    } | null>(null)

    const [isPrHelperCollapsed, setIsPrHelperCollapsed] = useState(false)
    const [isSbdHelperCollapsed, setIsSbdHelperCollapsed] = useState(false)

    const dndSensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    )

    const fetchExerciseCatalog = useCallback(async () => {
        try {
            const movementPatternsRes = await fetch('/api/movement-patterns')
            const movementPatternsData = await movementPatternsRes.json()

            const allExercises: any[] = []
            let cursor: string | null = null

            while (true) {
                const searchParams = new URLSearchParams({
                    limit: '100',
                })

                if (cursor) {
                    searchParams.set('cursor', cursor)
                }

                const exercisesRes = await fetch(`/api/exercises?${searchParams.toString()}`)
                const exercisesData = await exercisesRes.json()

                if (!exercisesRes.ok) {
                    setExerciseCatalog([])
                    return
                }

                const pageItems = Array.isArray(exercisesData.data?.items)
                    ? exercisesData.data.items
                    : []
                allExercises.push(...pageItems)

                const hasMore = Boolean(exercisesData.data?.pagination?.hasMore)
                const nextCursor = exercisesData.data?.pagination?.nextCursor

                if (!hasMore || typeof nextCursor !== 'string' || nextCursor.length === 0) {
                    break
                }

                cursor = nextCursor
            }

            const patternColorsMap = new Map<string, string>()
            if (movementPatternsRes.ok && movementPatternsData.data?.items) {
                movementPatternsData.data.items.forEach((pattern: any) => {
                    if (pattern.movementPatternColors && pattern.movementPatternColors.length > 0) {
                        patternColorsMap.set(pattern.id, pattern.movementPatternColors[0].color)
                    }
                })
            }

            const nextCatalog: ExerciseCatalogItem[] = allExercises.map((exercise: any) => {
                const movementPattern = exercise.movementPattern
                    ? {
                        id: exercise.movementPattern.id,
                        name: exercise.movementPattern.name,
                        color: patternColorsMap.get(exercise.movementPattern.id) || PRIMARY_COLOR,
                    }
                    : null

                return {
                    id: exercise.id,
                    name: exercise.name,
                    type: exercise.type,
                    notes: Array.isArray(exercise.notes)
                        ? exercise.notes.filter((note: unknown) => typeof note === 'string')
                        : [],
                    movementPattern,
                }
            })

            setExerciseCatalog(
                nextCatalog.sort((left, right) =>
                    left.name.localeCompare(right.name, 'it', { sensitivity: 'base' })
                )
            )
        } catch {
            setExerciseCatalog([])
        }
    }, [])

    const fetchPersonalRecords = useCallback(async (traineeId: string, requestId: number) => {
        try {
            const recordsRes = await fetch(`/api/personal-records?traineeId=${traineeId}`)

            if (requestId !== requestIdRef.current) {
                return
            }

            if (!recordsRes.ok) {
                setPersonalRecords([])
                return
            }

            const recordsData = await recordsRes.json()

            if (requestId !== requestIdRef.current) {
                return
            }

            setPersonalRecords(recordsData.data.items || [])
        } catch {
            if (requestId === requestIdRef.current) {
                setPersonalRecords([])
            }
        }
    }, [])

    const fetchProgram = useCallback(async ({ showLoading = true }: { showLoading?: boolean } = {}) => {
        if (loadingRef.current) return

        loadingRef.current = true
        const requestId = ++requestIdRef.current

        try {
            if (showLoading) {
                setLoading(true)
            }

            const res = await fetch(`/api/programs/${programId}`, {
                cache: 'no-store',
            })
            const data = await res.json()

            if (!res.ok) {
                throw new Error(getApiErrorMessage(data, t('editProgram.errorLoading'), t))
            }

            const traineeId = data.data.program.trainee.id
            const trainerId = data.data.program.trainerId
            trainerIdRef.current = trainerId

            const transformedProgram: Program = {
                id: data.data.program.id,
                title: data.data.program.title,
                status: data.data.program.status,
                isSbdProgram: data.data.program.isSbdProgram,
                trainee: data.data.program.trainee,
                durationWeeks: data.data.program.durationWeeks,
                workoutsPerWeek: data.data.program.workoutsPerWeek,
                weeks: (data.data.program.weeks || []).map((week: any) =>
                    transformApiWeek(week, trainerId) as Week
                ),
            }

            if (requestId !== requestIdRef.current) {
                return
            }

            setProgram(transformedProgram)
            setError(null)
            void fetchPersonalRecords(traineeId, requestId)
        } catch (err: unknown) {
            if (requestId === requestIdRef.current) {
                setError(err instanceof Error ? err.message : t('editProgram.errorLoading'))
            }
        } finally {
            if (requestId === requestIdRef.current) {
                if (showLoading) {
                    setLoading(false)
                }
                loadingRef.current = false
            }
        }
    }, [fetchPersonalRecords, programId, t])

    useEffect(() => {
        void fetchProgram()
        void fetchExerciseCatalog()
    }, [fetchExerciseCatalog, fetchProgram])

    useEffect(() => {
        const handleVisibilityChange = () => {
            const now = Date.now()

            if (
                document.visibilityState === 'visible' &&
                !loadingRef.current &&
                now - lastVisibilityRefreshRef.current > 30000
            ) {
                lastVisibilityRefreshRef.current = now
                void fetchProgram({ showLoading: false })
            }
        }

        document.addEventListener('visibilitychange', handleVisibilityChange)

        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange)
        }
    }, [fetchProgram])

    useEffect(() => {
        if (!program) {
            return
        }

        const nextRows: Record<string, EditableWorkoutExerciseRow> = {}

        program.weeks.forEach((week) => {
            week.workouts.forEach((workout) => {
                workout.workoutExercises.forEach((workoutExercise) => {
                    nextRows[workoutExercise.id] = buildEditableRow(workout.id, workoutExercise)
                })
            })
        })

        setRowStateById((currentRows) => {
            const persistedDraftRows = Object.fromEntries(
                Object.entries(currentRows).filter(([, row]) => row.isDraft)
            )

            return {
                ...nextRows,
                ...persistedDraftRows,
            }
        })

        if (!activeWeekId || !program.weeks.some((week) => week.id === activeWeekId)) {
            setActiveWeekId(program.weeks[0]?.id ?? null)
        }

        setExpandedWeekIds((currentExpandedWeekIds) => {
            if (Object.keys(currentExpandedWeekIds).length > 0) {
                return currentExpandedWeekIds
            }

            const firstWeekId = program.weeks[0]?.id
            if (!firstWeekId) {
                return currentExpandedWeekIds
            }

            return {
                [firstWeekId]: true,
            }
        })

        setExpandedWorkoutIds((currentExpandedWorkoutIds) => {
            const workoutIds = program.weeks.flatMap((week) => week.workouts.map((workout) => workout.id))

            if (workoutIds.length === 0) {
                return currentExpandedWorkoutIds
            }

            const nextExpandedWorkoutIds: Record<string, boolean> = {}
            let hasChanges = workoutIds.length !== Object.keys(currentExpandedWorkoutIds).length

            workoutIds.forEach((workoutId) => {
                if (Object.prototype.hasOwnProperty.call(currentExpandedWorkoutIds, workoutId)) {
                    nextExpandedWorkoutIds[workoutId] = currentExpandedWorkoutIds[workoutId]
                    return
                }

                nextExpandedWorkoutIds[workoutId] = true
                hasChanges = true
            })

            if (!hasChanges) {
                return currentExpandedWorkoutIds
            }

            return nextExpandedWorkoutIds
        })

        setStructureRowsByWorkoutIndex((currentStructureRowsByWorkoutIndex) => {
            const firstWeek = program.weeks[0]
            const nextStructureRowsByWorkoutIndex: Record<number, WorkoutStructureTemplateRow[]> = {}
            let hasChanges = false

            for (let workoutIndex = 0; workoutIndex < program.workoutsPerWeek; workoutIndex += 1) {
                const existingRows = currentStructureRowsByWorkoutIndex[workoutIndex]

                if (existingRows) {
                    nextStructureRowsByWorkoutIndex[workoutIndex] = existingRows
                    continue
                }

                const sourceWorkout = firstWeek?.workouts[workoutIndex]
                const sourceRows = sourceWorkout?.workoutExercises ?? []
                hasChanges = true

                nextStructureRowsByWorkoutIndex[workoutIndex] = buildStructureRowsForWorkout(
                    workoutIndex,
                    sourceRows
                )
            }

            const currentKeys = Object.keys(currentStructureRowsByWorkoutIndex)
            const nextKeys = Object.keys(nextStructureRowsByWorkoutIndex)

            if (!hasChanges && currentKeys.length === nextKeys.length) {
                return currentStructureRowsByWorkoutIndex
            }

            return nextStructureRowsByWorkoutIndex
        })
    }, [program, activeWeekId])

    useEffect(() => {
        if (!openHeaderHint) {
            return
        }

        const handlePointerDown = (event: MouseEvent | TouchEvent) => {
            const target = event.target

            if (!(target instanceof Element)) {
                return
            }

            const clickInsideHint = target.closest(
                '[data-header-hint-trigger="true"], [data-header-hint-popover="true"]'
            )

            if (!clickInsideHint) {
                setOpenHeaderHint(null)
            }
        }

        const handleEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setOpenHeaderHint(null)
            }
        }

        document.addEventListener('mousedown', handlePointerDown)
        document.addEventListener('touchstart', handlePointerDown)
        document.addEventListener('keydown', handleEscape)

        return () => {
            document.removeEventListener('mousedown', handlePointerDown)
            document.removeEventListener('touchstart', handlePointerDown)
            document.removeEventListener('keydown', handleEscape)
        }
    }, [openHeaderHint])

    const exerciseLookupById = useMemo(() => {
        const nextLookup = new Map<string, ExerciseCatalogItem>()

        exerciseCatalog.forEach((exercise) => {
            nextLookup.set(exercise.id, exercise)
        })

        program?.weeks.forEach((week) => {
            week.workouts.forEach((workout) => {
                workout.workoutExercises.forEach((workoutExercise) => {
                    if (!nextLookup.has(workoutExercise.exercise.id)) {
                        nextLookup.set(workoutExercise.exercise.id, {
                            id: workoutExercise.exercise.id,
                            name: workoutExercise.exercise.name,
                            type: workoutExercise.exercise.type,
                            notes: workoutExercise.exercise.notes,
                            movementPattern: workoutExercise.exercise.movementPattern,
                        })
                    }
                })
            })
        })

        return nextLookup
    }, [exerciseCatalog, program])

    const exerciseNameById = useMemo(() => {
        return Array.from(exerciseLookupById.values()).reduce((acc, exercise) => {
            acc[exercise.id] = exercise.name
            return acc
        }, {} as Record<string, string>)
    }, [exerciseLookupById])

    const autocompleteExerciseOptions = useMemo(
        () =>
            Array.from(exerciseLookupById.values()).map((exercise) => {
                const typeLabel =
                    exercise.type === 'fundamental'
                        ? t('exercises.fundamental')
                        : t('exercises.accessory')
                const sublabel = exercise.movementPattern
                    ? `${exercise.movementPattern.name} · ${typeLabel}`
                    : typeLabel

                return {
                    id: exercise.id,
                    label: exercise.name,
                    sublabel,
                }
            }),
        [exerciseLookupById, t]
    )

    const activeWeek = useMemo(() => {
        if (!program) {
            return null
        }

        return program.weeks.find((week) => week.id === activeWeekId) || program.weeks[0] || null
    }, [program, activeWeekId])

    const completedWorkouts = useMemo(() => {
        if (!program) return 0

        return program.weeks.reduce(
            (total, week) =>
                total + week.workouts.filter((workout) => workout.workoutExercises.length > 0).length,
            0
        )
    }, [program])

    const totalWorkouts = program ? program.durationWeeks * program.workoutsPerWeek : 0

    const recordsByExercise = useMemo(
        () =>
            personalRecords.reduce((acc, record) => {
                if (!acc[record.exerciseId]) {
                    acc[record.exerciseId] = []
                }

                acc[record.exerciseId].push(record)
                return acc
            }, {} as Record<string, PersonalRecord[]>),
        [personalRecords]
    )

    const bestPRs = useMemo(
        () =>
            Object.values(recordsByExercise)
                .map((records) =>
                    records.reduce((best, current) => {
                        const currentEstimatedOneRM = estimateOneRMValue(current.weight, current.reps)
                        const bestEstimatedOneRM = estimateOneRMValue(best.weight, best.reps)
                        return currentEstimatedOneRM > bestEstimatedOneRM ? current : best
                    })
                )
                .sort((left, right) => {
                    const leftValue = estimateOneRMValue(left.weight, left.reps)
                    const rightValue = estimateOneRMValue(right.weight, right.reps)
                    return rightValue - leftValue
                }),
        [recordsByExercise]
    )

    const estimatedOneRMByExercise = useMemo(
        () =>
            bestPRs.reduce((acc, record) => {
                acc[record.exerciseId] = estimateOneRMValue(record.weight, record.reps)
                return acc
            }, {} as Record<string, number>),
        [bestPRs]
    )

    const shouldShowSbdReporting = program?.isSbdProgram ?? false

    const weekTypeBadgeLabels = useMemo(
        () => ({
            normal: t('editProgram.weekTypeStandard'),
            test: t('editProgram.weekTypeTest'),
            deload: t('editProgram.weekTypeDeload'),
        }),
        [t]
    )

    const weekSbdMetrics = useMemo(
        () =>
            program
                ? program.weeks.reduce((acc, week) => {
                    acc[week.id] = Object.values(
                        week.workouts.reduce(
                            (weekAcc, workout) => {
                                workout.workoutExercises
                                    .filter(
                                        (workoutExercise) =>
                                            workoutExercise.exercise.type === 'fundamental' &&
                                            !workoutExercise.isWarmup
                                    )
                                    .forEach((workoutExercise) => {
                                        const key = workoutExercise.exercise.id
                                        const plannedReps = parseRepsValue(workoutExercise.reps)
                                        const liftCount = workoutExercise.sets * plannedReps

                                        let intensity: number | null = null
                                        if (
                                            workoutExercise.weightType === 'percentage_1rm' &&
                                            typeof workoutExercise.weight === 'number'
                                        ) {
                                            intensity = workoutExercise.weight
                                        } else if (
                                            workoutExercise.weightType === 'absolute' &&
                                            typeof workoutExercise.weight === 'number'
                                        ) {
                                            const estimatedOneRM =
                                                estimatedOneRMByExercise[workoutExercise.exercise.id]
                                            if (estimatedOneRM) {
                                                intensity = (workoutExercise.weight / estimatedOneRM) * 100
                                            }
                                        }

                                        if (!weekAcc[key]) {
                                            weekAcc[key] = {
                                                exerciseId: workoutExercise.exercise.id,
                                                exerciseName: workoutExercise.exercise.name,
                                                workoutIds: new Set<string>(),
                                                totalLifts: 0,
                                                weightedIntensitySum: 0,
                                                intensityLiftCount: 0,
                                            }
                                        }

                                        weekAcc[key].workoutIds.add(workout.id)
                                        weekAcc[key].totalLifts += liftCount

                                        if (intensity !== null && liftCount > 0) {
                                            weekAcc[key].weightedIntensitySum += intensity * liftCount
                                            weekAcc[key].intensityLiftCount += liftCount
                                        }
                                    })

                                return weekAcc
                            },
                            {} as Record<
                                string,
                                {
                                    exerciseId: string
                                    exerciseName: string
                                    workoutIds: Set<string>
                                    totalLifts: number
                                    weightedIntensitySum: number
                                    intensityLiftCount: number
                                }
                            >
                        )
                    )
                        .map((metric) => ({
                            exerciseId: metric.exerciseId,
                            exerciseName: metric.exerciseName,
                            frequency: metric.workoutIds.size,
                            totalLifts: metric.totalLifts,
                            averageIntensity:
                                metric.intensityLiftCount > 0
                                    ? metric.weightedIntensitySum / metric.intensityLiftCount
                                    : null,
                        }))
                        .sort((left, right) =>
                            left.exerciseName.localeCompare(right.exerciseName, 'it', {
                                sensitivity: 'base',
                            })
                        )

                    return acc
                }, {} as Record<string, Array<{ exerciseId: string; exerciseName: string; frequency: number; totalLifts: number; averageIntensity: number | null }>>)
                : {},
        [estimatedOneRMByExercise, program]
    )

    const sbdMetricsByExerciseAcrossWeeks = useMemo(
        () =>
            program
                ? Array.from(
                    program.weeks.reduce((acc, week) => {
                        ; (weekSbdMetrics[week.id] || []).forEach((metric) => {
                            if (!acc.has(metric.exerciseId)) {
                                acc.set(metric.exerciseId, {
                                    exerciseId: metric.exerciseId,
                                    exerciseName: metric.exerciseName,
                                    metricsByWeekId: {},
                                })
                            }

                            const currentMetric = acc.get(metric.exerciseId)

                            if (currentMetric) {
                                currentMetric.metricsByWeekId[week.id] = metric
                            }
                        })

                        return acc
                    }, new Map<
                        string,
                        {
                            exerciseId: string
                            exerciseName: string
                            metricsByWeekId: Record<
                                string,
                                {
                                    exerciseId: string
                                    exerciseName: string
                                    frequency: number
                                    totalLifts: number
                                    averageIntensity: number | null
                                }
                            >
                        }
                    >())
                        .values()
                ).sort((left, right) =>
                    left.exerciseName.localeCompare(right.exerciseName, 'it', {
                        sensitivity: 'base',
                    })
                )
                : [],
        [program, weekSbdMetrics]
    )

    const handleWeekTypeChange = async (
        weekId: string,
        newType: 'normal' | 'test' | 'deload'
    ) => {
        if (!program || readOnly) return

        try {
            setSaving(true)

            const res = await fetch(`/api/weeks/${weekId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ weekType: newType }),
            })

            const data = await res.json()

            if (!res.ok) {
                throw new Error(getApiErrorMessage(data, t('editProgram.errorEditWeek'), t))
            }

            setProgram((currentProgram) => {
                if (!currentProgram) {
                    return currentProgram
                }

                return {
                    ...currentProgram,
                    weeks: currentProgram.weeks.map((week) =>
                        week.id === weekId ? { ...week, weekType: newType } : week
                    ),
                }
            })
        } catch (err: unknown) {
            showToast(err instanceof Error ? err.message : t('editProgram.errorEditWeek'), 'error')
        } finally {
            setSaving(false)
        }
    }

    const handleCopyWeekToNext = async () => {
        if (!confirmCopyNextWeek) return

        // Identify target week workout IDs before re-fetching
        const sourceWeek = confirmCopyNextWeek
        const targetWeek = program?.weeks.find(
            (w) => w.weekNumber === sourceWeek.weekNumber + 1
        )
        const targetWorkoutIds = targetWeek?.workouts.map((w) => w.id) ?? []

        try {
            setCopyingWeekId(confirmCopyNextWeek.id)

            const res = await fetch(`/api/programs/${programId}/copy-week`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sourceWeekId: confirmCopyNextWeek.id }),
            })
            const data = await res.json()

            if (!res.ok) {
                throw new Error(getApiErrorMessage(data, t('editProgram.copyWeekError'), t))
            }

            // Clear any draft rows for the target week's workouts
            if (targetWorkoutIds.length > 0) {
                setDraftRowIdsByWorkout((current) => {
                    const next = { ...current }
                    targetWorkoutIds.forEach((workoutId) => {
                        if (next[workoutId]) {
                            // Remove draft row entries from rowStateById too
                            const draftIds = next[workoutId]
                            setRowStateById((rows) => {
                                const nextRows = { ...rows }
                                draftIds.forEach((id) => {
                                    delete nextRows[id]
                                })
                                return nextRows
                            })
                            delete next[workoutId]
                        }
                    })
                    return next
                })
            }

            if (data.data?.updatedWeek) {
                const transformedWeek = transformApiWeek(data.data.updatedWeek, trainerIdRef.current) as Week
                setProgram((currentProgram) => {
                    if (!currentProgram) return currentProgram
                    return {
                        ...currentProgram,
                        weeks: currentProgram.weeks.map((week) =>
                            week.id === transformedWeek.id ? transformedWeek : week
                        ),
                    }
                })
            } else {
                await fetchProgram({ showLoading: false })
            }

            showToast(
                t('editProgram.copyWeekSuccess', {
                    sourceWeek: confirmCopyNextWeek.weekNumber,
                    targetWeek: confirmCopyNextWeek.weekNumber + 1,
                }),
                'success'
            )
            setConfirmCopyNextWeek(null)
        } catch (err: unknown) {
            showToast(err instanceof Error ? err.message : t('editProgram.copyWeekError'), 'error')
        } finally {
            setCopyingWeekId(null)
        }
    }

    const getWorkoutRows = useCallback(
        (workout: Workout) => {
            const persistedRows = workout.workoutExercises
                .map((workoutExercise) =>
                    rowStateById[workoutExercise.id] || buildEditableRow(workout.id, workoutExercise)
                )
                .sort((left, right) => left.order - right.order)

            const draftRows = (draftRowIdsByWorkout[workout.id] || [])
                .map((draftRowId) => rowStateById[draftRowId])
                .filter((row): row is EditableWorkoutExerciseRow => Boolean(row))
                .sort((left, right) => left.order - right.order)

            return [...persistedRows, ...draftRows]
        },
        [draftRowIdsByWorkout, rowStateById]
    )

    const handleDragEnd = useCallback(
        async (event: DragEndEvent, workout: Workout) => {
            const { active, over } = event
            if (!over || active.id === over.id) return

            const workoutRows = getWorkoutRows(workout).filter((row) => !row.isDraft)
            const oldIndex = workoutRows.findIndex((r) => r.id === active.id)
            const newIndex = workoutRows.findIndex((r) => r.id === over.id)
            if (oldIndex === -1 || newIndex === -1) return

            // Build new ordered array
            const reordered = [...workoutRows]
            const [moved] = reordered.splice(oldIndex, 1)
            reordered.splice(newIndex, 0, moved)

            // Optimistic update
            const previousOrders = Object.fromEntries(
                workoutRows.map((r) => [r.id, r.order])
            )
            setRowStateById((current) => {
                const next = { ...current }
                reordered.forEach((row, i) => {
                    if (next[row.id]) {
                        next[row.id] = { ...next[row.id], order: i + 1 }
                    }
                })
                return next
            })

            try {
                setReorderingWorkoutId(workout.id)
                const res = await fetch(
                    `/api/programs/${programId}/workouts/${workout.id}/exercises/reorder`,
                    {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            exercises: reordered.map((row, i) => ({
                                id: row.id,
                                order: i + 1,
                            })),
                        }),
                    }
                )

                if (!res.ok) {
                    const data = await res.json()
                    throw new Error(getApiErrorMessage(data, t('editProgram.rowReorderError'), t))
                }
            } catch (err) {
                // Revert optimistic update
                setRowStateById((current) => {
                    const next = { ...current }
                    workoutRows.forEach((row) => {
                        if (next[row.id]) {
                            next[row.id] = { ...next[row.id], order: previousOrders[row.id] }
                        }
                    })
                    return next
                })
                showToast(
                    err instanceof Error ? err.message : t('editProgram.rowReorderError'),
                    'error'
                )
            } finally {
                setReorderingWorkoutId(null)
            }
        },
        [getWorkoutRows, programId, showToast, t]
    )

    const hasWorkoutUnsavedChanges = useCallback(
        (workout: Workout): boolean => {
            const persistedRows = workout.workoutExercises
                .map((workoutExercise) => buildEditableRow(workout.id, workoutExercise))
                .sort((left, right) => left.order - right.order)

            const currentRows = [...getWorkoutRows(workout)].sort(
                (left, right) => left.order - right.order
            )

            if (currentRows.some((row) => row.isDraft)) {
                return true
            }

            if (currentRows.length !== persistedRows.length) {
                return true
            }

            const persistedRowsById = new Map(
                persistedRows.map((row) => [row.id, row] as const)
            )

            return currentRows.some((row) => {
                const persistedRow = persistedRowsById.get(row.id)

                if (!persistedRow) {
                    return true
                }

                return !areEditableRowsEquivalent(row, persistedRow)
            })
        },
        [getWorkoutRows]
    )

    const toggleWeekExpansion = (weekId: string) => {
        setExpandedWeekIds((currentExpandedWeekIds) => ({
            ...currentExpandedWeekIds,
            [weekId]: !currentExpandedWeekIds[weekId],
        }))
    }

    const toggleWorkoutExpansion = (workoutId: string) => {
        setExpandedWorkoutIds((currentExpandedWorkoutIds) => ({
            ...currentExpandedWorkoutIds,
            [workoutId]: !(currentExpandedWorkoutIds[workoutId] ?? true),
        }))
    }

    const updateRowFields = useCallback(
        (rowId: string, patch: Partial<EditableWorkoutExerciseRow>) => {
            setRowStateById((currentRows) => {
                if (!currentRows[rowId]) {
                    return currentRows
                }

                return {
                    ...currentRows,
                    [rowId]: {
                        ...currentRows[rowId],
                        ...patch,
                    },
                }
            })
        },
        []
    )

    const toggleCustomVariantInput = useCallback(
        ({
            rowId,
            currentVariant,
            variantOptions,
            selectedExercise,
        }: {
            rowId: string
            currentVariant: string
            variantOptions: string[]
            selectedExercise?: ExerciseCatalogItem
        }) => {
            if (!selectedExercise) {
                return
            }

            const currentMode =
                customVariantInputByRowId[rowId] ??
                Boolean(currentVariant.trim() !== '' && !variantOptions.includes(currentVariant))

            const nextMode = !currentMode

            if (!nextMode && currentVariant.trim() !== '' && !variantOptions.includes(currentVariant)) {
                updateRowFields(rowId, { variant: '' })
            }

            setCustomVariantInputByRowId((currentModes) => ({
                ...currentModes,
                [rowId]: nextMode,
            }))
        },
        [customVariantInputByRowId, updateRowFields]
    )

    const updateStructureRowFields = useCallback(
        (
            workoutIndex: number,
            rowId: string,
            patch: Partial<WorkoutStructureTemplateRow>
        ) => {
            setStructureRowsByWorkoutIndex((currentRowsByWorkoutIndex) => {
                const workoutRows = currentRowsByWorkoutIndex[workoutIndex] || []
                const rowIndex = workoutRows.findIndex((candidateRow) => candidateRow.id === rowId)

                if (rowIndex < 0) {
                    return currentRowsByWorkoutIndex
                }

                const nextWorkoutRows = [...workoutRows]
                nextWorkoutRows[rowIndex] = {
                    ...nextWorkoutRows[rowIndex],
                    ...patch,
                }

                return {
                    ...currentRowsByWorkoutIndex,
                    [workoutIndex]: nextWorkoutRows,
                }
            })
        },
        []
    )

    const addStructureRow = useCallback((workoutIndex: number) => {
        const rowId = `structure-${workoutIndex}-${Date.now()}-${Math.floor(Math.random() * 1000)}`

        setStructureRowsByWorkoutIndex((currentRowsByWorkoutIndex) => ({
            ...currentRowsByWorkoutIndex,
            [workoutIndex]: [
                ...(currentRowsByWorkoutIndex[workoutIndex] || []),
                {
                    id: rowId,
                    exerciseId: '',
                },
            ],
        }))
    }, [])

    const removeStructureRow = useCallback((workoutIndex: number, rowId: string) => {
        setStructureRowsByWorkoutIndex((currentRowsByWorkoutIndex) => {
            const workoutRows = currentRowsByWorkoutIndex[workoutIndex] || []
            const nextWorkoutRows = workoutRows.filter((candidateRow) => candidateRow.id !== rowId)

            return {
                ...currentRowsByWorkoutIndex,
                [workoutIndex]: nextWorkoutRows,
            }
        })
    }, [])

    const addDraftRow = (workoutId: string) => {
        if (readOnly || savingRowId || deletingRowId) {
            return
        }

        const workout = program?.weeks
            .flatMap((week) => week.workouts)
            .find((candidateWorkout) => candidateWorkout.id === workoutId)

        if (!workout) {
            return
        }

        const draftIds = draftRowIdsByWorkout[workoutId] || []
        const nextOrder = workout.workoutExercises.length + draftIds.length + 1
        const draftRowId = `draft-${workoutId}-${Date.now()}-${Math.floor(Math.random() * 1000)}`

        setRowStateById((currentRows) => ({
            ...currentRows,
            [draftRowId]: {
                id: draftRowId,
                workoutId,
                exerciseId: '',
                variant: '',
                sets: '',
                reps: '',
                targetRpe: '',
                weight: '',
                isWarmup: false,
                order: nextOrder,
                restTime: 'm2',
                notes: null,
                isDraft: true,
            },
        }))

        setDraftRowIdsByWorkout((currentDraftRows) => ({
            ...currentDraftRows,
            [workoutId]: [...(currentDraftRows[workoutId] || []), draftRowId],
        }))
    }

    const removeDraftRow = (rowId: string, workoutId: string) => {
        setDraftRowIdsByWorkout((currentDraftRows) => {
            const currentWorkoutDraftRows = currentDraftRows[workoutId] || []
            const nextWorkoutDraftRows = currentWorkoutDraftRows.filter((candidateRowId) => candidateRowId !== rowId)

            if (nextWorkoutDraftRows.length === 0) {
                const { [workoutId]: _removed, ...remainingDraftRows } = currentDraftRows
                return remainingDraftRows
            }

            return {
                ...currentDraftRows,
                [workoutId]: nextWorkoutDraftRows,
            }
        })

        setRowStateById((currentRows) => {
            const { [rowId]: _removed, ...nextRows } = currentRows
            return nextRows
        })
    }

    const resolveWeightInputForRow = ({
        row,
        rowIndex,
        orderedRows,
        effectiveWeightByRowId,
    }: {
        row: EditableWorkoutExerciseRow
        rowIndex: number
        orderedRows: EditableWorkoutExerciseRow[]
        effectiveWeightByRowId: Record<string, number | null>
    }): ResolveWeightInputOutcome => {
        const parsedInput = parseWeightInputValue(row.weight)

        if (parsedInput.mode === 'invalid') {
            return { errorCode: 'invalid_format' }
        }

        if (parsedInput.mode === 'empty') {
            return {
                parsedWeight: {
                    weightType: 'absolute',
                    weight: null,
                    effectiveWeight: null,
                },
            }
        }

        const value = parsedInput.value
        if (typeof value !== 'number' || !Number.isFinite(value)) {
            return { errorCode: 'invalid_format' }
        }

        if (parsedInput.mode === 'absolute') {
            if (value < 0) {
                return { errorCode: 'invalid_format' }
            }

            return {
                parsedWeight: {
                    weightType: 'absolute',
                    weight: value,
                    effectiveWeight: value,
                },
            }
        }

        if (parsedInput.mode === 'percentage_1rm') {
            if (value < 0) {
                return { errorCode: 'invalid_format' }
            }

            const oneRm = estimatedOneRMByExercise[row.exerciseId]
            if (!Number.isFinite(oneRm) || oneRm <= 0) {
                return { errorCode: 'missing_1rm' }
            }

            return {
                parsedWeight: {
                    weightType: 'percentage_1rm',
                    weight: value,
                    effectiveWeight: roundWeightValue((oneRm * value) / 100),
                },
            }
        }

        if (parsedInput.mode === 'percentage_rm') {
            if (value < 0) {
                return { errorCode: 'invalid_format' }
            }

            const targetReps = parseRepsValue(row.reps)
            const rmRecord = (recordsByExercise[row.exerciseId] || [])
                .filter((record) => record.reps === targetReps)
                .sort((left, right) => {
                    const leftDate = left.recordDate ? new Date(left.recordDate).getTime() : 0
                    const rightDate = right.recordDate ? new Date(right.recordDate).getTime() : 0
                    return rightDate - leftDate
                })[0]

            return {
                parsedWeight: {
                    weightType: 'percentage_rm',
                    weight: value,
                    effectiveWeight:
                        typeof rmRecord?.weight === 'number'
                            ? roundWeightValue((rmRecord.weight * value) / 100)
                            : null,
                },
            }
        }

        const previousRow = orderedRows
            .slice(0, rowIndex)
            .reverse()
            .find((candidateRow) => candidateRow.exerciseId === row.exerciseId)

        if (!previousRow) {
            return { errorCode: 'missing_previous_occurrence' }
        }

        const previousEffectiveWeight = effectiveWeightByRowId[previousRow.id]
        if (typeof previousEffectiveWeight !== 'number' || !Number.isFinite(previousEffectiveWeight)) {
            return { errorCode: 'missing_previous_weight' }
        }

        return {
            parsedWeight: {
                weightType: 'percentage_previous',
                weight: value,
                effectiveWeight: roundWeightValue(previousEffectiveWeight * (1 + value / 100)),
            },
        }
    }

    const buildWorkoutExercisePayload = (
        row: EditableWorkoutExerciseRow,
        parsedWeight: ParsedWeightInputResult
    ) => {
        const parsedSets = Number.parseInt(row.sets, 10)
        const parsedRpe = row.targetRpe.trim() === '' ? null : Number(row.targetRpe)

        return {
            exerciseId: row.exerciseId,
            variant: row.variant.trim() || null,
            order: row.order,
            sets: parsedSets,
            reps: row.reps.trim(),
            targetRpe: parsedRpe,
            weightType: parsedWeight.weightType,
            weight: parsedWeight.weight,
            effectiveWeight: parsedWeight.effectiveWeight,
            restTime: row.restTime,
            isWarmup: row.isWarmup,
            isSkeletonExercise: row.isDraft,
            notes: row.notes,
        }
    }

    const getBaseValidationError = (row: EditableWorkoutExerciseRow): string | null => {
        // Allow: number (8), range (8-10), drop-set (6/8), or keyword "max"
        const repsPattern = /^(\d+|\d+-\d+|\d+\/\d+|max)$/
        const parsedSets = Number.parseInt(row.sets, 10)
        const parsedRpe = row.targetRpe.trim() === '' ? null : Number(row.targetRpe)

        if (!row.exerciseId) {
            return t('editProgram.rowValidationExercise')
        }

        if (!Number.isInteger(parsedSets) || parsedSets < 1 || parsedSets > 20) {
            return t('editProgram.rowValidationSets')
        }

        if (!repsPattern.test(row.reps.trim())) {
            return t('editProgram.rowValidationReps')
        }

        if (
            parsedRpe !== null &&
            (!Number.isFinite(parsedRpe) ||
                parsedRpe < 5 ||
                parsedRpe > 10 ||
                (parsedRpe * 2) % 1 !== 0)
        ) {
            return t('editProgram.rowValidationRpe')
        }

        return null
    }

    const saveWorkoutRows = async (workout: Workout) => {
        if (readOnly) {
            return
        }

        const workoutRows = [...getWorkoutRows(workout)].sort((left, right) => left.order - right.order)

        if (workoutRows.length === 0) {
            showToast(t('editProgram.tableNoWorkoutExercises'), 'warning')
            return
        }

        const payloadByRowId: Record<string, ReturnType<typeof buildWorkoutExercisePayload>> = {}
        const effectiveWeightByRowId: Record<string, number | null> = {}

        for (let index = 0; index < workoutRows.length; index += 1) {
            const row = workoutRows[index]
            const validationError = getBaseValidationError(row)

            if (validationError) {
                showToast(
                    t('editProgram.rowValidationWithIndex', {
                        index: index + 1,
                        error: validationError,
                    }),
                    'warning'
                )
                return
            }

            const resolvedWeightInput = resolveWeightInputForRow({
                row,
                rowIndex: index,
                orderedRows: workoutRows,
                effectiveWeightByRowId,
            })

            if ('errorCode' in resolvedWeightInput) {
                const exerciseName =
                    exerciseNameById[row.exerciseId] ||
                    t('editProgram.tableExercise')

                if (
                    resolvedWeightInput.errorCode === 'missing_previous_occurrence' ||
                    resolvedWeightInput.errorCode === 'missing_previous_weight'
                ) {
                    setBlockingWeightErrorModal({
                        title: t('editProgram.weightModalPreviousTitle'),
                        message: t('editProgram.weightModalPreviousMessage', {
                            index: index + 1,
                            exercise: exerciseName,
                        }),
                    })
                    return
                }

                if (resolvedWeightInput.errorCode === 'missing_1rm') {
                    setBlockingWeightErrorModal({
                        title: t('editProgram.weightModalOneRmTitle'),
                        message: t('editProgram.weightModalOneRmMessage', {
                            index: index + 1,
                            exercise: exerciseName,
                        }),
                    })
                    return
                }

                showToast(
                    t('editProgram.rowValidationWithIndex', {
                        index: index + 1,
                        error: t('editProgram.rowValidationWeight'),
                    }),
                    'warning'
                )
                return
            }

            payloadByRowId[row.id] = buildWorkoutExercisePayload(
                row,
                resolvedWeightInput.parsedWeight
            )
            effectiveWeightByRowId[row.id] = resolvedWeightInput.parsedWeight.effectiveWeight
        }

        try {
            setSavingWorkoutId(workout.id)
            const savedDraftRowIds: string[] = []

            for (const row of workoutRows) {
                setSavingRowId(row.id)

                const payload = payloadByRowId[row.id]
                const endpoint = row.isDraft
                    ? `/api/programs/${programId}/workouts/${workout.id}/exercises`
                    : `/api/programs/${programId}/workouts/${workout.id}/exercises/${row.id}`

                const method = row.isDraft ? 'POST' : 'PUT'

                const res = await fetch(endpoint, {
                    method,
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                })

                const data = await res.json()

                if (!res.ok) {
                    throw new Error(
                        getApiErrorMessage(
                            data,
                            row.isDraft ? t('editProgram.rowSaveError') : t('editProgram.rowUpdateError'),
                            t
                        )
                    )
                }

                if (row.isDraft) {
                    savedDraftRowIds.push(row.id)
                }
            }

            // Batch-remove all saved draft rows in one state update BEFORE refetch
            if (savedDraftRowIds.length > 0) {
                setDraftRowIdsByWorkout((current) => {
                    const workoutDrafts = current[workout.id] ?? []
                    const remaining = workoutDrafts.filter((id) => !savedDraftRowIds.includes(id))
                    if (remaining.length === 0) {
                        const { [workout.id]: _removed, ...rest } = current
                        return rest
                    }
                    return { ...current, [workout.id]: remaining }
                })
                setRowStateById((current) => {
                    const next = { ...current }
                    savedDraftRowIds.forEach((id) => {
                        delete next[id]
                    })
                    return next
                })
            }

            await fetchProgram({ showLoading: false })
            showToast(t('editProgram.workoutRowsSavedSuccess'), 'success')
        } catch (err: unknown) {
            showToast(
                err instanceof Error ? err.message : t('editProgram.rowSaveGenericError'),
                'error'
            )
        } finally {
            setSavingRowId(null)
            setSavingWorkoutId(null)
        }
    }

    const deleteRow = async () => {
        if (!confirmDeleteRow) {
            return
        }

        const { rowId, workoutId, isDraft } = confirmDeleteRow

        if (isDraft) {
            removeDraftRow(rowId, workoutId)
            setConfirmDeleteRow(null)
            return
        }

        try {
            setDeletingRowId(rowId)

            const res = await fetch(
                `/api/programs/${programId}/workouts/${workoutId}/exercises/${rowId}`,
                {
                    method: 'DELETE',
                }
            )

            if (!res.ok) {
                const data = await res.json()
                throw new Error(getApiErrorMessage(data, t('editProgram.rowDeleteError'), t))
            }

            await fetchProgram({ showLoading: false })
            showToast(t('editProgram.rowDeletedSuccess'), 'success')
            setConfirmDeleteRow(null)
        } catch (err: unknown) {
            showToast(
                err instanceof Error ? err.message : t('editProgram.rowDeleteGenericError'),
                'error'
            )
        } finally {
            setDeletingRowId(null)
        }
    }

    const hasUnsavedWorkoutChanges = useMemo(() => {
        if (!program) {
            return false
        }

        return program.weeks.some((week) =>
            week.workouts.some((workout) => hasWorkoutUnsavedChanges(workout))
        )
    }, [hasWorkoutUnsavedChanges, program])

    const canProceedToReview = completedWorkouts === totalWorkouts && !hasUnsavedWorkoutChanges

    const applyStructureToAllWeeks = useCallback(() => {
        if (!program || readOnly) {
            return
        }

        const cleanedStructureByWorkoutIndex: Record<number, WorkoutStructureTemplateRow[]> =
            Object.entries(structureRowsByWorkoutIndex).reduce((acc, [workoutIndex, rows]) => {
                const normalizedRows = rows
                    .map((row) => ({
                        ...row,
                        exerciseId: row.exerciseId.trim(),
                    }))
                    .filter((row) => row.exerciseId.length > 0)

                acc[Number(workoutIndex)] = normalizedRows
                return acc
            }, {} as Record<number, WorkoutStructureTemplateRow[]>)

        const configuredRows = Object.values(cleanedStructureByWorkoutIndex).reduce(
            (total, rows) => total + rows.length,
            0
        )

        if (configuredRows === 0) {
            showToast(t('editProgram.structureNoExercisesWarning'), 'warning')
            return
        }

        setApplyingStructure(true)

        try {
            const nextRowsById = { ...rowStateById }
            const nextDraftRowsByWorkout = { ...draftRowIdsByWorkout }

            program.weeks.forEach((week) => {
                week.workouts.forEach((workout, workoutIndex) => {
                    const structureRows = cleanedStructureByWorkoutIndex[workoutIndex] || []
                    if (structureRows.length === 0) {
                        return
                    }

                    const existingRows = getWorkoutRows(workout)
                    const existingCountByKey = existingRows.reduce((acc, existingRow) => {
                        const key = existingRow.exerciseId
                        acc[key] = (acc[key] || 0) + 1
                        return acc
                    }, {} as Record<string, number>)
                    const templateSeenByKey: Record<string, number> = {}
                    let nextOrder = existingRows.length + 1

                    structureRows.forEach((structureRow) => {
                        const key = structureRow.exerciseId
                        templateSeenByKey[key] = (templateSeenByKey[key] || 0) + 1

                        if ((existingCountByKey[key] || 0) >= templateSeenByKey[key]) {
                            return
                        }

                        const draftRowId = `draft-${workout.id}-${Date.now()}-${Math.floor(Math.random() * 1000)}-${nextOrder}`
                        const draftRow: EditableWorkoutExerciseRow = {
                            id: draftRowId,
                            workoutId: workout.id,
                            exerciseId: structureRow.exerciseId,
                            variant: '',
                            sets: '',
                            reps: '',
                            targetRpe: '',
                            weight: '',
                            isWarmup: false,
                            order: nextOrder,
                            restTime: 'm2',
                            notes: null,
                            isDraft: true,
                        }

                        nextRowsById[draftRowId] = draftRow
                        nextDraftRowsByWorkout[workout.id] = [
                            ...(nextDraftRowsByWorkout[workout.id] || []),
                            draftRowId,
                        ]
                        existingCountByKey[key] = (existingCountByKey[key] || 0) + 1
                        existingRows.push(draftRow)
                        nextOrder += 1
                    })
                })
            })

            setRowStateById(nextRowsById)
            setDraftRowIdsByWorkout(nextDraftRowsByWorkout)
            setExpandedWeekIds(
                Object.fromEntries(program.weeks.map((week) => [week.id, true] as const))
            )
            setExpandedWorkoutIds(
                Object.fromEntries(
                    program.weeks.flatMap((week) =>
                        week.workouts.map((workout) => [workout.id, true] as const)
                    )
                )
            )
            setWizardStep('details')
            showToast(t('editProgram.structureAppliedSuccess'), 'success')
        } finally {
            setApplyingStructure(false)
        }
    }, [
        draftRowIdsByWorkout,
        getWorkoutRows,
        program,
        readOnly,
        rowStateById,
        showToast,
        structureRowsByWorkoutIndex,
        t,
    ])

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <LoadingSpinner size="lg" color="primary" />
            </div>
        )
    }

    if (error || !program) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="bg-red-50 border border-red-200 text-red-800 px-6 py-4 rounded-lg">
                    {error || t('editProgram.notFound')}
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gray-50">
            <div className="max-w-[1700px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {!readOnly && (
                    <div className="mb-8">
                        <div className="flex flex-wrap items-center justify-center gap-4 mb-4">
                            <div className="flex items-center">
                                <div className="w-10 h-10 bg-green-500 text-white rounded-full flex items-center justify-center font-bold">
                                    ✓
                                </div>
                                <span className="ml-2 font-semibold text-gray-900">{t('editProgram.stepSetup')}</span>
                            </div>
                            <div className="w-16 h-1 bg-brand-primary"></div>
                            <div className="flex items-center">
                                <div
                                    className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${wizardStep === 'structure'
                                        ? 'bg-brand-primary text-white'
                                        : 'bg-green-500 text-white'
                                        }`}
                                >
                                    {wizardStep === 'structure' ? '2' : '✓'}
                                </div>
                                <span
                                    className={`ml-2 ${wizardStep === 'structure' ? 'font-semibold text-gray-900' : 'text-gray-500'
                                        }`}
                                >
                                    {t('editProgram.stepStructure')}
                                </span>
                            </div>
                            <div
                                className={`w-16 h-1 ${wizardStep === 'details' ? 'bg-brand-primary' : 'bg-gray-300'
                                    }`}
                            ></div>
                            <div className="flex items-center">
                                <div
                                    className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${wizardStep === 'details'
                                        ? 'bg-brand-primary text-white'
                                        : 'bg-gray-300 text-gray-600'
                                        }`}
                                >
                                    3
                                </div>
                                <span
                                    className={`ml-2 ${wizardStep === 'details' ? 'font-semibold text-gray-900' : 'text-gray-500'
                                        }`}
                                >
                                    {t('editProgram.stepExercises')}
                                </span>
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
                )}

                <div className="mb-8">
                    <Link
                        href={backHref}
                        className="text-brand-primary hover:text-brand-primary/80 text-sm font-semibold mb-4 inline-flex items-center gap-1"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        {backLabel}
                    </Link>
                    <div className="flex items-start justify-between gap-4">
                        <div>
                            <h1 className="text-3xl font-bold text-gray-900">{program.title}</h1>
                            <p className="text-gray-600 mt-2">
                                {t('editProgram.forTrainee', {
                                    name: `${program.trainee.firstName} ${program.trainee.lastName}`,
                                })}{' '}
                                •{' '}
                                {t('editProgram.programMeta', {
                                    duration: program.durationWeeks,
                                    perWeek: program.workoutsPerWeek,
                                })}
                            </p>
                        </div>
                        <div>
                            {readOnly && program.status === 'draft' && (
                                <Link
                                    href={editProgramHref}
                                    className="bg-brand-primary hover:bg-brand-primary-hover text-white font-semibold py-2 px-4 rounded-lg transition-colors inline-flex items-center gap-2"
                                >
                                    <FileEdit className="w-4 h-4" />
                                    {t('editProgram.editProgram', 'Modifica Programma')}
                                </Link>
                            )}
                            {!readOnly && (
                                <EditProgramMetadata
                                    programId={programId}
                                    initialTitle={program.title}
                                    initialTraineeId={program.trainee.id}
                                    initialIsSbdProgram={program.isSbdProgram}
                                    initialDurationWeeks={program.durationWeeks}
                                    initialWorkoutsPerWeek={program.workoutsPerWeek}
                                    status={program.status}
                                    onUpdate={() => void fetchProgram({ showLoading: false })}
                                />
                            )}
                        </div>
                    </div>
                </div>

                {!readOnly && wizardStep === 'structure' && (
                    <section className="rounded-xl border border-gray-200 bg-white shadow-sm">
                        <div className="border-b border-gray-100 px-5 py-4">
                            <h2 className="text-xl font-bold text-gray-900">
                                {t('editProgram.structureTitle')}
                            </h2>
                            <p className="mt-1 text-sm text-gray-600">
                                {t('editProgram.structureDescription')}
                            </p>
                        </div>

                        <div className="overflow-x-auto p-5">
                            <div
                                className="grid min-w-full gap-4"
                                style={{
                                    gridTemplateColumns: `repeat(${program.workoutsPerWeek}, minmax(260px, 1fr))`,
                                }}
                            >
                                {Array.from({ length: program.workoutsPerWeek }).map((_, workoutIndex) => {
                                    const structureRows = structureRowsByWorkoutIndex[workoutIndex] || []

                                    return (
                                        <div
                                            key={`structure-workout-${workoutIndex}`}
                                            className="min-w-0 rounded-lg border border-gray-200 bg-white"
                                        >
                                            <div className="flex flex-col gap-2 border-b border-gray-100 px-4 py-3">
                                                <div>
                                                    <h3 className="text-base font-bold text-gray-900">
                                                        {t('editProgram.workoutFallback', {
                                                            number: workoutIndex + 1,
                                                        })}
                                                    </h3>
                                                    <p className="text-xs text-gray-500">
                                                        {t('editProgram.exercisesCount', {
                                                            count: structureRows.length,
                                                        })}
                                                    </p>
                                                </div>

                                                <button
                                                    type="button"
                                                    onClick={() => addStructureRow(workoutIndex)}
                                                    className="inline-flex items-center justify-center gap-2 rounded-lg border border-brand-primary/20 bg-brand-primary/10 px-3 py-2 text-sm font-semibold text-brand-primary hover:bg-brand-primary/15"
                                                >
                                                    <Plus className="h-4 w-4" />
                                                    {t('editProgram.addRow')}
                                                </button>
                                            </div>

                                            <div className="space-y-2 p-3">
                                                {structureRows.length === 0 && (
                                                    <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 px-3 py-4 text-center text-sm text-gray-500">
                                                        {t('editProgram.structureNoRows')}
                                                    </div>
                                                )}

                                                {structureRows.map((structureRow) => {
                                                    const selectedExercise = structureRow.exerciseId
                                                        ? exerciseLookupById.get(structureRow.exerciseId)
                                                        : undefined
                                                    const rowStyle = getMovementPatternRowStyle(
                                                        selectedExercise?.movementPattern?.color
                                                    )

                                                    return (
                                                        <div
                                                            key={structureRow.id}
                                                            className="rounded-lg border border-gray-200 border-l-4 border-l-transparent p-2"
                                                            style={rowStyle}
                                                        >
                                                            <div className="flex items-center gap-2">
                                                                <AutocompleteSearch
                                                                    id={`structure-exercise-${workoutIndex}-${structureRow.id}`}
                                                                    options={autocompleteExerciseOptions}
                                                                    value={structureRow.exerciseId || undefined}
                                                                    onSelect={(option) => {
                                                                        updateStructureRowFields(
                                                                            workoutIndex,
                                                                            structureRow.id,
                                                                            {
                                                                                exerciseId: option?.id ?? '',
                                                                            }
                                                                        )
                                                                    }}
                                                                    placeholder={t('editProgram.selectExercise')}
                                                                    className="min-w-0 flex-1"
                                                                />

                                                                <ActionIconButton
                                                                    variant="delete"
                                                                    label={t('editProgram.deleteRowTitle')}
                                                                    onClick={() =>
                                                                        removeStructureRow(
                                                                            workoutIndex,
                                                                            structureRow.id
                                                                        )
                                                                    }
                                                                />
                                                            </div>

                                                            <div className="mt-2 flex items-center gap-1.5">
                                                                {selectedExercise ? (
                                                                    <>
                                                                        <span
                                                                            className={`inline-flex w-fit rounded-full px-2 py-0.5 text-[10px] font-semibold ${selectedExercise.type ===
                                                                                'fundamental'
                                                                                ? 'bg-red-100 text-red-700'
                                                                                : 'bg-blue-100 text-blue-700'
                                                                                }`}
                                                                        >
                                                                            {selectedExercise.type === 'fundamental'
                                                                                ? 'F'
                                                                                : 'A'}
                                                                        </span>
                                                                        {selectedExercise.movementPattern && (
                                                                            <MovementPatternTag
                                                                                name={selectedExercise.movementPattern.name}
                                                                                color={selectedExercise.movementPattern.color}
                                                                                className="w-fit"
                                                                            />
                                                                        )}
                                                                    </>
                                                                ) : (
                                                                    <span className="text-xs text-gray-500">
                                                                        {t('editProgram.tableMeta')}: -
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    </section>
                )}

                {!readOnly && wizardStep === 'structure' && (
                    <div className="flex space-x-4 mt-8 mb-8">
                        <button
                            type="button"
                            onClick={applyStructureToAllWeeks}
                            disabled={applyingStructure}
                            className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-brand-primary px-6 py-3 font-semibold text-white transition-colors hover:bg-brand-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            {applyingStructure ? (
                                <LoadingSpinner size="sm" color="white" />
                            ) : (
                                <Dumbbell className="h-4 w-4" />
                            )}
                            {t('editProgram.structureApplyAndContinue')}
                        </button>
                        <Link
                            href="/trainer/programs"
                            className="bg-gray-300 hover:bg-gray-400 text-gray-800 font-semibold py-3 px-6 rounded-lg transition-colors"
                        >
                            {t('editProgram.saveDraft')}
                        </Link>
                    </div>
                )}

                <div className={!readOnly && wizardStep === 'structure' ? 'hidden' : ''}>
                    {!readOnly && (
                        <div className="mb-4 flex justify-end">
                            <button
                                type="button"
                                onClick={() => setWizardStep('structure')}
                                className="inline-flex items-center gap-2 rounded-lg border border-brand-primary/20 bg-brand-primary/10 px-3 py-2 text-sm font-semibold text-brand-primary hover:bg-brand-primary/15"
                            >
                                <FileEdit className="h-4 w-4" />
                                {t('editProgram.editStructureStepButton')}
                            </button>
                        </div>
                    )}

                    <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 mb-6">
                        <div
                            className={`bg-white rounded-lg border border-gray-200 shadow-sm p-4 ${shouldShowSbdReporting ? 'xl:col-span-1' : 'xl:col-span-3'
                                }`}
                        >
                            <button
                                type="button"
                                onClick={() => setIsPrHelperCollapsed((current) => !current)}
                                className="w-full flex items-start justify-between gap-3 text-left"
                                aria-expanded={!isPrHelperCollapsed}
                            >
                                <div className="flex items-center gap-2">
                                    <div className="rounded-lg bg-brand-primary text-white p-2">
                                        <Dumbbell className="w-4 h-4" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-semibold text-gray-900">
                                            {t('editProgram.prHelperTitle')}
                                        </p>
                                        <p className="text-xs text-gray-500">
                                            {t('editProgram.prHelperDescription')}
                                        </p>
                                    </div>
                                </div>
                                <span className="rounded-full border border-gray-200 bg-gray-50 p-2 text-gray-500">
                                    {isPrHelperCollapsed ? (
                                        <ChevronDown className="w-4 h-4" />
                                    ) : (
                                        <ChevronUp className="w-4 h-4" />
                                    )}
                                </span>
                            </button>

                            {!isPrHelperCollapsed && (
                                <div className="mt-4 max-h-72 overflow-y-auto">
                                    {bestPRs.length > 0 ? (
                                        <div className="space-y-2">
                                            {bestPRs.map((record) => {
                                                const label =
                                                    record.exercise?.name ||
                                                    exerciseNameById[record.exerciseId] ||
                                                    t('editProgram.tableExercise')

                                                const type =
                                                    record.exercise?.type ||
                                                    exerciseLookupById.get(record.exerciseId)?.type ||
                                                    'accessory'

                                                return (
                                                    <div
                                                        key={`${record.exerciseId}-${record.id || record.reps}`}
                                                        className="rounded-lg border border-gray-200 px-3 py-2"
                                                    >
                                                        <div className="flex items-start justify-between gap-2">
                                                            <div>
                                                                <p className="text-sm font-semibold text-gray-900">
                                                                    {label}
                                                                </p>
                                                                <p className="text-xs text-gray-500">
                                                                    {t('editProgram.prRecordFormat', {
                                                                        weight: record.weight,
                                                                        reps: record.reps,
                                                                    })}
                                                                </p>
                                                            </div>
                                                            <span
                                                                className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${type === 'fundamental'
                                                                    ? 'bg-red-100 text-red-700'
                                                                    : 'bg-blue-100 text-blue-700'
                                                                    }`}
                                                            >
                                                                {type === 'fundamental' ? 'F' : 'A'}
                                                            </span>
                                                        </div>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    ) : (
                                        <p className="text-sm text-gray-500 py-3">
                                            {t('editProgram.prHelperNoData')}
                                        </p>
                                    )}
                                </div>
                            )}
                        </div>

                        {shouldShowSbdReporting && (
                            <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4 xl:col-span-2">
                                <button
                                    type="button"
                                    onClick={() => setIsSbdHelperCollapsed((current) => !current)}
                                    className="w-full flex items-start justify-between gap-3 text-left"
                                    aria-expanded={!isSbdHelperCollapsed}
                                >
                                    <div className="flex items-center gap-2">
                                        <div className="rounded-lg bg-slate-900 text-white p-2">
                                            <BarChart3 className="w-4 h-4" />
                                        </div>
                                        <div>
                                            <p className="text-sm font-semibold text-gray-900">
                                                {t('editProgram.sbdHelperTitle')}
                                            </p>
                                            <p className="text-xs text-gray-500">
                                                {t('editProgram.sbdHelperDescription')}
                                            </p>
                                        </div>
                                    </div>
                                    <span className="rounded-full border border-gray-200 bg-gray-50 p-2 text-gray-500">
                                        {isSbdHelperCollapsed ? (
                                            <ChevronDown className="w-4 h-4" />
                                        ) : (
                                            <ChevronUp className="w-4 h-4" />
                                        )}
                                    </span>
                                </button>

                                {!isSbdHelperCollapsed && (
                                    <div className="mt-4 max-h-72 overflow-y-auto">
                                        {sbdMetricsByExerciseAcrossWeeks.length > 0 ? (
                                            <div className="overflow-x-auto">
                                                <table className="min-w-[780px] w-full divide-y divide-slate-200 text-xs">
                                                    <thead className="bg-slate-50 text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                                                        <tr>
                                                            <th className="sticky left-0 z-10 bg-slate-50 px-3 py-2 text-left">
                                                                {t('editProgram.tableExercise')}
                                                            </th>
                                                            {program.weeks.map((week) => (
                                                                <th key={week.id} className="px-3 py-2 text-left whitespace-nowrap">
                                                                    {t('editProgram.week')} {week.weekNumber}
                                                                </th>
                                                            ))}
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-slate-100 bg-white">
                                                        {sbdMetricsByExerciseAcrossWeeks.map((exerciseMetric) => (
                                                            <tr key={exerciseMetric.exerciseId}>
                                                                <td className="sticky left-0 z-10 bg-white px-3 py-2 align-top text-sm font-semibold text-slate-900 whitespace-nowrap">
                                                                    {exerciseMetric.exerciseName}
                                                                </td>
                                                                {program.weeks.map((week) => {
                                                                    const metric =
                                                                        exerciseMetric.metricsByWeekId[week.id]

                                                                    return (
                                                                        <td key={week.id} className="px-3 py-2 align-top">
                                                                            {metric ? (
                                                                                <div className="space-y-0.5 text-[11px] text-slate-700">
                                                                                    <p>
                                                                                        <span className="font-semibold text-slate-500">
                                                                                            {t('editProgram.sbdFrq')}:
                                                                                        </span>{' '}
                                                                                        <span className="font-semibold text-slate-900">
                                                                                            {metric.frequency}
                                                                                        </span>
                                                                                    </p>
                                                                                    <p>
                                                                                        <span className="font-semibold text-slate-500">
                                                                                            {t('editProgram.sbdNbl')}:
                                                                                        </span>{' '}
                                                                                        <span className="font-semibold text-slate-900">
                                                                                            {metric.totalLifts}
                                                                                        </span>
                                                                                    </p>
                                                                                    <p>
                                                                                        <span className="font-semibold text-slate-500">
                                                                                            {t('editProgram.sbdIm')}:
                                                                                        </span>{' '}
                                                                                        <span className="font-semibold text-slate-900">
                                                                                            {metric.averageIntensity !== null
                                                                                                ? `${metric.averageIntensity.toFixed(1)}%`
                                                                                                : '-'}
                                                                                        </span>
                                                                                    </p>
                                                                                </div>
                                                                            ) : (
                                                                                <span className="text-[11px] text-slate-400">-</span>
                                                                            )}
                                                                        </td>
                                                                    )
                                                                })}
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        ) : (
                                            <p className="text-sm text-gray-500 py-3">
                                                {t('editProgram.sbdHelperNoData')}
                                            </p>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    <div className="space-y-5">
                        {program.weeks.map((week) => {
                            const isExpanded = expandedWeekIds[week.id] ?? false
                            const isActive = activeWeek?.id === week.id

                            const configuredWorkoutsForWeek = week.workouts.filter(
                                (workout) => workout.workoutExercises.length > 0
                            ).length

                            return (
                                <section
                                    key={week.id}
                                    className={`rounded-xl border bg-white shadow-sm ${isActive ? 'border-brand-primary' : 'border-gray-200'
                                        }`}
                                >
                                    <div className="px-4 py-4 border-b border-gray-100">
                                        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                                            <div className="flex items-center gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setActiveWeekId(week.id)
                                                        toggleWeekExpansion(week.id)
                                                    }}
                                                    className="flex items-center gap-3 text-left"
                                                >
                                                    <span className="text-lg font-bold text-gray-900">
                                                        {t('editProgram.week')} {week.weekNumber}
                                                    </span>
                                                    <span className="text-xs font-semibold text-gray-500">
                                                        {t('editProgram.workoutsConfiguredShort', {
                                                            done: configuredWorkoutsForWeek,
                                                            total: week.workouts.length,
                                                        })}
                                                    </span>
                                                    <span className="rounded-full border border-gray-200 bg-gray-50 p-1 text-gray-500">
                                                        {isExpanded ? (
                                                            <ChevronUp className="w-4 h-4" />
                                                        ) : (
                                                            <ChevronDown className="w-4 h-4" />
                                                        )}
                                                    </span>
                                                </button>

                                                {!readOnly && week.weekNumber < program.weeks.length && (
                                                    <button
                                                        type="button"
                                                        onClick={() => setConfirmCopyNextWeek(week)}
                                                        disabled={copyingWeekId !== null || saving}
                                                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-brand-primary/20 bg-brand-primary/10 text-brand-primary hover:bg-brand-primary/15 disabled:cursor-not-allowed disabled:opacity-60"
                                                        title={t('editProgram.copyCurrentWeekToNextTooltip')}
                                                        aria-label={t('editProgram.copyCurrentWeekToNextTooltip')}
                                                    >
                                                        {copyingWeekId === week.id ? (
                                                            <LoadingSpinner size="sm" color="primary" />
                                                        ) : (
                                                            <Copy className="w-4 h-4" />
                                                        )}
                                                    </button>
                                                )}
                                            </div>

                                            <div className="flex flex-wrap items-center gap-2">
                                                {readOnly ? (
                                                    <WeekTypeBadge
                                                        weekType={week.weekType}
                                                        labels={weekTypeBadgeLabels}
                                                    />
                                                ) : (
                                                    <>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleWeekTypeChange(week.id, 'normal')}
                                                            disabled={saving}
                                                            className={`rounded-full transition-all disabled:cursor-not-allowed disabled:opacity-60 ${week.weekType === 'normal'
                                                                ? 'ring-2 ring-gray-500 ring-offset-1'
                                                                : 'opacity-70 hover:opacity-100'
                                                                }`}
                                                        >
                                                            <WeekTypeBadge weekType="normal" labels={weekTypeBadgeLabels} />
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleWeekTypeChange(week.id, 'test')}
                                                            disabled={saving}
                                                            className={`rounded-full transition-all disabled:cursor-not-allowed disabled:opacity-60 ${week.weekType === 'test'
                                                                ? 'ring-2 ring-week-test ring-offset-1'
                                                                : 'opacity-70 hover:opacity-100'
                                                                }`}
                                                        >
                                                            <WeekTypeBadge weekType="test" labels={weekTypeBadgeLabels} />
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleWeekTypeChange(week.id, 'deload')}
                                                            disabled={saving}
                                                            className={`rounded-full transition-all disabled:cursor-not-allowed disabled:opacity-60 ${week.weekType === 'deload'
                                                                ? 'ring-2 ring-week-deload ring-offset-1'
                                                                : 'opacity-70 hover:opacity-100'
                                                                }`}
                                                        >
                                                            <WeekTypeBadge weekType="deload" labels={weekTypeBadgeLabels} />
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {isExpanded && (
                                        <div className="p-4 space-y-6">
                                            {week.workouts.map((workout, workoutIndex) => {
                                                const workoutRows = [...getWorkoutRows(workout)].sort(
                                                    (left, right) => left.order - right.order
                                                )
                                                const workoutHasUnsavedChanges =
                                                    hasWorkoutUnsavedChanges(workout)
                                                const effectiveWeightPreviewByRowId: Record<string, number | null> = {}
                                                const persistedEffectiveWeightByRowId =
                                                    workout.workoutExercises.reduce(
                                                        (acc, workoutExercise) => {
                                                            acc[workoutExercise.id] =
                                                                workoutExercise.effectiveWeight
                                                            return acc
                                                        },
                                                        {} as Record<string, number | null>
                                                    )
                                                const workoutLabel = t('editProgram.workoutFallback', {
                                                    number: workoutIndex + 1,
                                                })
                                                const isWorkoutExpanded =
                                                    expandedWorkoutIds[workout.id] ?? true
                                                const isRepsHintOpen =
                                                    openHeaderHint?.workoutId === workout.id &&
                                                    openHeaderHint.field === 'reps'
                                                const isWeightHintOpen =
                                                    openHeaderHint?.workoutId === workout.id &&
                                                    openHeaderHint.field === 'weight'

                                                return (
                                                    <div
                                                        key={workout.id}
                                                        className="rounded-lg border border-gray-200 bg-white"
                                                    >
                                                        <div
                                                            className={`px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 ${isWorkoutExpanded
                                                                ? 'border-b border-gray-100'
                                                                : ''
                                                                }`}
                                                        >
                                                            <button
                                                                type="button"
                                                                onClick={() => toggleWorkoutExpansion(workout.id)}
                                                                className="flex items-center gap-2 text-left"
                                                            >
                                                                <h4 className="text-lg font-bold text-gray-900">
                                                                    {workoutLabel}
                                                                </h4>
                                                                <span className="text-xs font-semibold text-gray-500">
                                                                    {t('editProgram.exercisesCount', {
                                                                        count: workoutRows.length,
                                                                    })}
                                                                </span>
                                                                <span className="rounded-full border border-gray-200 bg-gray-50 p-1 text-gray-500">
                                                                    {isWorkoutExpanded ? (
                                                                        <ChevronUp className="w-4 h-4" />
                                                                    ) : (
                                                                        <ChevronDown className="w-4 h-4" />
                                                                    )}
                                                                </span>
                                                            </button>
                                                            {!readOnly && (
                                                                <div className="inline-flex items-center gap-2">
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => addDraftRow(workout.id)}
                                                                        disabled={Boolean(savingRowId || deletingRowId || savingWorkoutId)}
                                                                        className="inline-flex items-center gap-2 rounded-lg border border-brand-primary/20 bg-brand-primary/10 px-3 py-2 text-sm font-semibold text-brand-primary hover:bg-brand-primary/15 disabled:cursor-not-allowed disabled:opacity-60"
                                                                    >
                                                                        <Plus className="w-4 h-4" />
                                                                        {t('editProgram.addRow')}
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => {
                                                                            void saveWorkoutRows(workout)
                                                                        }}
                                                                        disabled={
                                                                            Boolean(
                                                                                savingRowId ||
                                                                                deletingRowId ||
                                                                                savingWorkoutId
                                                                            ) || !workoutHasUnsavedChanges
                                                                        }
                                                                        className="inline-flex items-center gap-2 rounded-lg bg-brand-primary px-3 py-2 text-sm font-semibold text-white hover:bg-brand-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
                                                                        title={t('editProgram.saveRowTitle')}
                                                                    >
                                                                        {savingWorkoutId === workout.id ? (
                                                                            <LoadingSpinner size="sm" color="white" />
                                                                        ) : (
                                                                            <Save className="w-4 h-4" />
                                                                        )}
                                                                        {t('editProgram.saveRowTitle')}
                                                                    </button>
                                                                </div>
                                                            )}
                                                        </div>

                                                        {isWorkoutExpanded && (
                                                            <div className="overflow-x-auto">
                                                                <DndContext
                                                                    sensors={dndSensors}
                                                                    collisionDetection={closestCenter}
                                                                    onDragEnd={(event) =>
                                                                        void handleDragEnd(event, workout)
                                                                    }
                                                                >
                                                                    <SortableContext
                                                                        items={workoutRows
                                                                            .filter((r) => !r.isDraft)
                                                                            .map((r) => r.id)}
                                                                        strategy={verticalListSortingStrategy}
                                                                        disabled={
                                                                            readOnly ||
                                                                            reorderingWorkoutId !== null
                                                                        }
                                                                    >
                                                                        <table className="w-full table-fixed divide-y divide-gray-200 text-sm">
                                                                    <colgroup>
                                                                        <col className="w-[3%]" />
                                                                        <col className="w-[4%]" />
                                                                        <col className="w-[22%]" />
                                                                        <col className="w-[22%]" />
                                                                        <col className="w-[7%]" />
                                                                        <col className="w-[7%]" />
                                                                        <col className="w-[7%]" />
                                                                        <col className="w-[7%]" />
                                                                        <col className="w-[7%]" />
                                                                        <col className="w-[7%]" />
                                                                    </colgroup>
                                                                    <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
                                                                        <tr>
                                                                            <th className="w-6 px-0.5 py-3">
                                                                                <span className="sr-only">{t('editProgram.dragHandleLabel')}</span>
                                                                            </th>
                                                                            <th className="px-1 py-3 text-center">
                                                                                <span
                                                                                    className="inline-flex items-center justify-center w-full"
                                                                                    title={t('editProgram.tableWarmup')}
                                                                                    aria-label={t('editProgram.tableWarmup')}
                                                                                >
                                                                                    <Flame className="w-3.5 h-3.5 text-week-test" />
                                                                                    <span className="sr-only">
                                                                                        {t('editProgram.tableWarmup')}
                                                                                    </span>
                                                                                </span>
                                                                            </th>
                                                                            <th className="px-1 py-3">{t('editProgram.tableExercise')}</th>
                                                                            <th className="px-1 py-3">{t('editProgram.tableVariant')}</th>
                                                                            <th className="px-1 py-3">{t('editProgram.tableSets')}</th>
                                                                            <th className="relative px-1 py-3">
                                                                                <div className="flex items-center justify-start gap-1">
                                                                                    <span>{t('editProgram.tableReps')}</span>
                                                                                    {!readOnly && (
                                                                                        <button
                                                                                            type="button"
                                                                                            onClick={() =>
                                                                                                setOpenHeaderHint((currentHint) =>
                                                                                                    currentHint?.workoutId === workout.id &&
                                                                                                        currentHint.field === 'reps'
                                                                                                        ? null
                                                                                                        : {
                                                                                                            workoutId: workout.id,
                                                                                                            field: 'reps',
                                                                                                        }
                                                                                                )
                                                                                            }
                                                                                            data-header-hint-trigger="true"
                                                                                            className="inline-flex h-4 w-4 items-center justify-center rounded text-gray-500 hover:text-brand-primary"
                                                                                            aria-label={t('editProgram.repsPlaceholder')}
                                                                                            aria-expanded={isRepsHintOpen}
                                                                                        >
                                                                                            <Info className="h-3.5 w-3.5" />
                                                                                        </button>
                                                                                    )}
                                                                                </div>
                                                                                {!readOnly && isRepsHintOpen && (
                                                                                    <div
                                                                                        data-header-hint-popover="true"
                                                                                        className="absolute left-1 top-full mt-1 w-44 rounded-md border border-gray-200 bg-white p-2 text-[11px] normal-case tracking-normal text-gray-600 shadow-lg"
                                                                                        style={{ zIndex: 2147483647 }}
                                                                                    >
                                                                                        {t('editProgram.repsPlaceholder')}
                                                                                    </div>
                                                                                )}
                                                                            </th>
                                                                            <th className="px-1 py-3">{t('editProgram.tableRpe')}</th>
                                                                            <th className="relative px-1 py-3">
                                                                                <div className="flex items-center justify-start gap-1">
                                                                                    <span>{t('editProgram.tableWeightKg')}</span>
                                                                                    {!readOnly && (
                                                                                        <button
                                                                                            type="button"
                                                                                            onClick={() =>
                                                                                                setOpenHeaderHint((currentHint) =>
                                                                                                    currentHint?.workoutId === workout.id &&
                                                                                                        currentHint.field === 'weight'
                                                                                                        ? null
                                                                                                        : {
                                                                                                            workoutId: workout.id,
                                                                                                            field: 'weight',
                                                                                                        }
                                                                                                )
                                                                                            }
                                                                                            data-header-hint-trigger="true"
                                                                                            className="inline-flex h-4 w-4 items-center justify-center rounded text-gray-500 hover:text-brand-primary"
                                                                                            aria-label={t('editProgram.weightPlaceholder')}
                                                                                            aria-expanded={isWeightHintOpen}
                                                                                        >
                                                                                            <Info className="h-3.5 w-3.5" />
                                                                                        </button>
                                                                                    )}
                                                                                </div>
                                                                                {!readOnly && isWeightHintOpen && (
                                                                                    <div
                                                                                        data-header-hint-popover="true"
                                                                                        className="absolute left-1 top-full mt-1 w-52 rounded-md border border-gray-200 bg-white p-2 text-[11px] normal-case tracking-normal text-gray-600 shadow-lg"
                                                                                        style={{ zIndex: 2147483647 }}
                                                                                    >
                                                                                        {t('editProgram.weightPlaceholder')}
                                                                                    </div>
                                                                                )}
                                                                            </th>
                                                                            <th className="px-1 py-3">{t('editProgram.tableRest')}</th>
                                                                            <th className="px-1 py-3 whitespace-nowrap text-[10px] normal-case tracking-normal">
                                                                                <span className="sr-only">
                                                                                    {readOnly
                                                                                        ? t('editProgram.tableMeta')
                                                                                        : `${t('editProgram.tableMeta')}/${t('editProgram.tableActions')}`}
                                                                                </span>
                                                                            </th>
                                                                        </tr>
                                                                    </thead>
                                                                    <tbody className="divide-y divide-gray-100 bg-white">
                                                                        {workoutRows.length === 0 && (
                                                                            <tr>
                                                                                <td
                                                                                    colSpan={9}
                                                                                    className="px-1 py-6 text-center text-sm text-gray-500"
                                                                                >
                                                                                    {t('editProgram.tableNoWorkoutExercises')}
                                                                                </td>
                                                                            </tr>
                                                                        )}

                                                                        {workoutRows.map((row, rowIndex) => {
                                                                            const selectedExercise = row.exerciseId
                                                                                ? exerciseLookupById.get(row.exerciseId)
                                                                                : undefined

                                                                            const variantOptions = selectedExercise?.notes || []
                                                                            const isCustomVariantInput =
                                                                                customVariantInputByRowId[row.id] ??
                                                                                Boolean(
                                                                                    row.variant.trim() !== '' &&
                                                                                    !variantOptions.includes(row.variant)
                                                                                )
                                                                            const variantFieldClassName =
                                                                                'h-9 w-full rounded-lg border border-gray-300 px-1.5 text-sm leading-5 focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary disabled:bg-gray-50 disabled:text-gray-400'
                                                                            const metricFieldClassName =
                                                                                'h-9 w-full rounded-lg border border-gray-300 px-1.5 text-left text-sm leading-5 focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary disabled:bg-gray-50 disabled:text-gray-400'
                                                                            const rowBusy =
                                                                                savingRowId === row.id ||
                                                                                deletingRowId === row.id ||
                                                                                savingWorkoutId === workout.id
                                                                            const parsedWeightInputForPreview = parseWeightInputValue(
                                                                                row.weight
                                                                            )
                                                                            const resolvedWeightInputForPreview =
                                                                                resolveWeightInputForRow({
                                                                                    row,
                                                                                    rowIndex,
                                                                                    orderedRows: workoutRows,
                                                                                    effectiveWeightByRowId:
                                                                                        effectiveWeightPreviewByRowId,
                                                                                })
                                                                            const previewEffectiveWeight =
                                                                                'parsedWeight' in
                                                                                    resolvedWeightInputForPreview
                                                                                    ? resolvedWeightInputForPreview
                                                                                        .parsedWeight.effectiveWeight
                                                                                    : null

                                                                            effectiveWeightPreviewByRowId[row.id] =
                                                                                previewEffectiveWeight

                                                                            const shouldShowEffectiveWeightPreview =
                                                                                parsedWeightInputForPreview.mode ===
                                                                                'percentage_1rm' ||
                                                                                parsedWeightInputForPreview.mode ===
                                                                                'percentage_previous'
                                                                            const persistedEffectiveWeight =
                                                                                persistedEffectiveWeightByRowId[row.id]
                                                                            const assignedWeightDisplay =
                                                                                row.weight.trim() === ''
                                                                                    ? '-'
                                                                                    : row.weight.trim()
                                                                            const effectiveWeightToDisplay =
                                                                                typeof persistedEffectiveWeight ===
                                                                                    'number'
                                                                                    ? persistedEffectiveWeight
                                                                                    : previewEffectiveWeight
                                                                            const shouldShowEffectiveWeight = readOnly
                                                                                ? true
                                                                                : shouldShowEffectiveWeightPreview &&
                                                                                typeof previewEffectiveWeight ===
                                                                                'number'

                                                                            return (
                                                                                <SortableExerciseRow
                                                                                    key={row.id}
                                                                                    id={row.id}
                                                                                    isDraft={row.isDraft}
                                                                                    readOnly={readOnly}
                                                                                >
                                                                                    {(dragHandleProps) => (
                                                                                        <>
                                                                                            <td className="w-6 px-0.5 py-3 align-middle">
                                                                                                {dragHandleProps ? (
                                                                                                    <button
                                                                                                        type="button"
                                                                                                        className="flex h-full w-6 cursor-grab items-center justify-center text-gray-300 hover:text-gray-500 active:cursor-grabbing disabled:cursor-not-allowed"
                                                                                                        disabled={Boolean(rowBusy)}
                                                                                                        {...dragHandleProps}
                                                                                                        aria-label={t('editProgram.dragHandleLabel')}
                                                                                                    >
                                                                                                        <GripVertical className="h-4 w-4" />
                                                                                                    </button>
                                                                                                ) : (
                                                                                                    <span className="block w-6" />
                                                                                                )}
                                                                                            </td>

                                                                                            <td className="px-1 py-3 align-middle">
                                                                                        <label className="flex h-full w-full items-center justify-center">
                                                                                            <input
                                                                                                type="checkbox"
                                                                                                checked={row.isWarmup}
                                                                                                onChange={(event) =>
                                                                                                    updateRowFields(row.id, {
                                                                                                        isWarmup: event.target.checked,
                                                                                                    })
                                                                                                }
                                                                                                disabled={rowBusy || readOnly}
                                                                                                className="h-4 w-4 rounded border-gray-300 text-brand-primary focus:ring-brand-primary"
                                                                                            />
                                                                                        </label>
                                                                                    </td>

                                                                                    <td className="px-1 py-3">
                                                                                        <AutocompleteSearch
                                                                                            id={`exercise-row-${row.id}`}
                                                                                            options={autocompleteExerciseOptions}
                                                                                            value={row.exerciseId || undefined}
                                                                                            onSelect={(option) => {
                                                                                                updateRowFields(row.id, {
                                                                                                    exerciseId: option?.id ?? '',
                                                                                                    variant: '',
                                                                                                })

                                                                                                setCustomVariantInputByRowId(
                                                                                                    (currentModes) => ({
                                                                                                        ...currentModes,
                                                                                                        [row.id]: false,
                                                                                                    })
                                                                                                )
                                                                                            }}
                                                                                            placeholder={t('editProgram.selectExercise')}
                                                                                            disabled={rowBusy || readOnly}
                                                                                            className="w-full"
                                                                                        />
                                                                                    </td>

                                                                                    <td className="px-1 py-3">
                                                                                        <div className="flex items-center gap-1">
                                                                                            <div className="min-w-0 flex-1">
                                                                                                {isCustomVariantInput ? (
                                                                                                    <Input
                                                                                                        type="text"
                                                                                                        value={row.variant}
                                                                                                        onChange={(event) =>
                                                                                                            updateRowFields(row.id, {
                                                                                                                variant: event.target.value,
                                                                                                            })
                                                                                                        }
                                                                                                        disabled={
                                                                                                            rowBusy ||
                                                                                                            readOnly ||
                                                                                                            !selectedExercise
                                                                                                        }
                                                                                                        className={variantFieldClassName}
                                                                                                        placeholder={t('editProgram.variantPlaceholder')}
                                                                                                    />
                                                                                                ) : (
                                                                                                    <AutocompleteSearch
                                                                                                        id={`variant-row-${row.id}`}
                                                                                                        options={variantOptions.map((variantOption) => ({
                                                                                                            id: variantOption,
                                                                                                            label: variantOption,
                                                                                                        }))}
                                                                                                        value={row.variant || undefined}
                                                                                                        onSelect={(option) =>
                                                                                                            updateRowFields(row.id, {
                                                                                                                variant: option?.id ?? '',
                                                                                                            })
                                                                                                        }
                                                                                                        placeholder={t('editProgram.noVariantOption')}
                                                                                                        emptyMessage={t('editProgram.noVariantAvailable')}
                                                                                                        disabled={
                                                                                                            rowBusy ||
                                                                                                            readOnly ||
                                                                                                            !selectedExercise
                                                                                                        }
                                                                                                        className="w-full"
                                                                                                    />
                                                                                                )}
                                                                                            </div>

                                                                                            <button
                                                                                                type="button"
                                                                                                onClick={() =>
                                                                                                    toggleCustomVariantInput({
                                                                                                        rowId: row.id,
                                                                                                        currentVariant: row.variant,
                                                                                                        variantOptions,
                                                                                                        selectedExercise,
                                                                                                    })
                                                                                                }
                                                                                                disabled={
                                                                                                    rowBusy || readOnly || !selectedExercise
                                                                                                }
                                                                                                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-gray-300 bg-white text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
                                                                                                title={
                                                                                                    isCustomVariantInput
                                                                                                        ? t('editProgram.lockVariantInputTitle')
                                                                                                        : t('editProgram.unlockVariantInputTitle')
                                                                                                }
                                                                                                aria-label={
                                                                                                    isCustomVariantInput
                                                                                                        ? t('editProgram.lockVariantInputTitle')
                                                                                                        : t('editProgram.unlockVariantInputTitle')
                                                                                                }
                                                                                            >
                                                                                                {isCustomVariantInput ? (
                                                                                                    <LockOpen className="h-4 w-4" />
                                                                                                ) : (
                                                                                                    <Lock className="h-4 w-4" />
                                                                                                )}
                                                                                            </button>
                                                                                        </div>

                                                                                        {selectedExercise && variantOptions.length === 0 && (
                                                                                            <p className="mt-1 text-[11px] text-gray-400">
                                                                                                {t('editProgram.noVariantAvailable')}
                                                                                            </p>
                                                                                        )}
                                                                                    </td>

                                                                                    <td className="px-1 py-3">
                                                                                        <Input
                                                                                            type="number"
                                                                                            min="1"
                                                                                            max="20"
                                                                                            step="1"
                                                                                            value={row.sets}
                                                                                            onChange={(event) =>
                                                                                                updateRowFields(row.id, {
                                                                                                    sets: event.target.value,
                                                                                                })
                                                                                            }
                                                                                            disabled={rowBusy || readOnly}
                                                                                            className={metricFieldClassName}
                                                                                        />
                                                                                    </td>

                                                                                    <td className="px-1 py-3">
                                                                                        <Input
                                                                                            type="text"
                                                                                            value={row.reps}
                                                                                            onChange={(event) =>
                                                                                                updateRowFields(row.id, { reps: event.target.value })
                                                                                            }
                                                                                            disabled={rowBusy || readOnly}
                                                                                            className="h-9 w-16 rounded-lg border border-gray-300 px-1.5 text-center text-sm leading-5 focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary disabled:bg-gray-50 disabled:text-gray-400"
                                                                                            placeholder="8"
                                                                                            aria-label={t('editProgram.tableReps')}
                                                                                        />
                                                                                    </td>

                                                                                    <td className="px-1 py-3">
                                                                                        <select
                                                                                            value={row.targetRpe}
                                                                                            onChange={(event) =>
                                                                                                updateRowFields(row.id, {
                                                                                                    targetRpe: event.target.value,
                                                                                                })
                                                                                            }
                                                                                            disabled={rowBusy || readOnly}
                                                                                            className={metricFieldClassName}
                                                                                        >
                                                                                            <option value="">-</option>
                                                                                            {RPE_OPTIONS.map((rpeValue) => (
                                                                                                <option key={rpeValue} value={String(rpeValue)}>
                                                                                                    {rpeValue}
                                                                                                </option>
                                                                                            ))}
                                                                                        </select>
                                                                                    </td>

                                                                                    <td className="px-1 py-3">
                                                                                        {readOnly ? (
                                                                                            <div className="space-y-1">
                                                                                                <p className="text-[11px] text-gray-600">
                                                                                                    {t('editProgram.assignedWeightPreview', {
                                                                                                        weight: assignedWeightDisplay,
                                                                                                    })}
                                                                                                </p>
                                                                                                {shouldShowEffectiveWeight &&
                                                                                                    typeof effectiveWeightToDisplay ===
                                                                                                    'number' ? (
                                                                                                    <p className="text-[11px] font-semibold text-emerald-700">
                                                                                                        {t(
                                                                                                            'editProgram.effectiveWeightPreview',
                                                                                                            {
                                                                                                                weight: `${formatWeightForDisplay(
                                                                                                                    effectiveWeightToDisplay
                                                                                                                )} kg`,
                                                                                                            }
                                                                                                        )}
                                                                                                    </p>
                                                                                                ) : (
                                                                                                    <p className="text-[11px] font-semibold text-emerald-700">
                                                                                                        {t(
                                                                                                            'editProgram.effectiveWeightPreviewUnavailable'
                                                                                                        )}
                                                                                                    </p>
                                                                                                )}
                                                                                            </div>
                                                                                        ) : (
                                                                                            <>
                                                                                                <Input
                                                                                                    type="text"
                                                                                                    value={row.weight}
                                                                                                    onChange={(event) =>
                                                                                                        updateRowFields(row.id, {
                                                                                                            weight: event.target.value,
                                                                                                        })
                                                                                                    }
                                                                                                    disabled={rowBusy || readOnly}
                                                                                                    className={metricFieldClassName}
                                                                                                />

                                                                                                {shouldShowEffectiveWeight &&
                                                                                                    typeof effectiveWeightToDisplay ===
                                                                                                    'number' && (
                                                                                                        <p className="mt-1 text-[11px] font-semibold text-emerald-700">
                                                                                                            {t(
                                                                                                                'editProgram.effectiveWeightPreview',
                                                                                                                {
                                                                                                                    weight: `${formatWeightForDisplay(
                                                                                                                        effectiveWeightToDisplay
                                                                                                                    )} kg`,
                                                                                                                }
                                                                                                            )}
                                                                                                        </p>
                                                                                                    )}
                                                                                            </>
                                                                                        )}
                                                                                    </td>

                                                                                    <td className="px-1 py-3">
                                                                                        <select
                                                                                            value={row.restTime}
                                                                                            onChange={(event) =>
                                                                                                updateRowFields(row.id, {
                                                                                                    restTime:
                                                                                                        event.target
                                                                                                            .value as RestTime,
                                                                                                })
                                                                                            }
                                                                                            disabled={rowBusy || readOnly}
                                                                                            className="w-full rounded-lg border border-gray-300 px-1.5 py-2 text-sm focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary"
                                                                                        >
                                                                                            {REST_TIME_OPTIONS.map((restOption) => (
                                                                                                <option
                                                                                                    key={restOption.value}
                                                                                                    value={restOption.value}
                                                                                                >
                                                                                                    {restOption.label}
                                                                                                </option>
                                                                                            ))}
                                                                                        </select>
                                                                                    </td>

                                                                                    <td className="px-1 py-3">
                                                                                        <div className="mx-auto flex max-w-full items-center justify-center gap-1">
                                                                                            <div>
                                                                                                {selectedExercise ? (
                                                                                                    <div className="flex items-center gap-1.5">
                                                                                                        <span
                                                                                                            className={`inline-flex w-fit rounded-full px-2 py-0.5 text-[10px] font-semibold ${selectedExercise.type ===
                                                                                                                'fundamental'
                                                                                                                ? 'bg-red-100 text-red-700'
                                                                                                                : 'bg-blue-100 text-blue-700'
                                                                                                                }`}
                                                                                                        >
                                                                                                            {selectedExercise.type === 'fundamental'
                                                                                                                ? 'F'
                                                                                                                : 'A'}
                                                                                                        </span>
                                                                                                        {selectedExercise.movementPattern && (
                                                                                                            <MovementPatternTag
                                                                                                                name={selectedExercise.movementPattern.name}
                                                                                                                color={selectedExercise.movementPattern.color}
                                                                                                                compact
                                                                                                                className="w-fit"
                                                                                                            />
                                                                                                        )}
                                                                                                    </div>
                                                                                                ) : (
                                                                                                    <span className="text-xs text-gray-400">
                                                                                                        -
                                                                                                    </span>
                                                                                                )}
                                                                                            </div>

                                                                                            {!readOnly && (
                                                                                                <div>
                                                                                                    <ActionIconButton
                                                                                                        variant="delete"
                                                                                                        label={t('editProgram.deleteRowTitle')}
                                                                                                        onClick={() =>
                                                                                                            setConfirmDeleteRow({
                                                                                                                rowId: row.id,
                                                                                                                workoutId: workout.id,
                                                                                                                isDraft: row.isDraft,
                                                                                                            })
                                                                                                        }
                                                                                                        disabled={rowBusy}
                                                                                                        isLoading={deletingRowId === row.id}
                                                                                                    />
                                                                                                </div>
                                                                                            )}
                                                                                        </div>
                                                                                    </td>
                                                                                        </>
                                                                                    )}
                                                                                </SortableExerciseRow>
                                                                            )
                                                                        })}
                                                                    </tbody>
                                                                </table>
                                                                    </SortableContext>
                                                                </DndContext>
                                                            </div>
                                                        )}
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    )}
                                </section>
                            )
                        })}
                    </div>

                    {!readOnly && (
                        <div className="flex space-x-4 mt-8">
                            <Link
                                href={reviewProgramHref}
                                className={`flex-1 py-3 px-6 rounded-lg font-semibold text-center transition-colors ${canProceedToReview
                                    ? 'bg-brand-primary hover:bg-brand-primary-hover text-white'
                                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                    }`}
                                onClick={(event) => {
                                    if (completedWorkouts < totalWorkouts) {
                                        event.preventDefault()
                                        showToast(t('editProgram.configureAllFirst'), 'warning')
                                        return
                                    }

                                    if (hasUnsavedWorkoutChanges) {
                                        event.preventDefault()
                                        showToast(t('editProgram.saveAllWorkoutsFirst'), 'warning')
                                    }
                                }}
                            >
                                {t('editProgram.nextReview')}
                            </Link>
                            <Link
                                href="/trainer/programs"
                                className="bg-gray-300 hover:bg-gray-400 text-gray-800 font-semibold py-3 px-6 rounded-lg transition-colors"
                            >
                                {t('editProgram.saveDraft')}
                            </Link>
                        </div>
                    )}

                </div>

                <ConfirmationModal
                    isOpen={confirmCopyNextWeek !== null}
                    onClose={() => {
                        if (!copyingWeekId) {
                            setConfirmCopyNextWeek(null)
                        }
                    }}
                    onConfirm={handleCopyWeekToNext}
                    title={t('editProgram.copyWeekTitle', {
                        sourceWeek: confirmCopyNextWeek?.weekNumber,
                        targetWeek: confirmCopyNextWeek
                            ? confirmCopyNextWeek.weekNumber + 1
                            : undefined,
                    })}
                    message={t('editProgram.copyWeekMessage', {
                        sourceWeek: confirmCopyNextWeek?.weekNumber,
                        targetWeek: confirmCopyNextWeek
                            ? confirmCopyNextWeek.weekNumber + 1
                            : undefined,
                    })}
                    confirmText={t('editProgram.copyWeekConfirm')}
                    variant="warning"
                    isLoading={copyingWeekId !== null}
                />

                <ConfirmationModal
                    isOpen={confirmDeleteRow !== null}
                    onClose={() => {
                        if (!deletingRowId) {
                            setConfirmDeleteRow(null)
                        }
                    }}
                    onConfirm={() => {
                        void deleteRow()
                    }}
                    title={t('editProgram.confirmDeleteRowTitle')}
                    message={t('editProgram.confirmDeleteRowMessage')}
                    confirmText={t('editProgram.confirmDeleteRowConfirm')}
                    variant="danger"
                    isLoading={deletingRowId !== null}
                />

                <ConfirmationModal
                    isOpen={blockingWeightErrorModal !== null}
                    onClose={() => setBlockingWeightErrorModal(null)}
                    onConfirm={() => setBlockingWeightErrorModal(null)}
                    title={
                        blockingWeightErrorModal?.title ||
                        t('editProgram.weightModalGenericTitle')
                    }
                    message={
                        blockingWeightErrorModal?.message ||
                        t('editProgram.rowValidationWeight')
                    }
                    confirmText={t('editProgram.weightModalAcknowledge')}
                    cancelText={t('editProgram.weightModalAcknowledge')}
                    variant="danger"
                />
            </div>
        </div>
    )
}
