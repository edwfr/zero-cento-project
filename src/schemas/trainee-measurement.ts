import { z } from 'zod'
import {
    MEASUREMENT_METRICS,
    MEASUREMENT_METRIC_META,
    toMeasurementDay,
    type MeasurementMetric,
} from '@/lib/measurements'

/**
 * Trainee Measurement Validation Schemas
 *
 * Ranges come from MEASUREMENT_METRIC_META, so adding a metric needs no edit here.
 * Messages are i18n keys (project convention), resolved client-side.
 */

const measuredAtSchema = z
    .union([z.string(), z.date()])
    .transform((val, ctx) => {
        const date = typeof val === 'string' ? new Date(val) : val
        if (isNaN(date.getTime())) {
            // An issue, not a throw: a throw escapes safeParse and surfaces as a 500
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'validation.invalidDate' })
            return z.NEVER
        }
        return toMeasurementDay(date)
    })
    .refine((date) => date <= toMeasurementDay(new Date()), 'validation.dateCannotBeFuture')

function metricValueSchema(metric: MeasurementMetric) {
    const { min, max } = MEASUREMENT_METRIC_META[metric]
    return z
        .number()
        .min(min, 'validation.measurementOutOfRange')
        .max(max, 'validation.measurementOutOfRange')
        .optional()
}

const valuesShape = Object.fromEntries(
    MEASUREMENT_METRICS.map((metric) => [metric, metricValueSchema(metric)])
) as { [K in MeasurementMetric]: ReturnType<typeof metricValueSchema> }

export const createMeasurementsSchema = z.object({
    traineeId: z.string().uuid('validation.invalidTraineeId'),
    measuredAt: measuredAtSchema,
    notes: z.string().max(500).optional(),
    values: z
        .object(valuesShape)
        .strict()
        .refine(
            (values) => Object.values(values).some((value) => value !== undefined),
            'validation.noMeasurementProvided'
        ),
})

export const updateMeasurementSchema = z
    .object({
        // The metric-specific range is checked in the route, where the row's metric is known
        value: z.number().positive('validation.valuePositive').optional(),
        measuredAt: measuredAtSchema.optional(),
        notes: z.string().max(500).nullable().optional(),
    })
    .refine(
        (payload) =>
            payload.value !== undefined ||
            payload.measuredAt !== undefined ||
            payload.notes !== undefined,
        'validation.noFieldToUpdate'
    )

export type CreateMeasurementsInput = z.infer<typeof createMeasurementsSchema>
export type UpdateMeasurementInput = z.infer<typeof updateMeasurementSchema>
