/** Trainer home thresholds. Fixed by design: no per-trainer settings. */
export const INACTIVITY_DAYS = 7
export const PROGRAM_ENDING_DAYS = 7
export const RECENT_WINDOW_DAYS = 7
export const CONSISTENCY_WEEKS = 4
/** Rows per page in the paginated widgets (ending programs, subscriptions) */
export const WIDGET_PAGE_SIZE = 6

export const LIST_LIMITS = {
    inactive: 6,
    feed: 15,
    ranking: 5,
} as const
