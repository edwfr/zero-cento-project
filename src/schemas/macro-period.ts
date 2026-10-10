import { z } from 'zod'
import { isIsoDay, isValidPeriodRange } from '@/lib/macro-periods'

/**
 * Macro-period planning validation.
 * Messages are i18n keys (project convention), resolved client-side.
 */

const isoDaySchema = z.string().refine(isIsoDay, 'validation.invalidDate')

const phaseNameSchema = z
    .string()
    .trim()
    .min(1, 'validation.macroPhaseNameRequired')
    .max(40, 'validation.macroPhaseNameTooLong')

const phaseDescriptionSchema = z.string().trim().max(200, 'validation.macroPhaseDescriptionTooLong').nullable()

const phaseColorSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'validation.invalidColor')

const periodNoteSchema = z.string().trim().max(500, 'validation.macroPeriodNoteTooLong').nullable()

const hasAtLeastOneField = (value: Record<string, unknown>) => Object.keys(value).length > 0

export const createMacroPhaseTypeSchema = z.object({
    name: phaseNameSchema,
    description: phaseDescriptionSchema.optional(),
    color: phaseColorSchema,
})

export const updateMacroPhaseTypeSchema = z
    .object({
        name: phaseNameSchema.optional(),
        description: phaseDescriptionSchema.optional(),
        color: phaseColorSchema.optional(),
        sortOrder: z.number().int().min(0).optional(),
        isActive: z.boolean().optional(),
    })
    .refine(hasAtLeastOneField, 'validation.noFieldsToUpdate')

export const createMacroPeriodSchema = z
    .object({
        phaseTypeId: z.string().uuid('validation.invalidPhaseType'),
        startDate: isoDaySchema,
        endDate: isoDaySchema,
        note: periodNoteSchema.optional(),
    })
    .refine((value) => isValidPeriodRange(value.startDate, value.endDate), {
        message: 'validation.macroPeriodInvalidRange',
        path: ['endDate'],
    })

/** The range is validated in the route, after merging with the stored period. */
export const updateMacroPeriodSchema = z
    .object({
        phaseTypeId: z.string().uuid('validation.invalidPhaseType').optional(),
        startDate: isoDaySchema.optional(),
        endDate: isoDaySchema.optional(),
        note: periodNoteSchema.optional(),
    })
    .refine(hasAtLeastOneField, 'validation.noFieldsToUpdate')

export type CreateMacroPhaseTypeInput = z.infer<typeof createMacroPhaseTypeSchema>
export type UpdateMacroPhaseTypeInput = z.infer<typeof updateMacroPhaseTypeSchema>
export type CreateMacroPeriodInput = z.infer<typeof createMacroPeriodSchema>
export type UpdateMacroPeriodInput = z.infer<typeof updateMacroPeriodSchema>
