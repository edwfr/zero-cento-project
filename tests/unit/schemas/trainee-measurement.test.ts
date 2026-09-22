import { describe, it, expect } from 'vitest'
import {
    createMeasurementsSchema,
    updateMeasurementSchema,
} from '@/schemas/trainee-measurement'

const TRAINEE_ID = '11111111-1111-1111-1111-111111111111'

const validCreate = {
    traineeId: TRAINEE_ID,
    measuredAt: '2026-09-21',
    values: { weight: 78.5, arm: 38.5 },
}

const firstIssue = (result: { success: false; error: { errors: { message: string }[] } }) =>
    result.error.errors[0].message

describe('createMeasurementsSchema', () => {
    it('accepts a partial set of metrics', () => {
        const result = createMeasurementsSchema.safeParse(validCreate)

        expect(result.success).toBe(true)
        if (result.success) {
            expect(result.data.values).toEqual({ weight: 78.5, arm: 38.5 })
            expect(result.data.measuredAt.toISOString()).toBe('2026-09-21T00:00:00.000Z')
        }
    })

    it('rejects an empty values object', () => {
        const result = createMeasurementsSchema.safeParse({ ...validCreate, values: {} })

        expect(result.success).toBe(false)
        if (!result.success) expect(firstIssue(result as never)).toBe('validation.noMeasurementProvided')
    })

    it('rejects an unknown metric key', () => {
        const result = createMeasurementsSchema.safeParse({
            ...validCreate,
            values: { neck: 40 },
        })

        expect(result.success).toBe(false)
    })

    it('rejects a value outside the metric range', () => {
        const result = createMeasurementsSchema.safeParse({
            ...validCreate,
            values: { weight: 5 },
        })

        expect(result.success).toBe(false)
        if (!result.success) expect(firstIssue(result as never)).toBe('validation.measurementOutOfRange')
    })

    it('rejects a future date', () => {
        const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
        const result = createMeasurementsSchema.safeParse({ ...validCreate, measuredAt: tomorrow })

        expect(result.success).toBe(false)
        if (!result.success) expect(firstIssue(result as never)).toBe('validation.dateCannotBeFuture')
    })

    it('rejects an unparseable date as a validation issue', () => {
        const result = createMeasurementsSchema.safeParse({ ...validCreate, measuredAt: 'not-a-date' })

        expect(result.success).toBe(false)
        if (!result.success) expect(firstIssue(result as never)).toBe('validation.invalidDate')
    })

    it('accepts today', () => {
        const today = new Date().toISOString().slice(0, 10)
        const result = createMeasurementsSchema.safeParse({ ...validCreate, measuredAt: today })

        expect(result.success).toBe(true)
    })

    it('rejects an invalid trainee id', () => {
        const result = createMeasurementsSchema.safeParse({ ...validCreate, traineeId: 'nope' })

        expect(result.success).toBe(false)
        if (!result.success) expect(firstIssue(result as never)).toBe('validation.invalidTraineeId')
    })

    it('rejects notes longer than 500 chars', () => {
        const result = createMeasurementsSchema.safeParse({ ...validCreate, notes: 'x'.repeat(501) })

        expect(result.success).toBe(false)
    })
})

describe('updateMeasurementSchema', () => {
    it('accepts a single field', () => {
        const result = updateMeasurementSchema.safeParse({ value: 79 })

        expect(result.success).toBe(true)
    })

    it('accepts clearing the notes', () => {
        const result = updateMeasurementSchema.safeParse({ notes: null })

        expect(result.success).toBe(true)
    })

    it('rejects an empty payload', () => {
        const result = updateMeasurementSchema.safeParse({})

        expect(result.success).toBe(false)
        if (!result.success) expect(firstIssue(result as never)).toBe('validation.noFieldToUpdate')
    })

    it('rejects a non-positive value', () => {
        const result = updateMeasurementSchema.safeParse({ value: 0 })

        expect(result.success).toBe(false)
        if (!result.success) expect(firstIssue(result as never)).toBe('validation.valuePositive')
    })
})
