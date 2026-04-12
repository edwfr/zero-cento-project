'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useTranslation } from 'react-i18next'
import { getApiErrorMessage } from '@/lib/api-error'
import Link from 'next/link'
import { SkeletonDetail } from '@/components'
import { formatDate } from '@/lib/date-format'
import TraineePlannedMuscleGroupReport from '@/components/TraineePlannedMuscleGroupReport'
import { Plus, Eye, Pencil, ArrowLeft, Trophy, ChevronDown, ChevronUp } from 'lucide-react'
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

type RecordTimeWindow = '30d' | '90d' | '180d' | '365d' | 'all'
type SbdLift = 'all' | 'squat' | 'bench' | 'deadlift'
type SbdLiftValue = Exclude<SbdLift, 'all'>
type RecordsPanel = 'maxProgression' | 'sbdProgression' | 'latestRecords' | 'plannedMuscleReport'

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

export default function TraineeDetailContent() {
    const params = useParams<{ id: string }>()
    const router = useRouter()
    const { t } = useTranslation(['trainer', 'common'])
    const traineeId = params.id

    const [loading, setLoading] = useState(true)
    const [trainee, setTrainee] = useState<Trainee | null>(null)
    const [programs, setPrograms] = useState<Program[]>([])
    const [records, setRecords] = useState<PersonalRecord[]>([])
    const [error, setError] = useState<string | null>(null)
    const [activeTab, setActiveTab] = useState<'programs' | 'records' | 'reports'>('programs')
    const [oneRmExerciseFilter, setOneRmExerciseFilter] = useState<string>('all')
    const [oneRmTimeWindow, setOneRmTimeWindow] = useState<RecordTimeWindow>('180d')
    const [sbdLiftFilter, setSbdLiftFilter] = useState<SbdLift>('all')
    const [sbdTimeWindow, setSbdTimeWindow] = useState<RecordTimeWindow>('180d')
    const [collapsedPanels, setCollapsedPanels] = useState<Record<RecordsPanel, boolean>>({
        maxProgression: false,
        sbdProgression: false,
        latestRecords: false,
        plannedMuscleReport: false,
    })

    const fetchTraineeData = useCallback(async () => {
        try {
            setLoading(true)

            const [traineeRes, programsRes, recordsRes] = await Promise.all([
                fetch(`/api/users/${traineeId}`),
                fetch(`/api/programs?traineeId=${traineeId}`),
                fetch(`/api/personal-records?traineeId=${traineeId}`),
            ])

            const [traineeData, programsData, recordsData] = await Promise.all([
                traineeRes.json(),
                programsRes.json(),
                recordsRes.json(),
            ])

            if (!traineeRes.ok) {
                throw new Error(getApiErrorMessage(traineeData, t('athletes.athleteNotFound'), t))
            }

            setTrainee(traineeData.data.user)
            setPrograms(programsData.data?.items || programsData.data?.programs || [])
            setRecords(recordsData.data?.items || recordsData.data?.records || [])
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
        if (oneRmExerciseFilter === 'all') {
            return
        }

        const selectedExerciseStillExists = exerciseOptions.some(
            (exercise) => exercise.id === oneRmExerciseFilter
        )

        if (!selectedExerciseStillExists) {
            setOneRmExerciseFilter('all')
        }
    }, [exerciseOptions, oneRmExerciseFilter])

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
            if (oneRmExerciseFilter !== 'all' && record.exercise.id !== oneRmExerciseFilter) {
                return false
            }

            if (!cutoffDate) {
                return true
            }

            const recordDate = new Date(record.recordDate)
            return !Number.isNaN(recordDate.getTime()) && recordDate >= cutoffDate
        })
    }, [oneRmExerciseFilter, oneRmTimeWindow, records])

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
                color: CHART_COLORS[index % CHART_COLORS.length],
            }))
    }, [oneRmFilteredRecords])

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

    const sbdFilteredRecords = useMemo(() => {
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

        return records.filter((record) => {
            const sbdLift = matchSbdLift(record.exercise.name)

            if (!sbdLift) {
                return false
            }

            if (sbdLiftFilter !== 'all' && sbdLift !== sbdLiftFilter) {
                return false
            }

            if (!cutoffDate) {
                return true
            }

            const recordDate = new Date(record.recordDate)
            return !Number.isNaN(recordDate.getTime()) && recordDate >= cutoffDate
        })
    }, [records, sbdLiftFilter, sbdTimeWindow])

    const sbdSeries = useMemo<ChartSeries[]>(() => {
        const baseSeries: ChartSeries[] = [
            { dataKey: 'squat', label: t('reports.squat'), color: SBD_COLORS.squat },
            { dataKey: 'bench', label: t('reports.bench'), color: SBD_COLORS.bench },
            { dataKey: 'deadlift', label: t('reports.deadlift'), color: SBD_COLORS.deadlift },
        ]

        if (sbdLiftFilter === 'all') {
            return baseSeries
        }

        return baseSeries.filter((series) => series.dataKey === sbdLiftFilter)
    }, [sbdLiftFilter, t])

    const sbdChartData = useMemo<ChartRow[]>(() => {
        const chartRowsByDate = new Map<string, ChartRow>()

        sbdFilteredRecords.forEach((record) => {
            const sbdLift = matchSbdLift(record.exercise.name)
            if (!sbdLift) {
                return
            }

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

            const currentValue = chartRow[sbdLift]
            if (typeof currentValue !== 'number' || oneRepMax > currentValue) {
                chartRow[sbdLift] = oneRepMax
            }
        })

        return Array.from(chartRowsByDate.values()).sort((left, right) => left.dateKey.localeCompare(right.dateKey))
    }, [sbdFilteredRecords])

    const bestSbdOneRmByLift = useMemo(() => {
        const bestOneRmByLift: Record<SbdLiftValue, number | null> = {
            squat: null,
            bench: null,
            deadlift: null,
        }

        records.forEach((record) => {
            const sbdLift = matchSbdLift(record.exercise.name)
            if (!sbdLift) {
                return
            }

            const oneRepMax = calculateOneRepMax(record.weight, record.reps)
            const currentBest = bestOneRmByLift[sbdLift]

            if (currentBest === null || oneRepMax > currentBest) {
                bestOneRmByLift[sbdLift] = oneRepMax
            }
        })

        return bestOneRmByLift
    }, [records])

    const sbdKpiRows = useMemo<SbdKpiRow[]>(() => {
        const aggregates: Record<
            SbdLiftValue,
            {
                sessionDateKeys: Set<string>
                totalLifts: number
                weightedIntensitySum: number
                intensityLiftCount: number
            }
        > = {
            squat: {
                sessionDateKeys: new Set<string>(),
                totalLifts: 0,
                weightedIntensitySum: 0,
                intensityLiftCount: 0,
            },
            bench: {
                sessionDateKeys: new Set<string>(),
                totalLifts: 0,
                weightedIntensitySum: 0,
                intensityLiftCount: 0,
            },
            deadlift: {
                sessionDateKeys: new Set<string>(),
                totalLifts: 0,
                weightedIntensitySum: 0,
                intensityLiftCount: 0,
            },
        }

        sbdFilteredRecords.forEach((record) => {
            const sbdLift = matchSbdLift(record.exercise.name)
            if (!sbdLift) {
                return
            }

            const reps = Math.max(record.reps, 0)
            const sessionDateKey = normalizeRecordDateKey(record.recordDate)
            const aggregate = aggregates[sbdLift]
            aggregate.sessionDateKeys.add(sessionDateKey)
            aggregate.totalLifts += reps

            const bestOneRm = bestSbdOneRmByLift[sbdLift]
            if (bestOneRm && bestOneRm > 0 && reps > 0) {
                const intensity = (record.weight / bestOneRm) * 100
                aggregate.weightedIntensitySum += intensity * reps
                aggregate.intensityLiftCount += reps
            }
        })

        return SBD_LIFTS.map((lift) => {
            const aggregate = aggregates[lift]

            return {
                lift,
                label: t(`reports.${lift}`),
                frequency: aggregate.sessionDateKeys.size,
                totalLifts: aggregate.totalLifts,
                averageIntensity:
                    aggregate.intensityLiftCount > 0
                        ? aggregate.weightedIntensitySum / aggregate.intensityLiftCount
                        : null,
            }
        })
    }, [bestSbdOneRmByLift, sbdFilteredRecords, t])

    const visibleSbdKpiRows = useMemo(() => {
        if (sbdLiftFilter === 'all') {
            return sbdKpiRows
        }

        return sbdKpiRows.filter((row) => row.lift === sbdLiftFilter)
    }, [sbdKpiRows, sbdLiftFilter])

    const sbdKpiSummary = useMemo(() => {
        const totalFrequency = visibleSbdKpiRows.reduce((sum, row) => sum + row.frequency, 0)
        const totalLifts = visibleSbdKpiRows.reduce((sum, row) => sum + row.totalLifts, 0)

        const weightedIntensitySum = visibleSbdKpiRows.reduce((sum, row) => {
            if (row.averageIntensity === null) {
                return sum
            }

            return sum + row.averageIntensity * row.totalLifts
        }, 0)

        const intensityLifts = visibleSbdKpiRows.reduce((sum, row) => {
            if (row.averageIntensity === null) {
                return sum
            }

            return sum + row.totalLifts
        }, 0)

        return {
            totalFrequency,
            totalLifts,
            averageIntensity: intensityLifts > 0 ? weightedIntensitySum / intensityLifts : null,
        }
    }, [visibleSbdKpiRows])

    const timeWindowOptions: Array<{ value: RecordTimeWindow; label: string }> = [
        { value: '30d', label: t('common:common.personalRecordsExplorer.window30d') },
        { value: '90d', label: t('common:common.personalRecordsExplorer.window90d') },
        { value: '180d', label: t('common:common.personalRecordsExplorer.window180d') },
        { value: '365d', label: t('common:common.personalRecordsExplorer.window365d') },
        { value: 'all', label: t('common:common.personalRecordsExplorer.windowAll') },
    ]

    const sbdLiftOptions: Array<{ value: SbdLift; label: string }> = [
        { value: 'all', label: t('common:common.all') },
        { value: 'squat', label: t('reports.squat') },
        { value: 'bench', label: t('reports.bench') },
        { value: 'deadlift', label: t('reports.deadlift') },
    ]

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
                    <Link
                        href="/trainer/trainees"
                        className="text-brand-primary hover:text-brand-primary/80 text-sm font-semibold mb-4 inline-flex items-center gap-1"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        {t('athletes.backToAthletes')}
                    </Link>
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
                                                    <div className="flex items-center justify-end gap-3">
                                                        <Link
                                                            href={`/trainer/programs/${program.id}?backContext=trainee&traineeId=${traineeId}`}
                                                            className="text-brand-primary hover:text-brand-primary/80"
                                                            title={t('athletes.viewProgram')}
                                                            aria-label={t('athletes.viewProgram')}
                                                        >
                                                            <Eye size={18} />
                                                        </Link>
                                                        {program.status === 'draft' && (
                                                            <Link
                                                                href={`/trainer/programs/${program.id}/edit?backContext=trainee&traineeId=${traineeId}`}
                                                                className="text-green-600 hover:text-green-800"
                                                                title={t('common:common.edit')}
                                                                aria-label={t('common:common.edit')}
                                                            >
                                                                <Pencil size={18} />
                                                            </Link>
                                                        )}
                                                    </div>
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
                                                {t('common:common.personalRecordsExplorer.filterExercise')}
                                            </label>
                                            <select
                                                value={oneRmExerciseFilter}
                                                onChange={(event) => setOneRmExerciseFilter(event.target.value)}
                                                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
                                            >
                                                <option value="all">{t('common:common.personalRecordsExplorer.allExercises')}</option>
                                                {exerciseOptions.map((exercise) => (
                                                    <option key={exercise.id} value={exercise.id}>
                                                        {exercise.name}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
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
                                        {t('athletes.estimated1RM')} ({t('common:common.personalRecordsExplorer.filterWindow')})
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
                                            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-600">
                                                {t('reports.sbdReport')}
                                            </label>
                                            <select
                                                value={sbdLiftFilter}
                                                onChange={(event) => setSbdLiftFilter(event.target.value as SbdLift)}
                                                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
                                            >
                                                {sbdLiftOptions.map((option) => (
                                                    <option key={option.value} value={option.value}>
                                                        {option.label}
                                                    </option>
                                                ))}
                                            </select>
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
                                        <table className="min-w-full divide-y divide-slate-200 text-sm">
                                            <thead className="bg-slate-50 text-slate-500">
                                                <tr>
                                                    <th className="px-4 py-3 text-left font-semibold">{t('personalRecords.exercise')}</th>
                                                    <th className="px-4 py-3 text-left font-semibold">{t('editProgram.sbdFrq')}</th>
                                                    <th className="px-4 py-3 text-left font-semibold">{t('editProgram.sbdNbl')}</th>
                                                    <th className="px-4 py-3 text-left font-semibold">{t('editProgram.sbdIm')}</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100 bg-white">
                                                {visibleSbdKpiRows.map((row) => (
                                                    <tr key={row.lift} className="hover:bg-slate-50/70">
                                                        <td className="px-4 py-3 font-semibold text-slate-900">{row.label}</td>
                                                        <td className="px-4 py-3 text-slate-700">{row.frequency}</td>
                                                        <td className="px-4 py-3 text-slate-700">{row.totalLifts}</td>
                                                        <td className="px-4 py-3 text-slate-700">
                                                            {row.averageIntensity !== null ? `${row.averageIntensity.toFixed(1)}%` : '-'}
                                                        </td>
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
                                                    <YAxis tickFormatter={(value) => `${formatWeight(Number(value))}`} width={56} />
                                                    <Tooltip
                                                        formatter={(value, name) => {
                                                            const numericValue = Array.isArray(value)
                                                                ? Number(value[0] ?? 0)
                                                                : Number(value ?? 0)
                                                            const lineLabel =
                                                                sbdSeries.find((series) => series.dataKey === String(name))
                                                                    ?.label || String(name)

                                                            return [`${formatWeight(numericValue)} kg`, lineLabel]
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

                                    <p className="text-[11px] leading-4 text-slate-500">
                                        IM calcolata come intensita media ponderata sulle ripetizioni rispetto al miglior 1RM storico per categoria S/B/D.
                                    </p>
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
                                    <TraineePlannedMuscleGroupReport traineeId={traineeId} hideHeader embedded />
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
