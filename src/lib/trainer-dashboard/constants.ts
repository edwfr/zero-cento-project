/** Trainer home thresholds. Fixed by design: no per-trainer settings. */
export const INACTIVITY_DAYS = 7
export const PROGRAM_ENDING_DAYS = 7
export const HIGH_RPE_THRESHOLD = 9
export const RECENT_WINDOW_DAYS = 7
export const TREND_WEEKS = 8
export const CONSISTENCY_WEEKS = 4

export const LIST_LIMITS = {
    inactive: 6,
    feedback: 10,
    feed: 15,
    records: 6,
    ranking: 5,
} as const
