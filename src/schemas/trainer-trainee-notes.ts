import { z } from 'zod'

export const EMPTY_TRAINER_TRAINEE_NOTE_DOCUMENT = {
    type: 'doc',
    content: [{ type: 'paragraph' }],
} as const

const MAX_DOCUMENT_NODES = 500
const MAX_DOCUMENT_DEPTH = 16
const MAX_DOCUMENT_TEXT_LENGTH = 50_000
const HEX_COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/

const allowedBlockNodeTypes = new Set([
    'paragraph',
    'hardBreak',
    'bulletList',
    'orderedList',
    'listItem',
    'table',
    'tableRow',
    'tableHeader',
    'tableCell',
])

type SanitizedNode = {
    type: string
    text?: string
    marks?: Array<{ type: string; attrs?: Record<string, unknown> }>
    attrs?: Record<string, unknown>
    content?: SanitizedNode[]
}

type SanitizeState = {
    nodeCount: number
    textLength: number
    tooComplex: boolean
    tooLong: boolean
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function sanitizeMarks(rawMarks: unknown): SanitizedNode['marks'] {
    if (!Array.isArray(rawMarks)) {
        return undefined
    }

    const cleaned: NonNullable<SanitizedNode['marks']> = []

    for (const rawMark of rawMarks) {
        if (!isRecord(rawMark) || typeof rawMark.type !== 'string') {
            continue
        }

        if (rawMark.type === 'bold') {
            cleaned.push({ type: 'bold' })
            continue
        }

        if (rawMark.type === 'italic') {
            cleaned.push({ type: 'italic' })
            continue
        }

        if (rawMark.type === 'textStyle') {
            const attrs = isRecord(rawMark.attrs) ? rawMark.attrs : {}
            const color = typeof attrs.color === 'string' && HEX_COLOR_PATTERN.test(attrs.color)
                ? attrs.color
                : undefined

            if (color) {
                cleaned.push({ type: 'textStyle', attrs: { color } })
            }
        }
    }

    return cleaned.length > 0 ? cleaned : undefined
}

function sanitizeTableCellAttrs(rawAttrs: unknown): Record<string, unknown> | undefined {
    if (!isRecord(rawAttrs)) {
        return undefined
    }

    const attrs: Record<string, unknown> = {}
    const colspan = Number(rawAttrs.colspan)
    const rowspan = Number(rawAttrs.rowspan)

    if (Number.isInteger(colspan) && colspan >= 1 && colspan <= 20) {
        attrs.colspan = colspan
    }
    if (Number.isInteger(rowspan) && rowspan >= 1 && rowspan <= 20) {
        attrs.rowspan = rowspan
    }

    if (Array.isArray(rawAttrs.colwidth)) {
        const colwidth = rawAttrs.colwidth
            .map((width) => Number(width))
            .filter((width) => Number.isInteger(width) && width > 0 && width <= 2000)
        if (colwidth.length === rawAttrs.colwidth.length && colwidth.length > 0) {
            attrs.colwidth = colwidth
        } else {
            attrs.colwidth = null
        }
    } else if (rawAttrs.colwidth === null || rawAttrs.colwidth === undefined) {
        attrs.colwidth = null
    }

    return Object.keys(attrs).length > 0 ? attrs : undefined
}

function sanitizeOrderedListAttrs(rawAttrs: unknown): Record<string, unknown> | undefined {
    if (!isRecord(rawAttrs)) {
        return undefined
    }

    const start = Number(rawAttrs.start)
    if (Number.isInteger(start) && start >= 1) {
        return { start }
    }

    return undefined
}

function sanitizeChildren(rawChildren: unknown[], depth: number, state: SanitizeState): SanitizedNode[] {
    const result: SanitizedNode[] = []
    for (const raw of rawChildren) {
        if (state.tooComplex || state.tooLong) {
            break
        }
        const sanitized = sanitizeNode(raw, depth, state)
        if (sanitized) {
            result.push(sanitized)
        }
    }
    return result
}

function sanitizeNode(node: unknown, depth: number, state: SanitizeState): SanitizedNode | null {
    if (state.tooComplex || state.tooLong) {
        return null
    }

    if (!isRecord(node) || typeof node.type !== 'string') {
        return null
    }

    if (depth > MAX_DOCUMENT_DEPTH) {
        state.tooComplex = true
        return null
    }

    state.nodeCount += 1
    if (state.nodeCount > MAX_DOCUMENT_NODES) {
        state.tooComplex = true
        return null
    }

    if (node.type === 'text') {
        if (typeof node.text !== 'string' || node.text.length === 0) {
            return null
        }

        state.textLength += node.text.length
        if (state.textLength > MAX_DOCUMENT_TEXT_LENGTH) {
            state.tooLong = true
            return null
        }

        const sanitized: SanitizedNode = { type: 'text', text: node.text }
        const marks = sanitizeMarks(node.marks)
        if (marks) {
            sanitized.marks = marks
        }
        return sanitized
    }

    if (!allowedBlockNodeTypes.has(node.type)) {
        if (!Array.isArray(node.content)) {
            return null
        }
        const inlineFallback = sanitizeChildren(node.content, depth + 1, state)
        if (inlineFallback.length === 0) {
            return null
        }
        return { type: 'paragraph', content: inlineFallback }
    }

    const sanitized: SanitizedNode = { type: node.type }

    if (node.type === 'orderedList') {
        const attrs = sanitizeOrderedListAttrs(node.attrs)
        if (attrs) {
            sanitized.attrs = attrs
        }
    } else if (node.type === 'tableCell' || node.type === 'tableHeader') {
        const attrs = sanitizeTableCellAttrs(node.attrs)
        if (attrs) {
            sanitized.attrs = attrs
        }
    }

    if (node.type === 'hardBreak') {
        return sanitized
    }

    if (Array.isArray(node.content)) {
        const children = sanitizeChildren(node.content, depth + 1, state)
        if (children.length > 0) {
            sanitized.content = children
        }
    }

    return sanitized
}

function cloneEmptyDocument(): SanitizedNode {
    return { type: 'doc', content: [{ type: 'paragraph' }] }
}

export function sanitizeTrainerNoteDocument(input: unknown): {
    document: SanitizedNode
    tooComplex: boolean
    tooLong: boolean
} {
    const state: SanitizeState = { nodeCount: 0, textLength: 0, tooComplex: false, tooLong: false }

    if (!isRecord(input) || input.type !== 'doc') {
        return { document: cloneEmptyDocument(), tooComplex: false, tooLong: false }
    }

    state.nodeCount += 1

    const children = Array.isArray(input.content)
        ? sanitizeChildren(input.content, 1, state)
        : []

    const document: SanitizedNode = {
        type: 'doc',
        content: children.length > 0 ? children : [{ type: 'paragraph' }],
    }

    return { document, tooComplex: state.tooComplex, tooLong: state.tooLong }
}

export const trainerTraineeNotesSchema = z
    .object({ document: z.unknown() })
    .superRefine((value, ctx) => {
        const { tooComplex, tooLong } = sanitizeTrainerNoteDocument(value.document)
        if (tooComplex) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['document'],
                message: 'validation.trainerNoteTooComplex',
            })
        }
        if (tooLong) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['document'],
                message: 'validation.trainerNoteTooLong',
            })
        }
    })
    .transform((value) => ({
        document: sanitizeTrainerNoteDocument(value.document).document,
    }))

export type TrainerTraineeNotesInput = z.infer<typeof trainerTraineeNotesSchema>
