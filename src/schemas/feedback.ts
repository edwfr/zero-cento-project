import { z } from 'zod'

/**
 * Feedback Validation Schemas
 */

export const setPerformedSchema = z.object({
    setNumber: z
        .number()
        .int('Numero serie deve essere intero')
        .min(1, 'Minimo serie 1')
        .max(50, 'Massimo 50 serie'),
    completed: z.boolean().default(true),
    reps: z
        .number()
        .int('Ripetizioni deve essere intero')
        .min(0, 'Minimo 0 ripetizioni')
        .max(50, 'Massimo 50 ripetizioni'),
    weight: z
        .number()
        .min(0, 'Peso minimo 0 kg')
        .max(500, 'Peso massimo 500 kg'),
})

export const feedbackSchema = z.object({
    workoutExerciseId: z.string().uuid('ID esercizio workout non valido'),
    completed: z.boolean().default(false),
    actualRpe: z
        .number()
        .min(5.0, 'RPE minimo 5.0')
        .max(10.0, 'RPE massimo 10.0')
        .multipleOf(0.5, 'RPE deve essere multiplo di 0.5')
        .nullish(),
    sets: z
        .array(setPerformedSchema)
        .min(1, 'Almeno una serie richiesta')
        .max(50, 'Massimo 50 serie'),
    notes: z.string().max(1000, 'Note troppo lunghe (max 1000 caratteri)').nullish(),
})

export const updateFeedbackSchema = feedbackSchema.partial().extend({
    id: z.string().uuid(),
})

export const weekFeedbackSchema = z.object({
    weekId: z.string().uuid('ID settimana non valido'),
    generalFeedback: z
        .string()
        .min(10, 'Feedback troppo breve (minimo 10 caratteri)')
        .max(2000, 'Feedback troppo lungo (max 2000 caratteri)'),
})

export type SetPerformedInput = z.infer<typeof setPerformedSchema>
export type FeedbackInput = z.infer<typeof feedbackSchema>
export type UpdateFeedbackInput = z.infer<typeof updateFeedbackSchema>
export type WeekFeedbackInput = z.infer<typeof weekFeedbackSchema>
