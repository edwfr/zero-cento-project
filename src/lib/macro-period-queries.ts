import type { Prisma } from '@prisma/client'
import { prisma } from './prisma'
import {
    dbDateToIsoDay,
    type MacroPeriodDto,
    type MacroPhaseTypeDto,
    type PlanProgramDto,
} from './macro-periods'

export const PHASE_TYPE_SELECT = {
    id: true,
    name: true,
    description: true,
    color: true,
    sortOrder: true,
    isActive: true,
    _count: { select: { periods: true } },
} satisfies Prisma.MacroPhaseTypeSelect

type PhaseTypeRow = Prisma.MacroPhaseTypeGetPayload<{ select: typeof PHASE_TYPE_SELECT }>

export function toPhaseTypeDto({ _count, ...phase }: PhaseTypeRow): MacroPhaseTypeDto {
    return { ...phase, usageCount: _count.periods }
}

export const PERIOD_SELECT = {
    id: true,
    startDate: true,
    endDate: true,
    note: true,
    phaseType: { select: { id: true, name: true, color: true, isActive: true } },
} satisfies Prisma.MacroPeriodSelect

type PeriodRow = Prisma.MacroPeriodGetPayload<{ select: typeof PERIOD_SELECT }>

export function toPeriodDto(period: PeriodRow): MacroPeriodDto {
    return {
        id: period.id,
        startDate: dbDateToIsoDay(period.startDate),
        endDate: dbDateToIsoDay(period.endDate),
        note: period.note,
        phaseType: period.phaseType,
    }
}

export const PLAN_PROGRAM_SELECT = {
    id: true,
    title: true,
    status: true,
    startDate: true,
    durationWeeks: true,
} satisfies Prisma.TrainingProgramSelect

type PlanProgramRow = Prisma.TrainingProgramGetPayload<{ select: typeof PLAN_PROGRAM_SELECT }>

/** Null for a program without a start date: it has no place on a timeline. */
export function toPlanProgramDto(program: PlanProgramRow): PlanProgramDto | null {
    if (!program.startDate) return null
    return {
        id: program.id,
        title: program.title,
        status: program.status,
        startDate: dbDateToIsoDay(program.startDate),
        durationWeeks: program.durationWeeks,
    }
}

/** Phase names are unique per trainer whatever the letter case. */
export function findPhaseNameClash(trainerId: string, name: string, ignoreId?: string) {
    return prisma.macroPhaseType.findFirst({
        where: {
            trainerId,
            name: { equals: name, mode: 'insensitive' },
            ...(ignoreId ? { id: { not: ignoreId } } : {}),
        },
        select: { id: true },
    })
}
