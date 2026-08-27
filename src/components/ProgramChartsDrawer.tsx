'use client'

import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { X } from 'lucide-react'
import ProgramReportSection, {
    type ProgramReportSectionWeek,
} from './ProgramReportSection'

interface ProgramChartsDrawerProps {
    isOpen: boolean
    onClose: () => void
    weeks: ProgramReportSectionWeek[]
    isSbdProgram: boolean
    oneRmByExerciseId: Record<string, number>
}

export default function ProgramChartsDrawer({
    isOpen,
    onClose,
    weeks,
    isSbdProgram,
    oneRmByExerciseId,
}: ProgramChartsDrawerProps) {
    const { t } = useTranslation('trainer')

    useEffect(() => {
        if (!isOpen) return
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') onClose()
        }
        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [isOpen, onClose])

    return (
        <>
            <div
                className={`fixed inset-0 bg-black/40 z-50 transition-opacity duration-200 ${
                    isOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
                }`}
                onClick={onClose}
                aria-hidden="true"
            />
            <aside
                role="dialog"
                aria-modal="true"
                aria-label={t('editProgram.chartsPanelTitle')}
                className={`fixed top-0 right-0 h-full w-full sm:max-w-3xl bg-white shadow-xl z-[60] overflow-y-auto transition-transform duration-200 ${
                    isOpen ? 'translate-x-0' : 'translate-x-full'
                }`}
            >
                <div className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-gray-200 bg-white px-6 py-4">
                    <h2 className="text-lg font-bold text-gray-900">
                        {t('editProgram.chartsPanelTitle')}
                    </h2>
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label={t('editProgram.chartsPanelClose')}
                        title={t('editProgram.chartsPanelClose')}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 transition-colors hover:bg-gray-100"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>
                <div className="px-6 py-6">
                    {isOpen && (
                        <ProgramReportSection
                            weeks={weeks}
                            isSbdProgram={isSbdProgram}
                            oneRmByExerciseId={oneRmByExerciseId}
                        />
                    )}
                </div>
            </aside>
        </>
    )
}
