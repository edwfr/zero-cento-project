import { describe, it, expect } from 'vitest'
import {
    createMacroPeriodSchema,
    createMacroPhaseTypeSchema,
    updateMacroPeriodSchema,
    updateMacroPhaseTypeSchema,
} from '@/schemas/macro-period'

const PHASE_ID = '22222222-2222-2222-2222-222222222222'

describe('createMacroPhaseTypeSchema', () => {
    it('accepts a name and a colour, and trims the name', () => {
        const result = createMacroPhaseTypeSchema.safeParse({ name: '  Forza  ', color: '#2563eb' })
        expect(result.success).toBe(true)
        expect(result.success && result.data.name).toBe('Forza')
    })

    it('accepts a description up to 200 characters and a null description', () => {
        expect(createMacroPhaseTypeSchema.safeParse({ name: 'A', color: '#2563eb', description: 'x'.repeat(200) }).success).toBe(true)
        expect(createMacroPhaseTypeSchema.safeParse({ name: 'A', color: '#2563eb', description: null }).success).toBe(true)
    })

    it.each([
        ['empty name', { name: '   ', color: '#2563eb' }],
        ['name of 41 characters', { name: 'x'.repeat(41), color: '#2563eb' }],
        ['description of 201 characters', { name: 'A', color: '#2563eb', description: 'x'.repeat(201) }],
        ['3-digit colour', { name: 'A', color: '#FFF' }],
        ['named colour', { name: 'A', color: 'red' }],
        ['missing colour', { name: 'A' }],
    ])('rejects %s', (_label, input) => {
        expect(createMacroPhaseTypeSchema.safeParse(input).success).toBe(false)
    })

    it('accepts a name of exactly 40 characters', () => {
        expect(createMacroPhaseTypeSchema.safeParse({ name: 'x'.repeat(40), color: '#2563eb' }).success).toBe(true)
    })
})

describe('updateMacroPhaseTypeSchema', () => {
    it.each([{ name: 'Nuovo' }, { color: '#dc2626' }, { sortOrder: 0 }, { isActive: false }, { description: null }])(
        'accepts a single field %o',
        (input) => {
            expect(updateMacroPhaseTypeSchema.safeParse(input).success).toBe(true)
        }
    )

    it.each([
        ['empty body', {}],
        ['negative sortOrder', { sortOrder: -1 }],
        ['fractional sortOrder', { sortOrder: 1.5 }],
        ['isActive as a string', { isActive: 'false' }],
        ['bad colour', { color: 'blue' }],
    ])('rejects %s', (_label, input) => {
        expect(updateMacroPhaseTypeSchema.safeParse(input).success).toBe(false)
    })
})

describe('createMacroPeriodSchema', () => {
    const valid = { phaseTypeId: PHASE_ID, startDate: '2026-10-05', endDate: '2026-10-18' }

    it('accepts a Monday → Sunday range', () => {
        expect(createMacroPeriodSchema.safeParse(valid).success).toBe(true)
        expect(createMacroPeriodSchema.safeParse({ ...valid, note: 'x'.repeat(500) }).success).toBe(true)
    })

    it.each([
        ['start not on Monday', { ...valid, startDate: '2026-10-06' }],
        ['end not on Sunday', { ...valid, endDate: '2026-10-17' }],
        ['end before start', { ...valid, startDate: '2026-10-19' }],
        ['impossible date', { ...valid, startDate: '2026-02-30' }],
        ['date with time', { ...valid, startDate: '2026-10-05T00:00:00.000Z' }],
        ['phase id not a uuid', { ...valid, phaseTypeId: 'abc' }],
        ['note of 501 characters', { ...valid, note: 'x'.repeat(501) }],
        ['missing end', { phaseTypeId: PHASE_ID, startDate: '2026-10-05' }],
    ])('rejects %s', (_label, input) => {
        expect(createMacroPeriodSchema.safeParse(input).success).toBe(false)
    })

    it('reports the range problem with the macroPeriodInvalidRange key', () => {
        const result = createMacroPeriodSchema.safeParse({ ...valid, endDate: '2026-10-17' })
        expect(result.success).toBe(false)
        expect(!result.success && result.error.errors[0].message).toBe('validation.macroPeriodInvalidRange')
    })
})

describe('updateMacroPeriodSchema', () => {
    it.each([{ startDate: '2026-10-12' }, { endDate: '2026-10-25' }, { note: null }, { phaseTypeId: PHASE_ID }])(
        'accepts a single field %o',
        (input) => {
            expect(updateMacroPeriodSchema.safeParse(input).success).toBe(true)
        }
    )

    it('does not check the weekday of a lone date (the route merges first)', () => {
        expect(updateMacroPeriodSchema.safeParse({ startDate: '2026-10-07' }).success).toBe(true)
    })

    it.each([
        ['empty body', {}],
        ['impossible date', { endDate: '2026-02-30' }],
        ['phase id not a uuid', { phaseTypeId: 'abc' }],
    ])('rejects %s', (_label, input) => {
        expect(updateMacroPeriodSchema.safeParse(input).success).toBe(false)
    })
})
