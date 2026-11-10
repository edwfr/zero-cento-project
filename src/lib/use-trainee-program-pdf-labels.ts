'use client'

import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import type { WeekType } from '@prisma/client'
import type { ProgramPdfLabels } from '@/lib/program-pdf-export'
import { formatBallastLabel, type BallastDisplay } from '@/lib/bodyweight-load'

export interface TraineeProgramPdfConfig {
    labels: ProgramPdfLabels
    fileNamePrefix: string
    locale: 'it-IT' | 'en-GB'
    unknownTraineeName: string
    ballastLabel: (ballast: BallastDisplay) => string
}

/**
 * Labels and options of the athlete program PDF. Always reads the `trainee`
 * namespace, so a trainer exporting the athlete PDF gets the same document.
 */
export function useTraineeProgramPdfLabels(): TraineeProgramPdfConfig {
    const { t, i18n } = useTranslation(['trainee', 'common'])
    const language = i18n.language

    return useMemo<TraineeProgramPdfConfig>(() => {
        const tCommon = (key: string, options?: Record<string, unknown>) =>
            t(`common:${key}`, options) as string

        const labels: ProgramPdfLabels = {
            trainerLabel: t('trainee:currentProgram.pdfTrainerLabel'),
            startDateLabel: t('trainee:currentProgram.pdfStartDateLabel'),
            generatedAtLabel: t('trainee:currentProgram.pdfGeneratedAtLabel'),
            weekLabel: (week: number) => t('trainee:currentProgram.week', { number: week }),
            weekTypeLabel: (weekType: WeekType) => {
                const weekTypeLabels: Record<WeekType, string> = {
                    tecnica: t('trainee:currentProgram.weekTypeTecnica'),
                    ipertrofia: t('trainee:currentProgram.weekTypeIpertrofia'),
                    volume: t('trainee:currentProgram.weekTypeVolume'),
                    forza_generale: t('trainee:currentProgram.weekTypeForzaGenerale'),
                    intensificazione: t('trainee:currentProgram.weekTypeIntensificazione'),
                    picco: t('trainee:currentProgram.weekTypePicco'),
                    test: t('trainee:currentProgram.weekTypeTest'),
                    deload: t('trainee:currentProgram.weekTypeDeload'),
                }
                return weekTypeLabels[weekType]
            },
            workoutLabel: (dayIndex: number) => t('trainee:currentProgram.day', { number: dayIndex }),
            tableExercise: t('trainee:currentProgram.tableExercise'),
            tableVariant: t('trainee:currentProgram.tableVariant'),
            tableSets: t('trainee:currentProgram.tableSets'),
            tableReps: t('trainee:currentProgram.tableReps'),
            tableRpe: t('trainee:currentProgram.tableRpe'),
            tableWeight: t('trainee:currentProgram.tableWeight'),
            tableRest: t('trainee:currentProgram.tableRest'),
            tableNoExercises: t('trainee:currentProgram.tableNoExercises'),
            warmupYesShort: t('trainee:currentProgram.warmupYesShort'),
            jumpSetShort: t('trainee:currentProgram.jumpSetShort'),
            superSetShort: t('trainee:currentProgram.superSetShort'),
            missingValue: t('trainee:currentProgram.tableMissingValue'),
        }

        return {
            labels,
            fileNamePrefix: t('trainee:currentProgram.pdfFileNamePrefix'),
            locale: language === 'en' ? 'en-GB' : 'it-IT',
            unknownTraineeName: t('trainee:currentProgram.pdfUnknownTrainee'),
            ballastLabel: (ballast: BallastDisplay) => formatBallastLabel(ballast, tCommon),
        }
    }, [t, language])
}
