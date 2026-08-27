'use client'

import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronDown, ChevronUp } from 'lucide-react'
import ProgramMuscleGroupCharts from './ProgramMuscleGroupCharts'
import ProgramSbdSummaryTable from './ProgramSbdSummaryTable'
import {
    computeSbdMetricsByLiftAcrossWeeks,
    computeWeekSbdMetrics,
    type LiftLabels,
} from '@/lib/program-sbd-metrics'

export interface ProgramReportSectionWorkoutExercise {
    id: string
    sets: number
    reps: string
    isWarmup: boolean
    weightType: 'absolute' | 'percentage_1rm' | 'percentage_rm' | 'percentage_previous'
    weight: number | null
    exercise: {
        id: string
        name: string
        type: 'fundamental' | 'accessory'
        exerciseMuscleGroups: Array<{
            coefficient: number
            muscleGroup: {
                id: string
                name: string
            }
        }>
    }
}

export interface ProgramReportSectionWorkout {
    id: string
    workoutExercises: ProgramReportSectionWorkoutExercise[]
}

export interface ProgramReportSectionWeek {
    id: string
    weekNumber: number
    workouts: ProgramReportSectionWorkout[]
}

interface ProgramReportSectionProps {
    weeks: ProgramReportSectionWeek[]
    isSbdProgram: boolean
    oneRmByExerciseId: Record<string, number>
}

export default function ProgramReportSection({
    weeks,
    isSbdProgram,
    oneRmByExerciseId,
}: ProgramReportSectionProps) {
    const { t } = useTranslation('trainer')
    const [isSbdSummaryCollapsed, setIsSbdSummaryCollapsed] = useState(false)

    const liftLabels: LiftLabels = useMemo(
        () => ({
            squat: t('reports.squat'),
            bench: t('reports.bench'),
            deadlift: t('reports.deadlift'),
        }),
        [t],
    )

    const weekSbdMetrics = useMemo(
        () =>
            isSbdProgram
                ? computeWeekSbdMetrics({ weeks, oneRmByExerciseId, liftLabels })
                : {},
        [isSbdProgram, weeks, oneRmByExerciseId, liftLabels],
    )

    const sbdMetricsByLiftAcrossWeeks = useMemo(
        () =>
            isSbdProgram
                ? computeSbdMetricsByLiftAcrossWeeks({ weeks, weekSbdMetrics, liftLabels })
                : [],
        [isSbdProgram, weeks, weekSbdMetrics, liftLabels],
    )

    return (
        <>
            {isSbdProgram && sbdMetricsByLiftAcrossWeeks.length > 0 && (
                <div className="mb-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-md">
                    <button
                        type="button"
                        onClick={() => setIsSbdSummaryCollapsed((current) => !current)}
                        className="group flex w-full items-start justify-between gap-4 text-left"
                        aria-expanded={!isSbdSummaryCollapsed}
                    >
                        <div>
                            <h2 className="text-xl font-bold text-gray-900">{t('reviewProgram.sbdSummaryTitle')}</h2>
                            <p className="mt-2 text-sm text-gray-600">
                                {t('reviewProgram.sbdSummaryDescription')}
                            </p>
                        </div>
                        <span className="rounded-full border border-gray-200 bg-gray-50 p-2 text-gray-500 transition-colors group-hover:bg-gray-100">
                            {isSbdSummaryCollapsed ? (
                                <ChevronDown className="h-4 w-4" />
                            ) : (
                                <ChevronUp className="h-4 w-4" />
                            )}
                        </span>
                    </button>

                    {!isSbdSummaryCollapsed && (
                        <div className="mt-4">
                            <ProgramSbdSummaryTable
                                weeks={weeks}
                                metricsByLiftAcrossWeeks={sbdMetricsByLiftAcrossWeeks}
                            />
                        </div>
                    )}
                </div>
            )}

            <ProgramMuscleGroupCharts weeks={weeks} />
        </>
    )
}
