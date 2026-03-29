'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import LoadingSpinner from '@/components/LoadingSpinner'

interface Trainee {
    id: string
    firstName: string
    lastName: string
    email: string
    isActive: boolean
    createdAt: string
}

interface Program {
    id: string
    title: string
    status: 'draft' | 'active' | 'completed'
    durationWeeks: number
    startDate: string | null
    endDate: string | null
}

interface PersonalRecord {
    id: string
    weight: number
    reps: number
    recordDate: string
    exercise: {
        id: string
        name: string
        type: 'fundamental' | 'accessory'
    }
}

export default function TraineeProfilePage() {
    const params = useParams<{ id: string }>()
    const router = useRouter()
    const traineeId = params.id

    const [loading, setLoading] = useState(true)
    const [trainee, setTrainee] = useState<Trainee | null>(null)
    const [programs, setPrograms] = useState<Program[]>([])
    const [records, setRecords] = useState<PersonalRecord[]>([])
    const [error, setError] = useState<string | null>(null)
    const [activeTab, setActiveTab] = useState<'programs' | 'records' | 'stats'>('programs')

    useEffect(() => {
        fetchTraineeData()
    }, [traineeId])

    const fetchTraineeData = async () => {
        try {
            setLoading(true)

            const [traineeRes, programsRes, recordsRes] = await Promise.all([
                fetch(`/api/users/${traineeId}`),
                fetch(`/api/programs?traineeId=${traineeId}`),
                fetch(`/api/personal-records?traineeId=${traineeId}`),
            ])

            const [traineeData, programsData, recordsData] = await Promise.all([
                traineeRes.json(),
                programsRes.json(),
                recordsRes.json(),
            ])

            if (!traineeRes.ok) {
                throw new Error(traineeData.error?.message || 'Atleta non trovato')
            }

            setTrainee(traineeData.data.user)
            setPrograms(programsData.data?.programs || [])
            setRecords(recordsData.data?.records || [])
        } catch (err: any) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    const calculateOneRepMax = (weight: number, reps: number): number => {
        if (reps === 1) return weight
        // Brzycki formula
        return Math.round(weight * (36 / (37 - reps)) * 10) / 10
    }

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'draft':
                return 'bg-yellow-100 text-yellow-800'
            case 'active':
                return 'bg-green-100 text-green-800'
            case 'completed':
                return 'bg-gray-100 text-gray-600'
            default:
                return 'bg-gray-100 text-gray-600'
        }
    }

    const getStatusLabel = (status: string) => {
        switch (status) {
            case 'draft':
                return 'Bozza'
            case 'active':
                return 'Attivo'
            case 'completed':
                return 'Completato'
            default:
                return status
        }
    }

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <LoadingSpinner size="lg" />
            </div>
        )
    }

    if (error || !trainee) {
        return (
            <div className="min-h-screen bg-gray-50">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                    <div className="bg-red-50 border border-red-200 text-red-800 px-6 py-4 rounded-lg">
                        {error || 'Atleta non trovato'}
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gray-50">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Header */}
                <div className="mb-8">
                    <Link
                        href="/trainer/trainees"
                        className="text-blue-600 hover:text-blue-700 text-sm font-semibold mb-4 inline-block"
                    >
                        ← Torna agli atleti
                    </Link>
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-3xl font-bold text-gray-900">
                                {trainee.firstName} {trainee.lastName}
                            </h1>
                            <p className="text-gray-600 mt-2">{trainee.email}</p>
                        </div>
                        <div className="flex items-center space-x-4">
                            <span
                                className={`px-4 py-2 text-sm font-semibold rounded-full ${trainee.isActive
                                        ? 'bg-green-100 text-green-800'
                                        : 'bg-red-100 text-red-800'
                                    }`}
                            >
                                {trainee.isActive ? 'Attivo' : 'Disattivato'}
                            </span>
                            <Link
                                href={`/trainer/trainees/${traineeId}/records`}
                                className="bg-[#FFA700] hover:bg-[#FF9500] text-white font-semibold px-6 py-2 rounded-lg transition-colors"
                            >
                                📊 Gestisci Massimali
                            </Link>
                        </div>
                    </div>
                </div>

                {/* Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    <div className="bg-white rounded-lg shadow-md p-6">
                        <div className="text-sm text-gray-500 mb-1">Programmi Totali</div>
                        <div className="text-3xl font-bold text-gray-900">{programs.length}</div>
                    </div>
                    <div className="bg-white rounded-lg shadow-md p-6">
                        <div className="text-sm text-gray-500 mb-1">Programmi Attivi</div>
                        <div className="text-3xl font-bold text-green-600">
                            {programs.filter((p) => p.status === 'active').length}
                        </div>
                    </div>
                    <div className="bg-white rounded-lg shadow-md p-6">
                        <div className="text-sm text-gray-500 mb-1">Massimali Registrati</div>
                        <div className="text-3xl font-bold text-[#FFA700]">{records.length}</div>
                    </div>
                </div>

                {/* Tabs */}
                <div className="mb-6">
                    <div className="border-b border-gray-200">
                        <nav className="-mb-px flex space-x-8">
                            <button
                                onClick={() => setActiveTab('programs')}
                                className={`pb-4 px-1 border-b-2 font-semibold text-sm ${activeTab === 'programs'
                                        ? 'border-[#FFA700] text-[#FFA700]'
                                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                    }`}
                            >
                                📋 Programmi ({programs.length})
                            </button>
                            <button
                                onClick={() => setActiveTab('records')}
                                className={`pb-4 px-1 border-b-2 font-semibold text-sm ${activeTab === 'records'
                                        ? 'border-[#FFA700] text-[#FFA700]'
                                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                    }`}
                            >
                                💪 Massimali ({records.length})
                            </button>
                        </nav>
                    </div>
                </div>

                {/* Tab Content */}
                {activeTab === 'programs' && (
                    <div>
                        {programs.length === 0 ? (
                            <div className="bg-white rounded-lg shadow-md p-12 text-center">
                                <p className="text-gray-500 text-lg mb-4">
                                    Nessun programma assegnato
                                </p>
                                <Link
                                    href="/trainer/programs/new"
                                    className="inline-block bg-[#FFA700] hover:bg-[#FF9500] text-white font-semibold px-6 py-2 rounded-lg transition-colors"
                                >
                                    Crea Nuovo Programma
                                </Link>
                            </div>
                        ) : (
                            <div className="bg-white rounded-lg shadow-md overflow-hidden">
                                <table className="min-w-full divide-y divide-gray-200">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">
                                                Programma
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">
                                                Stato
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">
                                                Durata
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">
                                                Inizio
                                            </th>
                                            <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase">
                                                Azioni
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                        {programs.map((program) => (
                                            <tr key={program.id} className="hover:bg-gray-50">
                                                <td className="px-6 py-4">
                                                    <div className="font-semibold text-gray-900">
                                                        {program.title}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <span
                                                        className={`px-2 py-1 text-xs font-semibold rounded-full ${getStatusBadge(
                                                            program.status
                                                        )}`}
                                                    >
                                                        {getStatusLabel(program.status)}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                                                    {program.durationWeeks} settimane
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                                                    {program.startDate
                                                        ? new Date(
                                                            program.startDate
                                                        ).toLocaleDateString('it-IT')
                                                        : '—'}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-right">
                                                    <Link
                                                        href={`/trainer/programs/${program.id}`}
                                                        className="text-blue-600 hover:text-blue-800 text-sm font-semibold"
                                                    >
                                                        Visualizza →
                                                    </Link>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'records' && (
                    <div>
                        {records.length === 0 ? (
                            <div className="bg-white rounded-lg shadow-md p-12 text-center">
                                <p className="text-gray-500 text-lg mb-4">Nessun massimale registrato</p>
                                <Link
                                    href={`/trainer/trainees/${traineeId}/records`}
                                    className="inline-block bg-[#FFA700] hover:bg-[#FF9500] text-white font-semibold px-6 py-2 rounded-lg transition-colors"
                                >
                                    Aggiungi Massimale
                                </Link>
                            </div>
                        ) : (
                            <div className="bg-white rounded-lg shadow-md overflow-hidden">
                                <table className="min-w-full divide-y divide-gray-200">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">
                                                Esercizio
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">
                                                Peso (kg)
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">
                                                Ripetizioni
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">
                                                1RM Stimato
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">
                                                Data
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                        {records.map((record) => (
                                            <tr key={record.id} className="hover:bg-gray-50">
                                                <td className="px-6 py-4">
                                                    <div className="font-semibold text-gray-900">
                                                        {record.exercise.name}
                                                    </div>
                                                    <div className="text-xs text-gray-500">
                                                        {record.exercise.type === 'fundamental'
                                                            ? 'Fondamentale'
                                                            : 'Accessorio'}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                                                    {record.weight} kg
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                                                    {record.reps} reps
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-[#FFA700]">
                                                    {calculateOneRepMax(record.weight, record.reps)}{' '}
                                                    kg
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                                                    {new Date(record.recordDate).toLocaleDateString(
                                                        'it-IT'
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}
