'use client'

import { useState } from 'react'
import { FileDown, Loader2 } from 'lucide-react'
import {
    exportProgramToPdf,
    ProgramPdfData,
    ProgramPdfLabels,
} from '@/lib/program-pdf-export'

interface ProgramPdfExportButtonProps {
    program: ProgramPdfData | null
    labels: ProgramPdfLabels
    buttonLabel: string
    loadingLabel: string
    errorLabel: string
    className?: string
    logoUrl?: string
    fileNamePrefix?: string
    locale?: string
}

export default function ProgramPdfExportButton({
    program,
    labels,
    buttonLabel,
    loadingLabel,
    errorLabel,
    className,
    logoUrl,
    fileNamePrefix,
    locale,
}: ProgramPdfExportButtonProps) {
    const [isExporting, setIsExporting] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const handleExport = async () => {
        if (!program || isExporting) {
            return
        }

        try {
            setIsExporting(true)
            setError(null)

            await exportProgramToPdf(program, labels, {
                logoUrl,
                fileNamePrefix,
                locale,
            })
        } catch {
            setError(errorLabel)
        } finally {
            setIsExporting(false)
        }
    }

    return (
        <div className={className}>
            <button
                type="button"
                onClick={handleExport}
                disabled={!program || isExporting}
                className="inline-flex items-center gap-2 rounded-lg border border-brand-primary/30 bg-brand-primary/10 px-4 py-2 text-sm font-semibold text-brand-primary transition-colors hover:bg-brand-primary/15 disabled:cursor-not-allowed disabled:opacity-60"
            >
                {isExporting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                    <FileDown className="h-4 w-4" />
                )}
                {isExporting ? loadingLabel : buttonLabel}
            </button>

            {error && (
                <p className="mt-2 text-xs font-medium text-red-600">
                    {error}
                </p>
            )}
        </div>
    )
}