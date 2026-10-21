'use client'

import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { X } from 'lucide-react'
import RPEOneRMTable from './RPEOneRMTable'
import BodyweightRPETable from './BodyweightRPETable'

interface RpeTablesDrawerProps {
    isOpen: boolean
    onClose: () => void
}

export default function RpeTablesDrawer({ isOpen, onClose }: RpeTablesDrawerProps) {
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
                data-testid="rpe-tables-overlay"
                className={`fixed inset-0 bg-black/40 z-50 transition-opacity duration-200 ${
                    isOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
                }`}
                onClick={onClose}
                aria-hidden="true"
            />
            <aside
                role="dialog"
                aria-modal="true"
                aria-label={t('editProgram.rpeTablesPanelTitle')}
                className={`fixed top-0 right-0 h-full w-full sm:max-w-3xl bg-white shadow-xl z-[60] overflow-y-auto transition-transform duration-200 ${
                    isOpen ? 'translate-x-0' : 'translate-x-full'
                }`}
            >
                <div className="sticky top-0 z-30 flex items-center justify-between gap-4 border-b border-gray-200 bg-white px-6 py-4">
                    <h2 className="text-lg font-bold text-gray-900">
                        {t('editProgram.rpeTablesPanelTitle')}
                    </h2>
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label={t('editProgram.rpeTablesPanelClose')}
                        title={t('editProgram.rpeTablesPanelClose')}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 transition-colors hover:bg-gray-100"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>
                <div className="px-6 py-6">
                    {isOpen && (
                        <>
                            <RPEOneRMTable defaultOpen />
                            <BodyweightRPETable defaultOpen className="mt-6" />
                        </>
                    )}
                </div>
            </aside>
        </>
    )
}
