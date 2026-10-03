'use client'

import { Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

export interface WeeklyTrendPoint {
    label: string
    sessions: number
    volumeKg: number
}

interface WeeklyTrendChartProps {
    data: WeeklyTrendPoint[]
    sessionsLabel: string
    volumeLabel: string
}

// brand.primary and gray-900 from tailwind.config.ts: recharts needs literal colours
const SESSIONS_COLOR = '#FFA700'
const VOLUME_COLOR = '#111827'

export default function WeeklyTrendChart({ data, sessionsLabel, volumeLabel }: WeeklyTrendChartProps) {
    return (
        <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                    <YAxis yAxisId="sessions" allowDecimals={false} tick={{ fontSize: 12 }} />
                    <YAxis yAxisId="volume" orientation="right" tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Legend />
                    <Bar yAxisId="sessions" dataKey="sessions" name={sessionsLabel} fill={SESSIONS_COLOR} radius={[4, 4, 0, 0]} />
                    <Line yAxisId="volume" dataKey="volumeKg" name={volumeLabel} type="monotone" stroke={VOLUME_COLOR} strokeWidth={2} dot={false} />
                </ComposedChart>
            </ResponsiveContainer>
        </div>
    )
}
