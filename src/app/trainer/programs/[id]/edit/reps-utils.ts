export function parseRepsString(reps: string): { min: string; max: string } {
    const rangeMatch = reps.match(/^(\d+)-(\d+)$/)
    if (rangeMatch) {
        return { min: rangeMatch[1], max: rangeMatch[2] }
    }
    return { min: reps, max: '' }
}

export function buildRepsString(min: string, max: string): string {
    const trimMax = max.trim()
    if (trimMax === '') return min.trim()
    return `${min.trim()}-${trimMax}`
}
