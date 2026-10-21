import type { WeightType } from '@prisma/client'

export type ParsedWeightInputMode =
    | 'empty'
    | 'absolute'
    | 'percentage_1rm'
    | 'percentage_previous'
    | 'invalid'

export interface ParsedWeightInputValue {
    mode: ParsedWeightInputMode
    value: number | null
}

export function formatWeightInputFromStoredValues(weightType: WeightType, weight: number | null): string {
    if (typeof weight !== 'number') {
        return ''
    }

    if (weightType === 'absolute') {
        return String(weight)
    }

    if (weightType === 'percentage_1rm') {
        return `${weight}%`
    }

    return `${weight}%`
}

export function parseWeightInputValue(rawValue: string): ParsedWeightInputValue {
    const trimmedValue = rawValue.trim()

    if (trimmedValue === '') {
        return { mode: 'empty', value: null }
    }

    const normalizedValue = trimmedValue.replace(/\s+/g, '').replace(',', '.')

    const percentagePreviousMatch = normalizedValue.match(/^-(\d+(?:\.\d+)?)%$/)
    if (percentagePreviousMatch) {
        return {
            mode: 'percentage_previous',
            value: -Number(percentagePreviousMatch[1]),
        }
    }

    const percentageOneRmMatch =
        normalizedValue.match(/^%(\d+(?:\.\d+)?)(?:1rm)?$/i) ||
        normalizedValue.match(/^(\d+(?:\.\d+)?)%1rm$/i) ||
        normalizedValue.match(/^(\d+(?:\.\d+)?)%$/)

    if (percentageOneRmMatch) {
        return {
            mode: 'percentage_1rm',
            value: Number(percentageOneRmMatch[1]),
        }
    }

    const absoluteMatch = normalizedValue.match(/^(\d+(?:\.\d+)?)(?:kg)?$/i)
    if (absoluteMatch) {
        return {
            mode: 'absolute',
            value: Number(absoluteMatch[1]),
        }
    }

    return {
        mode: 'invalid',
        value: null,
    }
}
