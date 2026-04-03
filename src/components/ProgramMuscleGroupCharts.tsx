'use client'

import { Fragment, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { calculateTrainingSets } from '@/lib/calculations'
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

const PRIMARY_COLOR = '#FFA700'
const MUSCLE_GROUP_CHART_COLORS = [
    '#FFA700',
    '#0F766E',
    '#2563EB',
    '#DC2626',
    '#7C3AED',
    '#0891B2',
    '#65A30D',
    '#EA580C',
]

interface WorkoutExerciseMuscleGroup {
    coefficient: number
    muscleGroup: {
        id: string
        name: string
    }
}

interface ProgramWorkoutExerciseForCharts {
    id: string
    sets: number
    isWarmup: boolean
    exercise: {
        exerciseMuscleGroups: WorkoutExerciseMuscleGroup[]
    }
}

interface ProgramWorkoutForCharts {
    id: string
    workoutExercises: ProgramWorkoutExerciseForCharts[]
}

export interface ProgramWeekForCharts {
    id: string
    weekNumber: number
    workouts: ProgramWorkoutForCharts[]
}

interface ProgramMuscleGroupChartsProps {
    weeks: ProgramWeekForCharts[]
}

export default function ProgramMuscleGroupCharts({ weeks }: ProgramMuscleGroupChartsProps) {
    const { t } = useTranslation('trainer')
    const [visibleMuscleGroupIds, setVisibleMuscleGroupIds] = useState<string[]>([])

    const formatTrainingSetsValue = (value: number) => {
        return Number.isInteger(value) ? value.toString() : value.toFixed(1)
    }

    const getHeatmapCellColor = (value: number, maxValue: number, baseColor: string) => {
        if (value <= 0 || maxValue <= 0) {
            return '#F3F4F6'
        }

        const normalized = Math.max(0.18, value / maxValue)
        const hex = baseColor.replace('#', '')
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

        return `rgba(${red}, ${green}, ${blue}, ${normalized})`
    }

    const muscleGroupCatalog = new Map<string, { id: string; name: string }>()

    const weeklyMuscleGroupTotals = weeks.map((week) => {
        const totals = new Map<string, number>()

        week.workouts.forEach((workout) => {
            workout.workoutExercises.forEach((workoutExercise) => {
                workoutExercise.exercise.exerciseMuscleGroups.forEach((entry) => {
                    muscleGroupCatalog.set(entry.muscleGroup.id, entry.muscleGroup)

                    const trainingSets = calculateTrainingSets(
                        workoutExercise.sets,
                        entry.coefficient,
                        workoutExercise.isWarmup
                    )

                    if (trainingSets <= 0) {
                        return
                    }

                    totals.set(
                        entry.muscleGroup.id,
                        (totals.get(entry.muscleGroup.id) || 0) + trainingSets
                    )
                })
            })
        })

        return {
            weekNumber: week.weekNumber,
            totals,
        }
    })

    const muscleGroupSeries = Array.from(muscleGroupCatalog.values())
        .sort((a, b) => a.name.localeCompare(b.name, 'it', { sensitivity: 'base' }))
        .map((muscleGroup, index) => ({
            ...muscleGroup,
            color: MUSCLE_GROUP_CHART_COLORS[index % MUSCLE_GROUP_CHART_COLORS.length],
        }))

    useEffect(() => {
        setVisibleMuscleGroupIds((currentIds) => {
            const availableIds = muscleGroupSeries.map((muscleGroup) => muscleGroup.id)

            if (availableIds.length === 0) {
                return currentIds.length === 0 ? currentIds : []
            }

            if (currentIds.length === 0) {
                return availableIds
            }

            const nextIds = currentIds.filter((id) => availableIds.includes(id))

            if (nextIds.length === 0) {
                return availableIds
            }

            const hasSameIds =
                nextIds.length === currentIds.length && nextIds.every((id, index) => id === currentIds[index])

            return hasSameIds ? currentIds : nextIds
        })
    }, [muscleGroupSeries])

    const weeklyMuscleGroupChartData = weeklyMuscleGroupTotals.map(({ weekNumber, totals }) => {
        const chartRow: Record<string, number | string> = {
            weekNumber,
            weekLabel: `${t('editProgram.week')} ${weekNumber}`,
        }

        muscleGroupSeries.forEach((muscleGroup) => {
            chartRow[muscleGroup.id] = Number((totals.get(muscleGroup.id) || 0).toFixed(1))
        })

        return chartRow
    })

    const visibleMuscleGroups = muscleGroupSeries.filter((muscleGroup) =>
        visibleMuscleGroupIds.includes(muscleGroup.id)
    )

    const hasWeeklyMuscleGroupData = weeklyMuscleGroupChartData.some((row) =>
        muscleGroupSeries.some((muscleGroup) => Number(row[muscleGroup.id] || 0) > 0)
    )

    const hasVisibleWeeklyMuscleGroupData = weeklyMuscleGroupChartData.some((row) =>
        visibleMuscleGroups.some((muscleGroup) => Number(row[muscleGroup.id] || 0) > 0)
    )

    const heatmapMaxValue = weeklyMuscleGroupChartData.reduce((maxValue, row) => {
        return Math.max(
            maxValue,
            ...visibleMuscleGroups.map((muscleGroup) => Number(row[muscleGroup.id] || 0))
        )
    }, 0)

    const toggleMuscleGroupVisibility = (muscleGroupId: string) => {
        setVisibleMuscleGroupIds((currentIds) => {
            if (currentIds.includes(muscleGroupId)) {
                if (currentIds.length === 1) {
                    return currentIds
                }

                return currentIds.filter((id) => id !== muscleGroupId)
            }

            return [...currentIds, muscleGroupId]
        })
    }

    const showAllMuscleGroups = () => {
        setVisibleMuscleGroupIds(muscleGroupSeries.map((muscleGroup) => muscleGroup.id))
    }

    const heatmapLegendStops = [0, 0.33, 0.66, 1].map((stop) => ({
        stop,
        color: getHeatmapCellColor(heatmapMaxValue * stop, heatmapMaxValue, PRIMARY_COLOR),
    }))

    return (
        <div className="mt-8 mb-8 space-y-8">
            <div className="bg-white rounded-lg shadow-md p-6">
                <div className="mb-6">
                    <h2 className="text-xl font-bold text-gray-900">
                        {t('editProgram.trainingSetsHeatmapTitle')}
                    </h2>
                    <p className="text-sm text-gray-600 mt-2">
                        {t('editProgram.trainingSetsHeatmapDescription')}
                    </p>
                </div>

                {hasWeeklyMuscleGroupData && (
                    <div className="mb-6 space-y-4">
                        <div>
                            <div className="flex items-center justify-between gap-3 flex-wrap">
                                <p className="text-sm font-medium text-gray-700">
                                    {t('editProgram.trainingSetsFilterTitle')}
                                </p>
                                <button
                                    type="button"
                                    onClick={showAllMuscleGroups}
                                    className="text-sm font-semibold text-[#0F766E] hover:text-[#115E59]"
                                >
                                    {t('editProgram.trainingSetsFilterReset')}
                                </button>
                            </div>
                            <div className="mt-3 flex flex-wrap gap-2">
                                {muscleGroupSeries.map((muscleGroup) => {
                                    const isActive = visibleMuscleGroupIds.includes(muscleGroup.id)

                                    return (
                                        <button
                                            key={muscleGroup.id}
                                            type="button"
                                            onClick={() => toggleMuscleGroupVisibility(muscleGroup.id)}
                                            className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-colors ${isActive
                                                ? 'border-slate-300 bg-slate-100 text-slate-900 hover:bg-slate-200'
                                                : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50 hover:text-gray-900'
                                                }`}
                                        >
                                            <span
                                                className="h-2.5 w-2.5 rounded-full"
                                                style={{ backgroundColor: muscleGroup.color }}
                                            />
                                            {muscleGroup.name}
                                        </button>
                                    )
                                })}
                            </div>
                        </div>

                        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                            <div className="flex items-center justify-between gap-4 flex-wrap">
                                <p className="text-sm font-medium text-gray-700">
                                    {t('editProgram.trainingSetsHeatmapLegendTitle')}
                                </p>
                                <div className="flex items-center gap-3 text-xs text-gray-600">
                                    <span>{t('editProgram.trainingSetsHeatmapLegendLow')}</span>
                                    <div className="flex items-center gap-1">
                                        {heatmapLegendStops.map((item, index) => (
                                            <span
                                                key={`${item.stop}-${index}`}
                                                className="h-4 w-8 rounded-sm border border-white/70"
                                                style={{ backgroundColor: item.color }}
                                            />
                                        ))}
                                    </div>
                                    <span>{t('editProgram.trainingSetsHeatmapLegendHigh')}</span>
                                    <span className="rounded-full bg-white px-2 py-1 font-semibold text-gray-700">
                                        {t('editProgram.trainingSetsHeatmapLegendMax', {
                                            value: formatTrainingSetsValue(heatmapMaxValue),
                                            unit: t('editProgram.trainingSetsUnit'),
                                        })}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {hasVisibleWeeklyMuscleGroupData ? (
                    <>
                        <div className="overflow-x-auto">
                            <div
                                className="grid gap-2 min-w-max"
                                style={{
                                    gridTemplateColumns: `minmax(180px, 220px) repeat(${weeklyMuscleGroupChartData.length}, minmax(64px, 1fr))`,
                                }}
                            >
                                <div className="sticky left-0 z-10 bg-white" />
                                {weeklyMuscleGroupChartData.map((row) => (
                                    <div
                                        key={String(row.weekNumber)}
                                        className="rounded-md bg-gray-50 px-2 py-3 text-center text-xs font-semibold text-gray-600"
                                    >
                                        {row.weekLabel}
                                    </div>
                                ))}

                                {visibleMuscleGroups.map((muscleGroup) => (
                                    <Fragment key={muscleGroup.id}>
                                        <div className="sticky left-0 z-10 flex items-center rounded-md bg-white pr-3 text-sm font-medium text-gray-700">
                                            <span
                                                className="mr-3 inline-block h-3 w-3 rounded-full"
                                                style={{ backgroundColor: muscleGroup.color }}
                                            />
                                            {muscleGroup.name}
                                        </div>
                                        {weeklyMuscleGroupChartData.map((row) => {
                                            const value = Number(row[muscleGroup.id] || 0)

                                            return (
                                                <div
                                                    key={`${muscleGroup.id}-${String(row.weekNumber)}`}
                                                    className="flex h-14 items-center justify-center rounded-md border border-white/60 text-xs font-semibold"
                                                    style={{
                                                        backgroundColor: getHeatmapCellColor(
                                                            value,
                                                            heatmapMaxValue,
                                                            muscleGroup.color
                                                        ),
                                                        color: value > 0 ? '#111827' : '#9CA3AF',
                                                    }}
                                                    title={`${muscleGroup.name} - ${String(row.weekLabel)}: ${formatTrainingSetsValue(value)} ${t('editProgram.trainingSetsUnit')}`}
                                                >
                                                    {value > 0 ? formatTrainingSetsValue(value) : '-'}
                                                </div>
                                            )
                                        })}
                                    </Fragment>
                                ))}
                            </div>
                        </div>
                        <p className="text-xs text-gray-500 mt-4">
                            {t('editProgram.trainingSetsHeatmapFootnote')}
                        </p>
                    </>
                ) : hasWeeklyMuscleGroupData ? (
                    <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 px-4 py-8 text-center text-sm text-gray-600">
                        {t('editProgram.trainingSetsFilterEmpty')}
                    </div>
                ) : (
                    <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 px-4 py-8 text-center text-sm text-gray-600">
                        {t('editProgram.trainingSetsByMuscleGroupEmpty')}
                    </div>
                )}
            </div>

            <div className="overflow-hidden bg-white rounded-lg shadow-md p-6">
                <div className="mb-6">
                    <h2 className="text-xl font-bold text-gray-900">
                        {t('editProgram.trainingSetsTrendTitle')}
                    </h2>
                    <p className="text-sm text-gray-600 mt-2">
                        {t('editProgram.trainingSetsTrendDescription')}
                    </p>
                </div>

                {hasVisibleWeeklyMuscleGroupData ? (
                    <>
                        <div className="h-[28rem]">
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={weeklyMuscleGroupChartData} margin={{ left: 12, right: 12 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                    <XAxis dataKey="weekLabel" />
                                    <YAxis />
                                    <Tooltip
                                        formatter={(value: number, name: string) => [
                                            `${formatTrainingSetsValue(Number(value))} ${t('editProgram.trainingSetsUnit')}`,
                                            muscleGroupSeries.find((muscleGroup) => muscleGroup.id === name)
                                                ?.name || name,
                                        ]}
                                    />
                                    <Legend
                                        formatter={(value) =>
                                            visibleMuscleGroups.find((muscleGroup) => muscleGroup.id === value)
                                                ?.name || value
                                        }
                                    />
                                    {visibleMuscleGroups.map((muscleGroup) => (
                                        <Line
                                            key={muscleGroup.id}
                                            type="monotone"
                                            dataKey={muscleGroup.id}
                                            stroke={muscleGroup.color}
                                            strokeWidth={2.5}
                                            dot={{ r: 3 }}
                                            activeDot={{ r: 5 }}
                                        />
                                    ))}
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                        <p className="text-xs text-gray-500 mt-4">
                            {t('editProgram.trainingSetsTrendFootnote')}
                        </p>
                    </>
                ) : hasWeeklyMuscleGroupData ? (
                    <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 px-4 py-8 text-center text-sm text-gray-600">
                        {t('editProgram.trainingSetsFilterEmpty')}
                    </div>
                ) : (
                    <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 px-4 py-8 text-center text-sm text-gray-600">
                        {t('editProgram.trainingSetsByMuscleGroupEmpty')}
                    </div>
                )}
            </div>
        </div>
    )
}