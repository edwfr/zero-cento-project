'use client'

import { useState, type ReactNode } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface PaginatedListProps {
    /** Server-rendered <li> rows, already keyed */
    items: ReactNode[]
    pageSize: number
    previousLabel: string
    nextLabel: string
}

/** Client-side pager for widget rows: the server renders every row, this shows one page at a time. */
export default function PaginatedList({ items, pageSize, previousLabel, nextLabel }: PaginatedListProps) {
    const [page, setPage] = useState(0)
    const pages = Math.ceil(items.length / pageSize)
    const current = Math.min(page, Math.max(0, pages - 1))
    const buttonClass =
        'flex h-9 w-9 items-center justify-center rounded-full text-gray-600 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent'

    return (
        <>
            <ul className="-mx-2 divide-y divide-gray-100">{items.slice(current * pageSize, (current + 1) * pageSize)}</ul>
            {pages > 1 && (
                <div className="mt-3 flex items-center justify-end gap-2 text-sm text-gray-600">
                    <button
                        type="button"
                        className={buttonClass}
                        onClick={() => setPage(current - 1)}
                        disabled={current === 0}
                        aria-label={previousLabel}
                    >
                        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                    </button>
                    <span aria-live="polite">
                        {current + 1} / {pages}
                    </span>
                    <button
                        type="button"
                        className={buttonClass}
                        onClick={() => setPage(current + 1)}
                        disabled={current === pages - 1}
                        aria-label={nextLabel}
                    >
                        <ChevronRight className="h-4 w-4" aria-hidden="true" />
                    </button>
                </div>
            )}
        </>
    )
}
