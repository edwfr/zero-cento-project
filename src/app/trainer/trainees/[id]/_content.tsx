'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useTranslation } from 'react-i18next'
import { getApiErrorMessage } from '@/lib/api-error'
import Link from 'next/link'
import { SkeletonDetail } from '@/components'
import { formatDate } from '@/lib/date-format'
import TraineePlannedMuscleGroupReport from '@/components/TraineePlannedMuscleGroupReport'
import { Plus, Trophy, ChevronDown, ChevronUp } from 'lucide-react'
import { ActionIconButton, InlineActions } from '@/components'
import {
    CartesianGrid,
    Legend,
    Line,
    LineChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts'

interface Trainee {
    id: string
    firstName: string
    lastName: string
    email: string
    isActive: boolean
    createdAt: string
}

interface Program {
    id: string
    title: string
    status: 'draft' | 'active' | 'completed'
    durationWeeks: number
    startDate: string | null
    endDate: string | null
    createdAt: string
}

interface PersonalRecord {
    id: string
    weight: number
    reps: number
    recordDate: string
    exercise: {
        id: string
        name: string
        type: 'fundamental' | 'accessory'
    }
}

interface PlannedTrainingSetsPoint {
    date: string
    fundamentalSets: {
        squat: number
        bench: number
        deadlift: number
    }
}

type RecordTimeWindow = '30d' | '90d' | '180d' | '365d' | 'all'
type SbdLiftValue = 'squat' | 'bench' | 'deadlift'
type RecordsPanel =
    | 'maxProgression'
    | 'sbdProgression'
    | 'latestRecords'
    | 'plannedFundamentalReport'
    | 'plannedMuscleReport'

interface ChartRow {
    dateKey: string
    dateLabel: string
    [dataKey: string]: string | number | undefined
}

interface ChartSeries {
    dataKey: string
    label: string
    color: string
}

interface SbdKpiRow {
    lift: SbdLiftValue
    label: string
    frequency: number
    totalLifts: number
    averageIntensity: number | null
}

interface SbdPointMetric {
    frequency: number
    totalLifts: number
    averageIntensity: number | null
}

const CHART_COLORS = ['rgb(var(--brand-primary))', '#0F766E', '#2563EB', '#DC2626', '#7C3AED', '#0891B2', '#65A30D', '#EA580C']

const SBD_COLORS: Record<SbdLiftValue, string> = {
    squat: '#16A34A',
    bench: '#2563EB',
    deadlift: '#DC2626',
}

const SBD_PATTERNS: Record<SbdLiftValue, string[]> = {
    squat: ['squat', 'back squat', 'front squat', 'box squat'],
    bench: ['bench press', 'bench', 'panca'],
    deadlift: ['deadlift', 'stacco', 'stacco da terra'],
}

const SBD_LIFTS: SbdLiftValue[] = ['squat', 'bench', 'deadlift']

function normalizeRecordDateKey(recordDate: string): string {
    if (recordDate.length >= 10) {
        return recordDate.slice(0, 10)
    }

    const parsedDate = new Date(recordDate)
    if (Number.isNaN(parsedDate.getTime())) {
        return recordDate
    }

    return parsedDate.toISOString().slice(0, 10)
}

function formatWeight(weight: number): string {
    if (!Number.isFinite(weight)) {
        return '0'
    }

    return Number.isInteger(weight) ? String(weight) : weight.toFixed(1)
}

function matchSbdLift(exerciseName: string): SbdLiftValue | null {
    const lowerName = exerciseName.toLowerCase()

    if (SBD_PATTERNS.squat.some((pattern) => lowerName.includes(pattern))) {
        return 'squat'
    }

    if (SBD_PATTERNS.bench.some((pattern) => lowerName.includes(pattern))) {
        return 'bench'
    }

    if (SBD_PATTERNS.deadlift.some((pattern) => lowerName.includes(pattern))) {
        return 'deadlift'
    }

    return null
}

function calculateOneRepMax(weight: number, reps: number): number {
    if (reps === 1) return weight
    // Brzycki formula
    return Math.round(weight * (36 / (37 - reps)) * 10) / 10
}

function getExerciseBadgeStyle(color: string | undefined, isActive: boolean) {
    if (!isActive || !color) {
        return {
            borderColor: '#E5E7EB',
            backgroundColor: '#FFFFFF',
            color: '#4B5563',
        }
    }

    if (color.includes('var(--brand-primary)')) {
        return {
            borderColor: 'rgba(var(--brand-primary), 0.45)',
            backgroundColor: 'rgba(var(--brand-primary), 0.12)',
            color: 'rgb(var(--brand-primary))',
        }
    }

    const hex = color.replace('#', '')
    const normalizedHex =
        hex.length === 3
            ? hex
                .split('')
                .map((char) => `${char}${char}`)
                .join('')
            : hex

    const red = Number.parseInt(normalizedHex.slice(0, 2), 16)
    const green = Number.parseInt(normalizedHex.slice(2, 4), 16)
    const blue = Number.parseInt(normalizedHex.slice(4, 6), 16)

    return {
        borderColor: `rgba(${red}, ${green}, ${blue}, 0.45)`,
        backgroundColor: `rgba(${red}, ${green}, ${blue}, 0.12)`,
        color: `rgb(${Math.round(red * 0.6)}, ${Math.round(green * 0.6)}, ${Math.round(blue * 0.6)})`,
    }
}

function getSbdPointMetric(point: PlannedTrainingSetsPoint, lift: SbdLiftValue): SbdPointMetric {
    const totalLifts = Number(point.fundamentalSets[lift] || 0)

    return {
        frequency: totalLifts > 0 ? 1 : 0,
        totalLifts,
        averageIntensity: null,
    }
}

export default function TraineeDetailContent() {
    const params = useParams<{ id: string }>()
    const router = useRouter()
    const { t } = useTranslation(['trainer', 'common'])
    const traineeId = params.id

    const [loading, setLoading] = useState(true)
    const [trainee, setTrainee] = useState<Trainee | null>(null)
    const [programs, setPrograms] = useState<Program[]>([])
    const [records, setRecords] = useState<PersonalRecord[]>([])
    const [plannedPoints, setPlannedPoints] = useState<PlannedTrainingSetsPoint[]>([])
    const [error, setError] = useState<string | null>(null)
    const [activeTab, setActiveTab] = useState<'programs' | 'records' | 'reports'>('programs')
    const [oneRmExerciseFilters, setOneRmExerciseFilters] = useState<string[] | null>(null)
    const [oneRmTimeWindow, setOneRmTimeWindow] = useState<RecordTimeWindow>('180d')
    const [sbdLiftFilters, setSbdLiftFilters] = useState<SbdLiftValue[] | null>(null)
    const [sbdTimeWindow, setSbdTimeWindow] = useState<RecordTimeWindow>('180d')
    const [collapsedPanels, setCollapsedPanels] = useState<Record<RecordsPanel, boolean>>({
        maxProgression: false,
        sbdProgression: false,
        latestRecords: false,
        plannedFundamentalReport: false,
        plannedMuscleReport: false,
    })

    const fetchTraineeData = useCallback(async () => {
        try {
            setLoading(true)

            const [traineeRes, programsRes, recordsRes, plannedRes] = await Promise.all([
                fetch(`/api/users/${traineeId}`),
                fetch(`/api/programs?traineeId=${traineeId}`),
                fetch(`/api/personal-records?traineeId=${traineeId}`),
                fetch(`/api/users/${traineeId}/reports/planned-training-sets`),
            ])

            const [traineeData, programsData, recordsData, plannedData] = await Promise.all([
                traineeRes.json(),
                programsRes.json(),
                recordsRes.json(),
                plannedRes.json(),
            ])

            if (!traineeRes.ok) {
                throw new Error(getApiErrorMessage(traineeData, t('athletes.athleteNotFound'), t))
            }

            setTrainee(traineeData.data.user)
            setPrograms(programsData.data?.items || programsData.data?.programs || [])
            setRecords(recordsData.data?.items || recordsData.data?.records || [])
            setPlannedPoints(plannedRes.ok ? plannedData.data?.points || [] : [])
        } catch (err: any) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }, [t, traineeId])

    useEffect(() => {
        fetchTraineeData()
    }, [fetchTraineeData])

    const latestRecords = useMemo(() => {
        const latestByExercise = new Map<string, PersonalRecord>()

        records.forEach((record) => {
            const currentLatest = latestByExercise.get(record.exercise.id)

            if (!currentLatest) {
                latestByExercise.set(record.exercise.id, record)
                return
            }

            const currentDate = new Date(currentLatest.recordDate).getTime()
            const nextDate = new Date(record.recordDate).getTime()

            if (nextDate > currentDate) {
                latestByExercise.set(record.exercise.id, record)
            }
        })

        return Array.from(latestByExercise.values()).sort((left, right) => {
            if (left.exercise.type !== right.exercise.type) {
                return left.exercise.type === 'fundamental' ? -1 : 1
            }

            return left.exercise.name.localeCompare(right.exercise.name, 'it', { sensitivity: 'base' })
        })
    }, [records])

    const exerciseOptions = useMemo(() => {
        const exerciseById = new Map<string, PersonalRecord['exercise']>()

        records.forEach((record) => {
            if (!exerciseById.has(record.exercise.id)) {
                exerciseById.set(record.exercise.id, record.exercise)
            }
        })

        return Array.from(exerciseById.values()).sort((left, right) => {
            if (left.type !== right.type) {
                return left.type === 'fundamental' ? -1 : 1
            }

            return left.name.localeCompare(right.name, 'it', { sensitivity: 'base' })
        })
    }, [records])

    useEffect(() => {
        if (oneRmExerciseFilters === null) {
            return
        }

        const availableExerciseIds = new Set(exerciseOptions.map((exercise) => exercise.id))
        const nextSelectedIds = oneRmExerciseFilters.filter((exerciseId) =>
            availableExerciseIds.has(exerciseId)
        )

        if (nextSelectedIds.length !== oneRmExerciseFilters.length) {
            setOneRmExerciseFilters(nextSelectedIds)
        }
    }, [exerciseOptions, oneRmExerciseFilters])

    const oneRmFilteredRecords = useMemo(() => {
        const daysByWindow: Record<Exclude<RecordTimeWindow, 'all'>, number> = {
            '30d': 30,
            '90d': 90,
            '180d': 180,
            '365d': 365,
        }

        const now = new Date()
        const cutoffDate =
            oneRmTimeWindow === 'all'
                ? null
                : new Date(now.getTime() - daysByWindow[oneRmTimeWindow] * 24 * 60 * 60 * 1000)

        return records.filter((record) => {
            if (oneRmExerciseFilters !== null && !oneRmExerciseFilters.includes(record.exercise.id)) {
                return false
            }

            if (!cutoffDate) {
                return true
            }

            const recordDate = new Date(record.recordDate)
            return !Number.isNaN(recordDate.getTime()) && recordDate >= cutoffDate
        })
    }, [oneRmExerciseFilters, oneRmTimeWindow, records])

    const toggleOneRmExerciseFilter = (exerciseId: string) => {
        setOneRmExerciseFilters((currentIds) => {
            if (currentIds === null) {
                return [exerciseId]
            }

            if (currentIds.includes(exerciseId)) {
                return currentIds.filter((id) => id !== exerciseId)
            }

            return [...currentIds, exerciseId]
        })
    }

    const selectAllOneRmExercises = () => {
        setOneRmExerciseFilters(null)
    }

    const deselectAllOneRmExercises = () => {
        setOneRmExerciseFilters([])
    }

    const exerciseColorById = useMemo(
        () =>
            exerciseOptions.reduce((acc, exercise, index) => {
                acc[exercise.id] = CHART_COLORS[index % CHART_COLORS.length]
                return acc
            }, {} as Record<string, string>),
        [exerciseOptions]
    )

    const maxProgressionSeries = useMemo<ChartSeries[]>(() => {
        const seriesMap = new Map<string, string>()

        oneRmFilteredRecords.forEach((record) => {
            if (!seriesMap.has(record.exercise.id)) {
                seriesMap.set(record.exercise.id, record.exercise.name)
            }
        })

        return Array.from(seriesMap.entries())
            .sort((left, right) => left[1].localeCompare(right[1], 'it', { sensitivity: 'base' }))
            .map(([exerciseId, exerciseName], index) => ({
                dataKey: exerciseId,
                label: exerciseName,
                color: exerciseColorById[exerciseId] || CHART_COLORS[index % CHART_COLORS.length],
            }))
    }, [exerciseColorById, oneRmFilteredRecords])

    const maxProgressionChartData = useMemo<ChartRow[]>(() => {
        const chartRowsByDate = new Map<string, ChartRow>()

        oneRmFilteredRecords.forEach((record) => {
            const dateKey = normalizeRecordDateKey(record.recordDate)
            const oneRepMax = calculateOneRepMax(record.weight, record.reps)

            if (!chartRowsByDate.has(dateKey)) {
                chartRowsByDate.set(dateKey, {
                    dateKey,
                    dateLabel: formatDate(dateKey),
                })
            }

            const chartRow = chartRowsByDate.get(dateKey)
            if (!chartRow) {
                return
            }

            const currentValue = chartRow[record.exercise.id]
            if (typeof currentValue !== 'number' || oneRepMax > currentValue) {
                chartRow[record.exercise.id] = oneRepMax
            }
        })

        return Array.from(chartRowsByDate.values()).sort((left, right) => left.dateKey.localeCompare(right.dateKey))
    }, [oneRmFilteredRecords])

    const sbdFilteredPlannedPoints = useMemo(() => {
        const daysByWindow: Record<Exclude<RecordTimeWindow, 'all'>, number> = {
            '30d': 30,
            '90d': 90,
            '180d': 180,
            '365d': 365,
        }

        const now = new Date()
        const cutoffDate =
            sbdTimeWindow === 'all'
                ? null
                : new Date(now.getTime() - daysByWindow[sbdTimeWindow] * 24 * 60 * 60 * 1000)

        return plannedPoints.filter((point) => {
            if (!cutoffDate) {
                return true
            }

            const pointDate = new Date(point.date)
            return !Number.isNaN(pointDate.getTime()) && pointDate >= cutoffDate
        })
    }, [plannedPoints, sbdTimeWindow])

    const sbdSeries = useMemo<ChartSeries[]>(() => {
        const baseSeries: ChartSeries[] = [
            { dataKey: 'squat', label: t('reports.squat'), color: SBD_COLORS.squat },
            { dataKey: 'bench', label: t('reports.bench'), color: SBD_COLORS.bench },
            { dataKey: 'deadlift', label: t('reports.deadlift'), color: SBD_COLORS.deadlift },
        ]

        if (sbdLiftFilters === null) {
            return baseSeries
        }

        const activeLiftSet = new Set(sbdLiftFilters)
        return baseSeries.filter((series) => activeLiftSet.has(series.dataKey as SbdLiftValue))
    }, [sbdLiftFilters, t])

    const sbdChartData = useMemo<ChartRow[]>(() => {
        return sbdFilteredPlannedPoints
            .map((point) => ({
                dateKey: point.date,
                dateLabel: formatDate(point.date),
                squat: Number(point.fundamentalSets.squat || 0),
                bench: Number(point.fundamentalSets.bench || 0),
                deadlift: Number(point.fundamentalSets.deadlift || 0),
            }))
            .sort((left, right) => left.dateKey.localeCompare(right.dateKey))
    }, [sbdFilteredPlannedPoints])

    const sbdKpiRows = useMemo<SbdKpiRow[]>(() => {
        const aggregates: Record<
            SbdLiftValue,
            {
                totalLifts: number
            }
        > = {
            squat: {
                totalLifts: 0,
            },
            bench: {
                totalLifts: 0,
            },
            deadlift: {
                totalLifts: 0,
            },
        }

        sbdFilteredPlannedPoints.forEach((point) => {
            aggregates.squat.totalLifts += Number(point.fundamentalSets.squat || 0)
            aggregates.bench.totalLifts += Number(point.fundamentalSets.bench || 0)
            aggregates.deadlift.totalLifts += Number(point.fundamentalSets.deadlift || 0)
        })

        return SBD_LIFTS.map((lift) => {
            const aggregate = aggregates[lift]
            const frequency = sbdFilteredPlannedPoints.filter(
                (point) => Number(point.fundamentalSets[lift] || 0) > 0
            ).length

            return {
                lift,
                label: t(`reports.${lift}`),
                frequency,
                totalLifts: Number(aggregate.totalLifts.toFixed(1)),
                averageIntensity: null,
            }
        })
    }, [sbdFilteredPlannedPoints, t])

    const visibleSbdKpiRows = useMemo(() => {
        if (sbdLiftFilters === null) {
            return sbdKpiRows
        }

        const activeLiftSet = new Set(sbdLiftFilters)
        return sbdKpiRows.filter((row) => activeLiftSet.has(row.lift))
    }, [sbdKpiRows, sbdLiftFilters])

    const sbdKpiSummary = useMemo(() => {
        const totalFrequency = visibleSbdKpiRows.reduce((sum, row) => sum + row.frequency, 0)
        const totalLifts = visibleSbdKpiRows.reduce((sum, row) => sum + row.totalLifts, 0)

        return {
            totalFrequency,
            totalLifts: Number(totalLifts.toFixed(1)),
            averageIntensity: null as number | null,
        }
    }, [visibleSbdKpiRows])

    const timeWindowOptions: Array<{ value: RecordTimeWindow; label: string }> = [
        { value: '30d', label: t('common:common.personalRecordsExplorer.window30d') },
        { value: '90d', label: t('common:common.personalRecordsExplorer.window90d') },
        { value: '180d', label: t('common:common.personalRecordsExplorer.window180d') },
        { value: '365d', label: t('common:common.personalRecordsExplorer.window365d') },
        { value: 'all', label: t('common:common.personalRecordsExplorer.windowAll') },
    ]

    const showAllSbdLifts = () => {
        setSbdLiftFilters(null)
    }

    const deselectAllSbdLifts = () => {
        setSbdLiftFilters([])
    }

    const toggleSbdLiftFilter = (lift: SbdLiftValue) => {
        setSbdLiftFilters((currentLifts) => {
            if (currentLifts === null) {
                return [lift]
            }

            if (currentLifts.includes(lift)) {
                return currentLifts.filter((currentLift) => currentLift !== lift)
            }

            return [...currentLifts, lift]
        })
    }

    const togglePanel = (panel: RecordsPanel) => {
        setCollapsedPanels((current) => ({
            ...current,
            [panel]: !current[panel],
        }))
    }

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'draft':
                return 'bg-yellow-100 text-yellow-800'
            case 'active':
                return 'bg-green-100 text-green-800'
            case 'completed':
                return 'bg-gray-100 text-gray-600'
            default:
                return 'bg-gray-100 text-gray-600'
        }
    }

    const getStatusLabel = (status: string) => {
        return t(`common:common.${status}`, status)
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 px-4 sm:px-6 lg:px-8 py-8">
                <SkeletonDetail />
            </div>
        )
    }

    if (error || !trainee) {
        return (
            <div className="min-h-screen bg-gray-50">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                    <div className="bg-red-50 border border-red-200 text-red-800 px-6 py-4 rounded-lg">
                        {error || t('athletes.athleteNotFound')}
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gray-50">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Header */}
                <div className="mb-8">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-3xl font-bold text-gray-900">
                                {trainee.firstName} {trainee.lastName}
                            </h1>
                            <p className="text-gray-600 mt-2">{trainee.email}</p>
                        </div>
                        <div className="flex items-center space-x-4">
                            <span
                                className={`px-4 py-2 text-sm font-semibold rounded-full ${trainee.isActive
                                    ? 'bg-green-100 text-green-800'
                                    : 'bg-red-100 text-red-800'
                                    }`}
                            >
                                {trainee.isActive ? t('athletes.activeStatus') : t('athletes.inactiveStatus')}
                            </span>
                            <Link
                                href={`/trainer/programs/new?traineeId=${traineeId}`}
                                className="bg-green-600 hover:bg-green-700 text-white font-semibold px-6 py-2 rounded-lg transition-colors inline-flex items-center gap-2"
                            >
                                <Plus size={16} />{t('athletes.createProgram')}
                            </Link>
                            <Link
                                href={`/trainer/trainees/${traineeId}/records`}
                                className="bg-brand-primary hover:bg-brand-primary-hover text-white font-semibold px-6 py-2 rounded-lg transition-colors inline-flex items-center gap-2"
                            >
                                <Trophy size={16} />{t('athletes.manageRecords')}
                            </Link>
                        </div>
                    </div>
                </div>
                {/* Tabs */}
                <div className="mb-6">
                    <div className="border-b border-gray-200">
                        <nav className="-mb-px flex space-x-8">
                            <button
                                onClick={() => setActiveTab('programs')}
                                className={`pb-4 px-1 border-b-2 font-semibold text-sm ${activeTab === 'programs'
                                    ? 'border-brand-primary text-brand-primary'
                                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                    }`}
                            >
                                {t('athletes.programsTab')} ({programs.length})
                            </button>
                            <button
                                onClick={() => setActiveTab('records')}
                                className={`pb-4 px-1 border-b-2 font-semibold text-sm ${activeTab === 'records'
                                    ? 'border-brand-primary text-brand-primary'
                                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                    }`}
                            >
                                {t('athletes.recordsTab')} ({latestRecords.length})
                            </button>
                            <button
                                onClick={() => setActiveTab('reports')}
                                className={`pb-4 px-1 border-b-2 font-semibold text-sm ${activeTab === 'reports'
                                    ? 'border-brand-primary text-brand-primary'
                                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                    }`}
                            >
                                {t('athletes.reportsTab')}
                            </button>
                        </nav>
                    </div>
                </div>

                {/* Tab Content */}
                {activeTab === 'programs' && (
                    <div>
                        {programs.length === 0 ? (
                            <div className="bg-white rounded-lg shadow-md p-12 text-center">
                                <p className="text-gray-500 text-lg mb-4">
                                    {t('athletes.noProgramsAssigned')}
                                </p>
                                <Link
                                    href={`/trainer/programs/new?traineeId=${traineeId}`}
                                    className="inline-block bg-brand-primary hover:bg-brand-primary-hover text-white font-semibold px-6 py-2 rounded-lg transition-colors"
                                >
                                    {t('athletes.createNewProgram')}
                                </Link>
                            </div>
                        ) : (
                            <div className="bg-white rounded-lg shadow-md overflow-hidden">
                                <table className="min-w-full divide-y divide-gray-200">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">
                                                {t('programs.program')}
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">
                                                {t('common:common.status')}
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">
                                                {t('common:common.duration')}
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">
                                                {t('athletes.creationDate')}
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">
                                                {t('programs.startDate')}
                                            </th>
                                            <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase">
                                                {t('common:common.actions')}
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                        {programs.map((program) => (
                                            <tr key={program.id} className="hover:bg-gray-50">
                                                <td className="px-6 py-4">
                                                    <div className="font-semibold text-gray-900">
                                                        {program.title}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <span
                                                        className={`px-2 py-1 text-xs font-semibold rounded-full ${getStatusBadge(
                                                            program.status
                                                        )}`}
                                                    >
                                                        {getStatusLabel(program.status)}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                                                    {t('programs.durationWeeks', { count: program.durationWeeks })}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                                                    {formatDate(program.createdAt)}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                                                    {formatDate(program.startDate)}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-right">
                                                    <InlineActions>
                                                        <ActionIconButton
                                                            variant="view"
                                                            label={t('athletes.viewProgram')}
                                                            href={`/trainer/programs/${program.id}?backContext=trainee&traineeId=${traineeId}`}
                                                        />
                                                        {program.status === 'draft' && (
                                                            <ActionIconButton
                                                                variant="edit"
                                                                label={t('common:common.edit')}
                                                                href={`/trainer/programs/${program.id}/edit?backContext=trainee&traineeId=${traineeId}`}
                                                            />
                                                        )}
                                                    </InlineActions>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'records' && (
                    <div>
                        {records.length === 0 ? (
                            <div className="bg-white rounded-lg shadow-md p-12 text-center">
                                <p className="text-gray-500 text-lg mb-4">{t('personalRecords.noRecords')}</p>
                                <Link
                                    href={`/trainer/trainees/${traineeId}/records`}
                                    className="inline-block bg-brand-primary hover:bg-brand-primary-hover text-white font-semibold px-6 py-2 rounded-lg transition-colors"
                                >
                                    {t('personalRecords.addRecordButton')}
                                </Link>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <div className="rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-800">
                                    {t('athletes.recordsLatestOnlyHint')}
                                </div>
                                <div className="rounded-xl border border-gray-100 bg-white shadow-md overflow-hidden">
                                    <button
                                        type="button"
                                        onClick={() => togglePanel('latestRecords')}
                                        className="group flex w-full items-start justify-between gap-4 px-5 py-4 text-left"
                                        aria-expanded={!collapsedPanels.latestRecords}
                                    >
                                        <div>
                                            <h3 className="text-lg font-bold text-gray-900">
                                                {t('common:common.personalRecordsExplorer.tableTitle')}
                                            </h3>
                                            <p className="mt-1 text-sm text-gray-600">
                                                {t('common:common.personalRecordsExplorer.tableDescription')}
                                            </p>
                                        </div>
                                        <span className="rounded-full border border-gray-200 bg-gray-50 p-2 text-gray-500 transition-colors group-hover:bg-gray-100">
                                            {collapsedPanels.latestRecords ? (
                                                <ChevronDown className="h-4 w-4" />
                                            ) : (
                                                <ChevronUp className="h-4 w-4" />
                                            )}
                                        </span>
                                    </button>

                                    {!collapsedPanels.latestRecords && (
                                        <div className="overflow-x-auto">
                                            <table className="min-w-full divide-y divide-gray-200">
                                                <thead className="bg-gray-50">
                                                    <tr>
                                                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">
                                                            {t('personalRecords.exercise')}
                                                        </th>
                                                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">
                                                            {t('personalRecords.weight')}
                                                        </th>
                                                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">
                                                            {t('personalRecords.reps')}
                                                        </th>
                                                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">
                                                            {t('athletes.estimated1RM')}
                                                        </th>
                                                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">
                                                            {t('personalRecords.date')}
                                                        </th>
                                                    </tr>
                                                </thead>
                                                <tbody className="bg-white divide-y divide-gray-200">
                                                    {latestRecords.map((record) => (
                                                        <tr key={record.id} className="hover:bg-gray-50">
                                                            <td className="px-6 py-4">
                                                                <div className="font-semibold text-gray-900">
                                                                    {record.exercise.name}
                                                                </div>
                                                                <div className="text-xs text-gray-500">
                                                                    {record.exercise.type === 'fundamental'
                                                                        ? t('exercises.fundamental')
                                                                        : t('exercises.accessory')}
                                                                </div>
                                                            </td>
                                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                                                                {record.weight} kg
                                                            </td>
                                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                                                                {record.reps} reps
                                                            </td>
                                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-brand-primary">
                                                                {calculateOneRepMax(record.weight, record.reps)} kg
                                                            </td>
                                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                                                                {formatDate(record.recordDate)}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'reports' && (
                    <div className="space-y-6">
                        <div className="rounded-xl border border-gray-100 bg-white shadow-md overflow-hidden">
                            <button
                                type="button"
                                onClick={() => togglePanel('maxProgression')}
                                className="group flex w-full items-start justify-between gap-4 px-5 py-4 text-left"
                                aria-expanded={!collapsedPanels.maxProgression}
                            >
                                <div>
                                    <h3 className="text-lg font-bold text-gray-900">
                                        {t('common:common.personalRecordsExplorer.chartTitle')}
                                    </h3>
                                    <p className="mt-1 text-sm text-gray-600">
                                        {t('common:common.personalRecordsExplorer.chartDescription')}
                                    </p>
                                </div>
                                <span className="rounded-full border border-gray-200 bg-gray-50 p-2 text-gray-500 transition-colors group-hover:bg-gray-100">
                                    {collapsedPanels.maxProgression ? (
                                        <ChevronDown className="h-4 w-4" />
                                    ) : (
                                        <ChevronUp className="h-4 w-4" />
                                    )}
                                </span>
                            </button>

                            {!collapsedPanels.maxProgression && (
                                <div className="px-5 pb-5">
                                    <div className="mb-5 grid grid-cols-1 gap-4 md:grid-cols-2">
                                        <div>
                                            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-600">
                                                {t('common:common.personalRecordsExplorer.filterWindow')}
                                            </label>
                                            <select
                                                value={oneRmTimeWindow}
                                                onChange={(event) => setOneRmTimeWindow(event.target.value as RecordTimeWindow)}
                                                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
                                            >
                                                {timeWindowOptions.map((option) => (
                                                    <option key={option.value} value={option.value}>
                                                        {option.label}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                        <div>
                                            <div className="mb-1 flex items-center justify-between gap-3 flex-wrap">
                                                <label className="text-xs font-semibold uppercase tracking-wide text-gray-600">
                                                    {t('athletes.reportingFilterByExerciseLabel')}
                                                </label>
                                                <div className="flex items-center gap-3">
                                                    <button
                                                        type="button"
                                                        onClick={selectAllOneRmExercises}
                                                        className="text-sm font-semibold text-[#0F766E] hover:text-[#115E59]"
                                                    >
                                                        {t('athletes.reportingSelectAllFilters')}
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={deselectAllOneRmExercises}
                                                        className="text-sm font-semibold text-slate-600 hover:text-slate-800"
                                                    >
                                                        {t('athletes.reportingDeselectAllFilters')}
                                                    </button>
                                                </div>
                                            </div>
                                            <div className="mt-2 flex flex-wrap gap-2">
                                                {exerciseOptions.map((exercise) => {
                                                    const isActive = oneRmExerciseFilters === null || oneRmExerciseFilters.includes(exercise.id)
                                                    const exerciseColor = exerciseColorById[exercise.id]

                                                    return (
                                                        <button
                                                            key={exercise.id}
                                                            type="button"
                                                            onClick={() => toggleOneRmExerciseFilter(exercise.id)}
                                                            className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-colors"
                                                            style={getExerciseBadgeStyle(exerciseColor, isActive)}
                                                        >
                                                            <span
                                                                className="h-2.5 w-2.5 rounded-full"
                                                                style={{ backgroundColor: exerciseColor }}
                                                            />
                                                            {exercise.name}
                                                        </button>
                                                    )
                                                })}
                                            </div>
                                        </div>
                                    </div>

                                    {maxProgressionChartData.length > 0 && maxProgressionSeries.length > 0 ? (
                                        <div className="h-[340px] w-full">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <LineChart data={maxProgressionChartData} margin={{ top: 8, right: 16, left: 4, bottom: 0 }}>
                                                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                                    <XAxis dataKey="dateLabel" minTickGap={24} />
                                                    <YAxis tickFormatter={(value) => `${formatWeight(Number(value))}`} width={56} />
                                                    <Tooltip
                                                        formatter={(value, name) => {
                                                            const numericValue = Array.isArray(value)
                                                                ? Number(value[0] ?? 0)
                                                                : Number(value ?? 0)
                                                            const dataKey = String(name ?? '')
                                                            const lineLabel =
                                                                maxProgressionSeries.find((series) => series.dataKey === dataKey)
                                                                    ?.label || dataKey

                                                            return [`${formatWeight(numericValue)} kg`, lineLabel]
                                                        }}
                                                    />
                                                    <Legend
                                                        formatter={(value) => {
                                                            return (
                                                                maxProgressionSeries.find(
                                                                    (series) => series.dataKey === String(value)
                                                                )?.label || String(value)
                                                            )
                                                        }}
                                                    />
                                                    {maxProgressionSeries.map((series) => (
                                                        <Line
                                                            key={series.dataKey}
                                                            type="monotone"
                                                            dataKey={series.dataKey}
                                                            stroke={series.color}
                                                            strokeWidth={2.5}
                                                            dot={{ r: 3 }}
                                                            activeDot={{ r: 5 }}
                                                            connectNulls
                                                        />
                                                    ))}
                                                </LineChart>
                                            </ResponsiveContainer>
                                        </div>
                                    ) : (
                                        <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 px-4 py-8 text-center text-sm text-gray-600">
                                            {t('common:common.personalRecordsExplorer.noChartData')}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        <div className="rounded-xl border border-gray-100 bg-white shadow-md overflow-hidden">
                            <button
                                type="button"
                                onClick={() => togglePanel('sbdProgression')}
                                className="group flex w-full items-start justify-between gap-4 px-5 py-4 text-left"
                                aria-expanded={!collapsedPanels.sbdProgression}
                            >
                                <div>
                                    <h3 className="text-lg font-bold text-gray-900">{t('reports.sbdReport')}</h3>
                                    <p className="mt-1 text-sm text-gray-600">
                                        {t('athletes.reportingFundamentalDescription')}
                                    </p>
                                </div>
                                <span className="rounded-full border border-gray-200 bg-gray-50 p-2 text-gray-500 transition-colors group-hover:bg-gray-100">
                                    {collapsedPanels.sbdProgression ? (
                                        <ChevronDown className="h-4 w-4" />
                                    ) : (
                                        <ChevronUp className="h-4 w-4" />
                                    )}
                                </span>
                            </button>

                            {!collapsedPanels.sbdProgression && (
                                <div className="space-y-5 px-5 pb-5">
                                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                        <div>
                                            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-600">
                                                {t('common:common.personalRecordsExplorer.filterWindow')}
                                            </label>
                                            <select
                                                value={sbdTimeWindow}
                                                onChange={(event) => setSbdTimeWindow(event.target.value as RecordTimeWindow)}
                                                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
                                            >
                                                {timeWindowOptions.map((option) => (
                                                    <option key={option.value} value={option.value}>
                                                        {option.label}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>

                                        <div>
                                            <div className="mb-1 flex items-center justify-between gap-3 flex-wrap">
                                                <label className="text-xs font-semibold uppercase tracking-wide text-gray-600">
                                                    {t('athletes.reportingFilterByFundamentalLabel')}
                                                </label>
                                                <div className="flex items-center gap-3">
                                                    <button
                                                        type="button"
                                                        onClick={showAllSbdLifts}
                                                        className="text-sm font-semibold text-[#0F766E] hover:text-[#115E59]"
                                                    >
                                                        {t('athletes.reportingSelectAllFilters')}
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={deselectAllSbdLifts}
                                                        className="text-sm font-semibold text-slate-600 hover:text-slate-800"
                                                    >
                                                        {t('athletes.reportingDeselectAllFilters')}
                                                    </button>
                                                </div>
                                            </div>
                                            <div className="mt-2 flex flex-wrap gap-2">
                                                {SBD_LIFTS.map((lift) => {
                                                    const isActive = sbdLiftFilters === null || sbdLiftFilters.includes(lift)
                                                    const badgeStyle = getExerciseBadgeStyle(SBD_COLORS[lift], isActive)

                                                    return (
                                                        <button
                                                            key={lift}
                                                            type="button"
                                                            onClick={() => toggleSbdLiftFilter(lift)}
                                                            className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-colors"
                                                            style={badgeStyle}
                                                        >
                                                            <span
                                                                className="h-2.5 w-2.5 rounded-full"
                                                                style={{ backgroundColor: SBD_COLORS[lift] }}
                                                            />
                                                            {t(`reports.${lift}`)}
                                                        </button>
                                                    )
                                                })}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                        <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
                                            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{t('editProgram.sbdFrq')}</p>
                                            <p className="mt-1 text-2xl font-bold text-slate-900">{sbdKpiSummary.totalFrequency}</p>
                                        </div>
                                        <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
                                            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{t('editProgram.sbdNbl')}</p>
                                            <p className="mt-1 text-2xl font-bold text-slate-900">{sbdKpiSummary.totalLifts}</p>
                                        </div>
                                        <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
                                            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{t('editProgram.sbdIm')}</p>
                                            <p className="mt-1 text-2xl font-bold text-slate-900">
                                                {sbdKpiSummary.averageIntensity !== null
                                                    ? `${sbdKpiSummary.averageIntensity.toFixed(1)}%`
                                                    : '-'}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="overflow-x-auto rounded-lg border border-slate-200">
                                        <table className="min-w-[780px] w-full divide-y divide-slate-200 text-xs">
                                            <thead className="bg-slate-50 text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                                                <tr>
                                                    <th className="sticky left-0 z-10 bg-slate-50 px-3 py-2 text-left">
                                                        {t('reviewProgram.sbdExerciseCol')}
                                                    </th>
                                                    {sbdFilteredPlannedPoints.map((point) => (
                                                        <th key={point.date} className="px-3 py-2 text-left whitespace-nowrap">
                                                            {formatDate(point.date)}
                                                        </th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100 bg-white">
                                                {visibleSbdKpiRows.map((row) => (
                                                    <tr key={row.lift}>
                                                        <td className="sticky left-0 z-10 bg-white px-3 py-2 align-top text-sm font-semibold text-slate-900 whitespace-nowrap">
                                                            {row.label}
                                                        </td>
                                                        {sbdFilteredPlannedPoints.map((point) => (
                                                            <td key={`${row.lift}-${point.date}`} className="px-3 py-2 align-top">
                                                                {(() => {
                                                                    const metric = getSbdPointMetric(point, row.lift)

                                                                    return (
                                                                <div className="space-y-0.5 text-[11px] text-slate-700">
                                                                    <p>
                                                                        <span className="font-semibold text-slate-500">
                                                                            {t('reviewProgram.sbdFrqCol')}:
                                                                        </span>{' '}
                                                                        <span className="font-semibold text-slate-900">
                                                                            {metric.frequency}
                                                                        </span>
                                                                    </p>
                                                                    <p>
                                                                        <span className="font-semibold text-slate-500">
                                                                            {t('reviewProgram.sbdNblCol')}:
                                                                        </span>{' '}
                                                                        <span className="font-semibold text-slate-900">
                                                                            {metric.totalLifts.toFixed(1).replace(/\.0$/, '')}
                                                                        </span>
                                                                    </p>
                                                                    <p>
                                                                        <span className="font-semibold text-slate-500">
                                                                            {t('reviewProgram.sbdImCol')}:
                                                                        </span>{' '}
                                                                        <span className="font-semibold text-slate-900">
                                                                            {metric.averageIntensity !== null
                                                                                ? `${metric.averageIntensity.toFixed(1)}%`
                                                                                : '-'}
                                                                        </span>
                                                                    </p>
                                                                </div>
                                                                    )
                                                                })()}
                                                            </td>
                                                        ))}
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>

                                    {sbdChartData.length > 0 && sbdSeries.length > 0 ? (
                                        <div className="h-[320px] w-full">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <LineChart data={sbdChartData} margin={{ top: 8, right: 16, left: 4, bottom: 0 }}>
                                                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                                    <XAxis dataKey="dateLabel" minTickGap={24} />
                                                    <YAxis width={56} />
                                                    <Tooltip
                                                        formatter={(value, name) => {
                                                            const numericValue = Array.isArray(value)
                                                                ? Number(value[0] ?? 0)
                                                                : Number(value ?? 0)
                                                            const lineLabel =
                                                                sbdSeries.find((series) => series.dataKey === String(name))
                                                                    ?.label || String(name)

                                                            return [numericValue, lineLabel]
                                                        }}
                                                    />
                                                    <Legend
                                                        formatter={(value) => {
                                                            return (
                                                                sbdSeries.find((series) => series.dataKey === String(value))
                                                                    ?.label || String(value)
                                                            )
                                                        }}
                                                    />
                                                    {sbdSeries.map((series) => (
                                                        <Line
                                                            key={series.dataKey}
                                                            type="monotone"
                                                            dataKey={series.dataKey}
                                                            stroke={series.color}
                                                            strokeWidth={2.5}
                                                            dot={{ r: 3 }}
                                                            activeDot={{ r: 5 }}
                                                            connectNulls
                                                        />
                                                    ))}
                                                </LineChart>
                                            </ResponsiveContainer>
                                        </div>
                                    ) : (
                                        <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 px-4 py-8 text-center text-sm text-gray-600">
                                            {t('common:common.personalRecordsExplorer.noChartData')}
                                        </div>
                                    )}

                                </div>
                            )}
                        </div>

                        <div className="rounded-xl border border-gray-100 bg-white shadow-md overflow-hidden">
                            <button
                                type="button"
                                onClick={() => togglePanel('plannedFundamentalReport')}
                                className="group flex w-full items-start justify-between gap-4 px-5 py-4 text-left"
                                aria-expanded={!collapsedPanels.plannedFundamentalReport}
                            >
                                <div>
                                    <h3 className="text-lg font-bold text-gray-900">
                                        {t('athletes.reportingFundamentalTitle')}
                                    </h3>
                                    <p className="mt-1 text-sm text-gray-600">
                                        {t('athletes.reportingFundamentalDescription')}
                                    </p>
                                </div>
                                <span className="rounded-full border border-gray-200 bg-gray-50 p-2 text-gray-500 transition-colors group-hover:bg-gray-100">
                                    {collapsedPanels.plannedFundamentalReport ? (
                                        <ChevronDown className="h-4 w-4" />
                                    ) : (
                                        <ChevronUp className="h-4 w-4" />
                                    )}
                                </span>
                            </button>

                            {!collapsedPanels.plannedFundamentalReport && (
                                <div className="px-5 pb-5">
                                    <TraineePlannedMuscleGroupReport
                                        traineeId={traineeId}
                                        hideHeader
                                        embedded
                                        panelMode="fundamental"
                                    />
                                </div>
                            )}
                        </div>

                        <div className="rounded-xl border border-gray-100 bg-white shadow-md overflow-hidden">
                            <button
                                type="button"
                                onClick={() => togglePanel('plannedMuscleReport')}
                                className="group flex w-full items-start justify-between gap-4 px-5 py-4 text-left"
                                aria-expanded={!collapsedPanels.plannedMuscleReport}
                            >
                                <div>
                                    <h3 className="text-lg font-bold text-gray-900">
                                        {t('athletes.reportingSectionTitle')}
                                    </h3>
                                    <p className="mt-1 text-sm text-gray-600">
                                        {t('athletes.reportingSectionDescription')}
                                    </p>
                                </div>
                                <span className="rounded-full border border-gray-200 bg-gray-50 p-2 text-gray-500 transition-colors group-hover:bg-gray-100">
                                    {collapsedPanels.plannedMuscleReport ? (
                                        <ChevronDown className="h-4 w-4" />
                                    ) : (
                                        <ChevronUp className="h-4 w-4" />
                                    )}
                                </span>
                            </button>

                            {!collapsedPanels.plannedMuscleReport && (
                                <div className="px-5 pb-5">
                                    <TraineePlannedMuscleGroupReport
                                        traineeId={traineeId}
                                        hideHeader
                                        embedded
                                        panelMode="muscle-groups"
                                    />
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
