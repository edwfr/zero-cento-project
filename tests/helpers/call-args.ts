/**
 * Loose view over a Prisma call argument. The typed mock gives the real
 * argument types, which are unions of select/include shapes: fine to build,
 * awkward to walk in an assertion. Use this only to read a recorded call.
 */
export interface CallArg {
    [key: string]: CallArg
}

export const callArg = (value: unknown): CallArg => value as unknown as CallArg
