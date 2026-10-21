'use client'

import { useTranslation } from 'react-i18next'
import {
    BODYWEIGHT_LOADED_REP_RANGE,
    BODYWEIGHT_LOADED_RPE_CHART,
    BODYWEIGHT_LOADED_RPE_LEVELS,
} from '@/lib/calculations'
import RPEOneRMTable from './RPEOneRMTable'

interface BodyweightRPETableProps {
    className?: string
    defaultOpen?: boolean
}

const formatPercentage = (pct: number): string =>
    Number.isInteger(pct) ? `${pct}%` : `${pct.toFixed(1)}%`

export default function BodyweightRPETable({ className, defaultOpen }: BodyweightRPETableProps) {
    const { t } = useTranslation('common')

    return (
        <RPEOneRMTable
            className={className}
            defaultOpen={defaultOpen}
            chart={BODYWEIGHT_LOADED_RPE_CHART}
            rpeLevels={BODYWEIGHT_LOADED_RPE_LEVELS}
            repRange={BODYWEIGHT_LOADED_REP_RANGE}
            formatPercentage={formatPercentage}
            i18nPrefix="common.bodyweightRpeTable"
            showFormula={false}
            notes={[
                t('common.bodyweightRpeTable.noteExample'),
                t('common.bodyweightRpeTable.noteBallast'),
                t('common.bodyweightRpeTable.noteDisclaimer'),
            ]}
        />
    )
}
