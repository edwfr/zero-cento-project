'use client'

import { useCallback, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useToast } from '@/components/ToastNotification'
import { getApiErrorMessage } from '@/lib/api-error'
import { exportProgramToPdf } from '@/lib/program-pdf-export'
import { apiProgramToPdfSource, buildProgramPdfData, type ApiProgramForPdf } from '@/lib/program-pdf-data'
import { useTraineeProgramPdfLabels } from '@/lib/use-trainee-program-pdf-labels'

/**
 * Trainer-side export of the athlete PDF: fetches the program with weights
 * resolved on the athlete, maps it like the athlete page and downloads it.
 * One export at a time; a call while one runs is ignored.
 */
export function useTrainerProgramPdfExport(): {
    exportProgramPdf: (programId: string) => Promise<void>
    exportingProgramId: string | null
} {
    const { t } = useTranslation(['trainer', 'common'])
    const { showToast } = useToast()
    const { labels, fileNamePrefix, locale, unknownTraineeName, ballastLabel } = useTraineeProgramPdfLabels()
    const inFlightRef = useRef(false)
    const [exportingProgramId, setExportingProgramId] = useState<string | null>(null)

    const exportProgramPdf = useCallback(
        async (programId: string) => {
            if (inFlightRef.current) {
                return
            }
            inFlightRef.current = true
            setExportingProgramId(programId)

            try {
                const res = await fetch(`/api/programs/${programId}?resolveWeights=trainee`, { cache: 'no-store' })
                if (!res.ok) {
                    // A gateway error page is not JSON: fall back to the generic message.
                    const errorBody = await res.json().catch(() => null)
                    showToast(getApiErrorMessage(errorBody, t('programs.exportPdfError'), t), 'error')
                    return
                }
                const body = await res.json()

                const data = buildProgramPdfData(
                    apiProgramToPdfSource(body.data.program as ApiProgramForPdf),
                    { unknownTraineeName, ballastLabel }
                )
                await exportProgramToPdf(data, labels, { fileNamePrefix, locale })
            } catch {
                // Network, parse and PDF-chunk failures carry technical messages: never show them.
                showToast(t('programs.exportPdfError'), 'error')
            } finally {
                inFlightRef.current = false
                setExportingProgramId(null)
            }
        },
        [t, showToast, labels, fileNamePrefix, locale, unknownTraineeName, ballastLabel]
    )

    return { exportProgramPdf, exportingProgramId }
}
