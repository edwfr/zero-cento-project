import type { ErrorEvent } from '@sentry/nextjs'

const NOISE_TYPES = new Set(['AbortError', 'ChunkLoadError'])
const CHUNK_LOAD_MESSAGE = /Loading chunk [\w-]+ failed/i
const EXTENSION_FRAME = /^(chrome|moz|safari(-web)?)-extension:\/\//

/**
 * Client-side noise that would eat the Sentry free-plan quota (5k errors/month)
 * without pointing at a bug in our code.
 */
export function shouldDropClientEvent(event: ErrorEvent): boolean {
    const exception = event.exception?.values?.[0]
    if (!exception) return false

    if (exception.type && NOISE_TYPES.has(exception.type)) return true
    if (exception.value && CHUNK_LOAD_MESSAGE.test(exception.value)) return true

    const filenames = (exception.stacktrace?.frames ?? [])
        .map((frame) => frame.filename)
        .filter((filename): filename is string => Boolean(filename))
    if (filenames.length > 0 && filenames.every((f) => EXTENSION_FRAME.test(f))) return true

    return false
}
