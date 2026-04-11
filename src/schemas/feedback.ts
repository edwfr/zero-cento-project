import { z } from 'zod'

/**
 * Feedback Validation Schemas
 */

export const setPerformedSchema = z.object({
    setNumber: z
        .number()
        .int('validation.setsInteger')
        .min(1, 'validation.minSets')
        .max(50, 'validation.maxSets'),
    completed: z.boolean().default(true),
    reps: z
        .number()
        .int('validation.repsInteger')
        .min(0, 'validation.minReps')
        .max(50, 'validation.maxReps'),
    weight: z
        .number()
        .min(0, 'validation.minWeight')
        .max(500, 'validation.maxWeight'),
})

export const feedbackSchema = z.object({
    workoutExerciseId: z.string().uuid('validation.invalidWorkoutExerciseId'),
    completed: z.boolean().default(false),
    actualRpe: z
        .number()
        .min(5.0, 'validation.rpeMin')
        .max(10.0, 'validation.rpeMax')
        .multipleOf(0.5, 'validation.rpeStep')
        .nullish(),
    sets: z
        .array(setPerformedSchema)
        .min(1, 'validation.minOneSeries')
        .max(50, 'validation.maxSeries'),
    notes: z.string().max(1000, 'validation.notesTooLong').nullish(),
})

export const updateFeedbackSchema = feedbackSchema.partial().extend({
    id: z.string().uuid(),
})

export const weekFeedbackSchema = z.object({
    weekId: z.string().uuid('validation.invalidWeekId'),
    generalFeedback: z
        .string()
        .min(10, 'validation.feedbackTooShort')
        .max(2000, 'validation.feedbackTooLong'),
})

export type SetPerformedInput = z.infer<typeof setPerformedSchema>
export type FeedbackInput = z.infer<typeof feedbackSchema>
export type UpdateFeedbackInput = z.infer<typeof updateFeedbackSchema>
export type WeekFeedbackInput = z.infer<typeof weekFeedbackSchema>
