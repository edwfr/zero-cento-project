export interface WarmupPartition<T> {
    warmup: T[]
    main: T[]
}

/** Splits workout exercises into warm-up and main, both sorted by `order`. */
export function partitionWarmup<T extends { isWarmup: boolean; order: number }>(
    exercises: readonly T[]
): WarmupPartition<T> {
    const sorted = [...exercises].sort((a, b) => a.order - b.order)
    return {
        warmup: sorted.filter((e) => e.isWarmup),
        main: sorted.filter((e) => !e.isWarmup),
    }
}
