import { describe, it, expect } from 'vitest'
import { partitionWarmup } from '@/lib/workout-warmup'

const ex = (order: number, isWarmup: boolean) => ({ order, isWarmup })

describe('partitionWarmup', () => {
    it('returns empty lists for empty input', () => {
        expect(partitionWarmup([])).toEqual({ warmup: [], main: [] })
    })

    it('splits warm-up from main', () => {
        const warm = ex(1, true)
        const { warmup, main } = partitionWarmup([ex(2, false), warm, ex(3, false)])
        expect(warmup).toEqual([warm])
        expect(main.map((e) => e.order)).toEqual([2, 3])
    })

    it('sorts both lists by order', () => {
        const { warmup, main } = partitionWarmup([ex(3, false), ex(4, true), ex(1, false), ex(2, true)])
        expect(main.map((e) => e.order)).toEqual([1, 3])
        expect(warmup.map((e) => e.order)).toEqual([2, 4])
    })

    it('has no fallback when all are warm-up', () => {
        const { warmup, main } = partitionWarmup([ex(2, true), ex(1, true)])
        expect(warmup.map((e) => e.order)).toEqual([1, 2])
        expect(main).toEqual([])
    })

    it('returns all sorted as main when no warm-up', () => {
        const { warmup, main } = partitionWarmup([ex(2, false), ex(1, false)])
        expect(warmup).toEqual([])
        expect(main.map((e) => e.order)).toEqual([1, 2])
    })

    it('does not mutate the input', () => {
        const input = [ex(3, false), ex(1, true), ex(2, false)]
        partitionWarmup(input)
        expect(input.map((e) => e.order)).toEqual([3, 1, 2])
    })
})
