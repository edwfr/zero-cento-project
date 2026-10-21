import { describe, it, expect } from 'vitest'
import {
    formatWeightInputFromStoredValues,
    parseWeightInputValue,
} from '@/app/trainer/programs/[id]/edit/weight-input'

describe('parseWeightInputValue', () => {
    it.each(['80%RM', '%80rm', '80%rm'])('rejects the removed %s format', (raw) => {
        expect(parseWeightInputValue(raw)).toEqual({ mode: 'invalid', value: null })
    })

    it.each(['75%', '%75', '75%1RM'])('reads %s as percentage of 1RM', (raw) => {
        expect(parseWeightInputValue(raw)).toEqual({ mode: 'percentage_1rm', value: 75 })
    })

    it('reads a negative percentage as relative to the previous occurrence', () => {
        expect(parseWeightInputValue('-10%')).toEqual({ mode: 'percentage_previous', value: -10 })
    })

    it.each(['100', '100kg'])('reads %s as an absolute weight', (raw) => {
        expect(parseWeightInputValue(raw)).toEqual({ mode: 'absolute', value: 100 })
    })

    it('accepts a decimal comma', () => {
        expect(parseWeightInputValue('72,5')).toEqual({ mode: 'absolute', value: 72.5 })
    })

    it('reads an empty string as empty', () => {
        expect(parseWeightInputValue('  ')).toEqual({ mode: 'empty', value: null })
    })

    it('rejects free text', () => {
        expect(parseWeightInputValue('abc')).toEqual({ mode: 'invalid', value: null })
    })
})

describe('formatWeightInputFromStoredValues', () => {
    it('formats a percentage of 1RM with a percent sign', () => {
        expect(formatWeightInputFromStoredValues('percentage_1rm', 75)).toBe('75%')
    })

    it('formats a relative percentage with a percent sign', () => {
        expect(formatWeightInputFromStoredValues('percentage_previous', -10)).toBe('-10%')
    })

    it('formats an absolute weight as a bare number', () => {
        expect(formatWeightInputFromStoredValues('absolute', 100)).toBe('100')
    })

    it('returns an empty string without a weight', () => {
        expect(formatWeightInputFromStoredValues('absolute', null)).toBe('')
    })
})
