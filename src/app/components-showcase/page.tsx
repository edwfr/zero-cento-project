'use client'

import { useState } from 'react'
import { Users, Dumbbell, Star, ClipboardList, Medal, TrendingDown, BarChart2, Trophy, Settings, Mail, Lock, Save, Trash2, Plus, Check } from 'lucide-react'
import {
    Button,
    Input,
    Textarea,
    FormLabel,
    Card,
    RPESelector,
    ExerciseCard,
    MovementPatternTag,
    YoutubeEmbed,
    WeekTypeBanner,
    LoadingSpinner,
    FullPageLoader,
    InlineLoader,
    ToastProvider,
    useToast,
    ProgressBar,
    StatCard,
    ConfirmationModal,
    ErrorBoundary,
    NavigationCard,
    DatePicker,
    AutocompleteSearch,
} from '@/components'
import type { AutocompleteOption } from '@/components'

function ComponentShowcase() {
    const { showToast } = useToast()

    // Design System Base Components State
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [notes, setNotes] = useState('')
    const [bio, setBio] = useState('')
    const [isButtonLoading, setIsButtonLoading] = useState(false)

    // Existing State
    const [rpe, setRpe] = useState<number | null>(null)
    const [showFullPageLoader, setShowFullPageLoader] = useState(false)
    const [confirmModalOpen, setConfirmModalOpen] = useState(false)
    const [confirmVariant, setConfirmVariant] = useState<'danger' | 'warning' | 'info' | 'success'>('danger')
    const [isConfirming, setIsConfirming] = useState(false)
    const [dateValue, setDateValue] = useState<string>('')
    const [dateWithDefault, setDateWithDefault] = useState<string>('2026-03-29')
    const [selectedExercise, setSelectedExercise] = useState<AutocompleteOption | null>(null)
    const [autocompleteQuery, setAutocompleteQuery] = useState<string>('')

    const exerciseOptions: AutocompleteOption[] = [
        { id: '1', label: 'Back Squat', sublabel: 'Squat · Quadricipiti, Glutei' },
        { id: '2', label: 'Romanian Deadlift', sublabel: 'Hinge · Ischiocrurali' },
        { id: '3', label: 'Bench Press', sublabel: 'Press · Pettorali, Deltoidi' },
        { id: '4', label: 'Pull-Up', sublabel: 'Pull · Dorsali, Bicipiti' },
        { id: '5', label: 'Overhead Press', sublabel: 'Press · Deltoidi, Tricipiti' },
        { id: '6', label: 'Hip Thrust', sublabel: 'Hinge · Glutei' },
        { id: '7', label: 'Lunges', sublabel: 'Lunge · Quadricipiti, Glutei' },
        { id: '8', label: 'Farmer Carry', sublabel: 'Carry · Core, Trapezi' },
    ].filter(o =>
        !autocompleteQuery ||
        o.label.toLowerCase().includes(autocompleteQuery.toLowerCase()) ||
        (o.sublabel ?? '').toLowerCase().includes(autocompleteQuery.toLowerCase())
    )

    return (
        <div className="min-h-screen bg-gray-50 p-6">
            <div className="mx-auto max-w-7xl space-y-12">
                {/* Header */}
                <div className="text-center">
                    <h1 className="text-5xl font-bold">
                        <span className="text-gray-900">Zero</span>
                        <span className="text-brand-primary">Cento</span>
                    </h1>
                    <p className="mt-2 text-lg text-gray-600">UI Components Showcase</p>
                    <div className="mt-4 flex justify-center gap-4">
                        <div className="flex items-center gap-2">
                            <div className="h-4 w-4 rounded-full bg-brand-primary"></div>
                            <span className="text-sm text-gray-600">Primary: #FFA700</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="h-4 w-4 rounded-full bg-black"></div>
                            <span className="text-sm text-gray-600">Secondary: #000000</span>
                        </div>
                    </div>
                </div>

                {/* === DESIGN SYSTEM BASE COMPONENTS === */}

                {/* Buttons */}
                <section className="rounded-lg bg-white p-6 shadow">
                    <h2 className="mb-4 text-2xl font-bold text-gray-900">Buttons</h2>
                    <p className="text-sm text-gray-600 mb-6">
                        Componente Button unificato con varianti (primary, secondary, danger) e dimensioni (sm, md, lg).
                    </p>

                    <div className="space-y-8">
                        {/* Variants */}
                        <div>
                            <h3 className="text-sm font-semibold text-gray-700 mb-3">Varianti</h3>
                            <div className="flex flex-wrap gap-3">
                                <Button variant="primary" onClick={() => showToast('Primary clicked', 'info')}>
                                    Primary Button
                                </Button>
                                <Button variant="secondary" onClick={() => showToast('Secondary clicked', 'info')}>
                                    Secondary Button
                                </Button>
                                <Button variant="danger" onClick={() => showToast('Danger clicked', 'warning')}>
                                    Danger Button
                                </Button>
                            </div>
                        </div>

                        {/* Sizes */}
                        <div>
                            <h3 className="text-sm font-semibold text-gray-700 mb-3">Dimensioni</h3>
                            <div className="flex flex-wrap items-center gap-3">
                                <Button variant="primary" size="sm">Small</Button>
                                <Button variant="primary" size="md">Medium</Button>
                                <Button variant="primary" size="lg">Large</Button>
                            </div>
                        </div>

                        {/* With Icons */}
                        <div>
                            <h3 className="text-sm font-semibold text-gray-700 mb-3">Con icone</h3>
                            <div className="flex flex-wrap gap-3">
                                <Button variant="primary" icon={<Save />} iconPosition="left">
                                    Salva
                                </Button>
                                <Button variant="secondary" icon={<Plus />} iconPosition="left">
                                    Aggiungi
                                </Button>
                                <Button variant="danger" icon={<Trash2 />} iconPosition="left">
                                    Elimina
                                </Button>
                                <Button variant="primary" icon={<Check />} iconPosition="right">
                                    Conferma
                                </Button>
                            </div>
                        </div>

                        {/* States */}
                        <div>
                            <h3 className="text-sm font-semibold text-gray-700 mb-3">Stati</h3>
                            <div className="flex flex-wrap gap-3">
                                <Button variant="primary" disabled>Disabilitato</Button>
                                <Button
                                    variant="primary"
                                    isLoading={isButtonLoading}
                                    loadingText="Caricamento..."
                                    onClick={() => {
                                        setIsButtonLoading(true)
                                        setTimeout(() => setIsButtonLoading(false), 2000)
                                    }}
                                >
                                    Click me (loading demo)
                                </Button>
                            </div>
                        </div>

                        {/* Full Width */}
                        <div>
                            <h3 className="text-sm font-semibold text-gray-700 mb-3">Full Width</h3>
                            <Button variant="primary" fullWidth icon={<Save />}>
                                Save Full Width
                            </Button>
                        </div>
                    </div>
                </section>

                {/* Inputs & Textareas */}
                <section className="rounded-lg bg-white p-6 shadow">
                    <h2 className="mb-4 text-2xl font-bold text-gray-900">Inputs & Textareas</h2>
                    <p className="text-sm text-gray-600 mb-6">
                        Input e Textarea unificati con supporto per stati (default, error, success) e helper text.
                    </p>

                    <div className="space-y-8">
                        {/* Input Sizes */}
                        <div>
                            <h3 className="text-sm font-semibold text-gray-700 mb-3">Input - Dimensioni</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <FormLabel htmlFor="input-md">Medium Input</FormLabel>
                                    <Input
                                        id="input-md"
                                        inputSize="md"
                                        placeholder="Dimensione medium..."
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                    />
                                </div>
                                <div>
                                    <FormLabel htmlFor="input-lg">Large Input</FormLabel>
                                    <Input
                                        id="input-lg"
                                        inputSize="lg"
                                        placeholder="Dimensione large..."
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Input States */}
                        <div>
                            <h3 className="text-sm font-semibold text-gray-700 mb-3">Input - Stati</h3>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div>
                                    <FormLabel htmlFor="input-default">Default State</FormLabel>
                                    <Input
                                        id="input-default"
                                        state="default"
                                        placeholder="Campo normale..."
                                        helperText="Questo è un campo normale"
                                    />
                                </div>
                                <div>
                                    <FormLabel htmlFor="input-error" required>Error State</FormLabel>
                                    <Input
                                        id="input-error"
                                        state="error"
                                        placeholder="Campo con errore..."
                                        helperText="Questo campo è obbligatorio"
                                    />
                                </div>
                                <div>
                                    <FormLabel htmlFor="input-success">Success State</FormLabel>
                                    <Input
                                        id="input-success"
                                        state="success"
                                        placeholder="Campo valido..."
                                        helperText="Email confermata!"
                                        value="user@example.com"
                                        readOnly
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Input With Icons */}
                        <div>
                            <h3 className="text-sm font-semibold text-gray-700 mb-3">Input - Con icone</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <FormLabel htmlFor="email-input">Email</FormLabel>
                                    <Input
                                        id="email-input"
                                        type="email"
                                        placeholder="email@example.com"
                                        icon={<Mail className="w-5 h-5" />}
                                        iconPosition="left"
                                    />
                                </div>
                                <div>
                                    <FormLabel htmlFor="password-input">Password</FormLabel>
                                    <Input
                                        id="password-input"
                                        type="password"
                                        placeholder="••••••••"
                                        icon={<Lock className="w-5 h-5" />}
                                        iconPosition="left"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Textarea */}
                        <div>
                            <h3 className="text-sm font-semibold text-gray-700 mb-3">Textarea</h3>
                            <div className="space-y-4">
                                <div>
                                    <FormLabel htmlFor="notes">Note di allenamento</FormLabel>
                                    <Textarea
                                        id="notes"
                                        placeholder="Scrivi le tue note qui..."
                                        rows={4}
                                        value={notes}
                                        onChange={(e) => setNotes(e.target.value)}
                                        helperText="Le note aiutano a tracciare i progressi"
                                    />
                                </div>
                                <div>
                                    <FormLabel htmlFor="bio" required>Bio con conteggio caratteri</FormLabel>
                                    <Textarea
                                        id="bio"
                                        placeholder="Scrivi una breve biografia..."
                                        rows={3}
                                        value={bio}
                                        onChange={(e) => setBio(e.target.value)}
                                        showCharCount
                                        maxLength={200}
                                        state={bio.length > 200 ? 'error' : 'default'}
                                        helperText={bio.length > 200 ? 'Limite caratteri superato' : undefined}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Form Labels */}
                <section className="rounded-lg bg-white p-6 shadow">
                    <h2 className="mb-4 text-2xl font-bold text-gray-900">Form Labels</h2>
                    <p className="text-sm text-gray-600 mb-6">
                        Label unificata per form con supporto standard e required.
                    </p>

                    <div className="space-y-4">
                        <FormLabel htmlFor="demo1">Label standard</FormLabel>
                        <FormLabel htmlFor="demo2" required>Label con required</FormLabel>
                    </div>
                </section>

                {/* Cards */}
                <section className="rounded-lg bg-white p-6 shadow">
                    <h2 className="mb-4 text-2xl font-bold text-gray-900">Cards</h2>
                    <p className="text-sm text-gray-600 mb-6">
                        Card container unificato con varianti (base, elevated) e supporto header/footer opzionali.
                    </p>

                    <div className="space-y-6">
                        {/* Variants */}
                        <div>
                            <h3 className="text-sm font-semibold text-gray-700 mb-3">Varianti</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <Card variant="base">
                                    <h4 className="font-semibold text-gray-900 mb-2">Base Card</h4>
                                    <p className="text-sm text-gray-600">
                                        Card base con shadow-sm e border sottile. Ideale per contenitori standard.
                                    </p>
                                </Card>
                                <Card variant="elevated">
                                    <h4 className="font-semibold text-gray-900 mb-2">Elevated Card</h4>
                                    <p className="text-sm text-gray-600">
                                        Card elevata con shadow-lg senza border. Ideale per modal e elementi evidenziati.
                                    </p>
                                </Card>
                            </div>
                        </div>

                        {/* With Header */}
                        <div>
                            <h3 className="text-sm font-semibold text-gray-700 mb-3">Con Header</h3>
                            <Card
                                variant="base"
                                header={{
                                    title: 'Statistiche Allenamento',
                                    subtitle: 'Ultime 4 settimane',
                                    badge: <span className="text-xs bg-green-100 px-2 py-1 rounded text-green-700">Attivo</span>,
                                    actions: <Button size="sm" variant="secondary">Modifica</Button>
                                }}
                            >
                                <div className="space-y-2">
                                    <p className="text-sm text-gray-600">• 12 workout completati</p>
                                    <p className="text-sm text-gray-600">• 4.8 RPE medio</p>
                                    <p className="text-sm text-gray-600">• 95% aderenza al programma</p>
                                </div>
                            </Card>
                        </div>

                        {/* With Footer */}
                        <div>
                            <h3 className="text-sm font-semibold text-gray-700 mb-3">Con Footer</h3>
                            <Card
                                variant="base"
                                footer={{
                                    links: <a href="#" className="text-sm text-brand-primary hover:underline">Vai ai dettagli →</a>,
                                    actions: (
                                        <div className="flex gap-2">
                                            <Button size="sm" variant="secondary">Annulla</Button>
                                            <Button size="sm" variant="primary">Salva</Button>
                                        </div>
                                    )
                                }}
                            >
                                <h4 className="font-semibold text-gray-900 mb-2">Card con Footer</h4>
                                <p className="text-sm text-gray-600">
                                    Il footer può contenere link o azioni associate alla card.
                                </p>
                            </Card>
                        </div>

                        {/* Complete Example */}
                        <div>
                            <h3 className="text-sm font-semibold text-gray-700 mb-3">Esempio Completo</h3>
                            <Card
                                variant="elevated"
                                header={{
                                    title: 'Nuovo Programma',
                                    subtitle: 'Crea un programma di allenamento personalizzato',
                                    badge: <span className="text-xs bg-brand-primary text-white px-2 py-1 rounded">Draft</span>,
                                }}
                                footer={{
                                    actions: (
                                        <div className="flex gap-2">
                                            <Button size="md" variant="secondary">Annulla</Button>
                                            <Button size="md" variant="primary" icon={<Save />}>Salva Bozza</Button>
                                        </div>
                                    )
                                }}
                            >
                                <div className="space-y-4">
                                    <div>
                                        <FormLabel htmlFor="program-name" required>Nome programma</FormLabel>
                                        <Input id="program-name" placeholder="Es: Forza Base 12 settimane" />
                                    </div>
                                    <div>
                                        <FormLabel htmlFor="program-desc">Descrizione</FormLabel>
                                        <Textarea id="program-desc" placeholder="Descrivi gli obiettivi del programma..." rows={3} />
                                    </div>
                                </div>
                            </Card>
                        </div>
                    </div>
                </section>

                {/* === SPECIALIZED COMPONENTS === */}

                {/* Toast Demos */}
                <section className="rounded-lg bg-white p-6 shadow">
                    <h2 className="mb-4 text-2xl font-bold text-gray-900">Toast Notifications</h2>
                    <div className="flex flex-wrap gap-3">
                        <Button
                            variant="primary"
                            size="md"
                            onClick={() => showToast('Operazione completata con successo!', 'success')}
                            className="bg-green-500 hover:bg-green-600 focus:ring-green-500"
                        >
                            Success Toast
                        </Button>
                        <Button
                            variant="primary"
                            size="md"
                            onClick={() => showToast('Si è verificato un errore', 'error')}
                            className="bg-red-500 hover:bg-red-600 focus:ring-red-500"
                        >
                            Error Toast
                        </Button>
                        <Button
                            variant="primary"
                            size="md"
                            onClick={() => showToast('Attenzione: controlla i dati inseriti', 'warning')}
                            className="bg-yellow-500 hover:bg-yellow-600 focus:ring-yellow-500"
                        >
                            Warning Toast
                        </Button>
                        <Button
                            variant="primary"
                            size="md"
                            onClick={() => showToast('Informazione: caricamento completato', 'info')}
                        >
                            Info Toast
                        </Button>
                    </div>
                </section>

                {/* Loading Spinners */}
                <section className="rounded-lg bg-white p-6 shadow">
                    <h2 className="mb-4 text-2xl font-bold text-gray-900">Loading Spinners</h2>
                    <div className="flex items-center gap-8">
                        <LoadingSpinner size="sm" label="Small" />
                        <LoadingSpinner size="md" label="Medium" />
                        <LoadingSpinner size="lg" label="Large" />
                        <LoadingSpinner size="xl" label="Extra Large" />
                    </div>
                    <div className="mt-6">
                        <Button
                            variant="primary"
                            onClick={() => {
                                setShowFullPageLoader(true)
                                setTimeout(() => setShowFullPageLoader(false), 3000)
                            }}
                        >
                            Show Full Page Loader (3s)
                        </Button>
                        <InlineLoader className="ml-4" />
                    </div>
                    {showFullPageLoader && <FullPageLoader message="Caricamento demo..." />}
                </section>

                {/* Week Type Banners */}
                <section className="space-y-4 rounded-lg bg-white p-6 shadow">
                    <h2 className="mb-4 text-2xl font-bold text-gray-900">Week Type Banners</h2>
                    <WeekTypeBanner weekType="normal" weekNumber={1} />
                    <WeekTypeBanner weekType="test" weekNumber={4} />
                    <WeekTypeBanner weekType="deload" weekNumber={8} />
                </section>

                {/* Form Components */}
                <section className="space-y-6 rounded-lg bg-white p-6 shadow">
                    <h2 className="mb-4 text-2xl font-bold text-gray-900">Form Components</h2>

                    <RPESelector value={rpe} onChange={setRpe} />
                </section>

                {/* Exercise Cards */}
                <section className="rounded-lg bg-white p-6 shadow">
                    <h2 className="mb-4 text-2xl font-bold text-gray-900">Exercise Cards</h2>
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        <ExerciseCard
                            id="1"
                            name="Back Squat"
                            type="fundamental"
                            movementPattern={{ id: '1', name: 'Squat', color: '#ef4444' }}
                            muscleGroups={[
                                { id: '1', name: 'Quadricipiti' },
                                { id: '2', name: 'Glutei' },
                            ]}
                            videoUrl="https://www.youtube.com/watch?v=dQw4w9WgXcQ"
                            notes="Esercizio fondamentale per le gambe"
                            showActions
                            onEdit={() => showToast('Modifica esercizio', 'info')}
                            onDelete={() => showToast('Elimina esercizio', 'warning')}
                        />
                        <ExerciseCard
                            id="2"
                            name="Romanian Deadlift"
                            type="accessory"
                            movementPattern={{ id: '2', name: 'Hinge', color: '#10b981' }}
                            muscleGroups={[{ id: '3', name: 'Ischiocrurali' }]}
                        />
                        <ExerciseCard
                            id="3"
                            name="Bench Press"
                            type="fundamental"
                            movementPattern={{ id: '3', name: 'Press', color: '#FFA700' }}
                            muscleGroups={[
                                { id: '4', name: 'Pettorali' },
                                { id: '5', name: 'Deltoidi' },
                            ]}
                            videoUrl="https://www.youtube.com/watch?v=dQw4w9WgXcQ"
                        />
                    </div>
                </section>

                {/* Movement Pattern Tags */}
                <section className="rounded-lg bg-white p-6 shadow">
                    <h2 className="mb-4 text-2xl font-bold text-gray-900">Movement Pattern Tags</h2>
                    <div className="flex flex-wrap gap-3">
                        <MovementPatternTag name="Squat" color="#ef4444" />
                        <MovementPatternTag name="Hinge" color="#10b981" />
                        <MovementPatternTag name="Press" color="#FFA700" />
                        <MovementPatternTag name="Pull" color="#3b82f6" />
                        <MovementPatternTag name="Carry" color="#8b5cf6" />
                        <MovementPatternTag name="Lunge" color="#ec4899" />
                    </div>
                </section>

                {/* YouTube Embed */}
                <section className="rounded-lg bg-white p-6 shadow">
                    <h2 className="mb-4 text-2xl font-bold text-gray-900">YouTube Embed</h2>
                    <div className="mx-auto max-w-2xl">
                        <YoutubeEmbed
                            videoUrl="https://www.youtube.com/watch?v=dQw4w9WgXcQ"
                            title="Tutorial Back Squat"
                        />
                    </div>
                </section>

                {/* Progress Bars */}
                <section className="rounded-lg bg-white p-6 shadow">
                    <h2 className="mb-4 text-2xl font-bold text-gray-900">Progress Bars</h2>
                    <div className="space-y-6">
                        <div>
                            <h3 className="text-sm font-semibold text-gray-700 mb-3">Sizes</h3>
                            <div className="space-y-3">
                                <ProgressBar current={3} total={10} label="Small Progress" size="sm" />
                                <ProgressBar current={5} total={10} label="Medium Progress" size="md" />
                                <ProgressBar current={7} total={10} label="Large Progress" size="lg" />
                            </div>
                        </div>
                        <div>
                            <h3 className="text-sm font-semibold text-gray-700 mb-3">Colors</h3>
                            <div className="space-y-3">
                                <ProgressBar current={2} total={8} label="Primary" color="primary" showPercentage />
                                <ProgressBar current={6} total={8} label="Success" color="success" showPercentage />
                                <ProgressBar current={5} total={8} label="Warning" color="warning" showPercentage />
                                <ProgressBar current={1} total={8} label="Danger" color="danger" showPercentage />
                            </div>
                        </div>
                    </div>
                </section>

                {/* Stat Cards */}
                <section className="rounded-lg bg-white p-6 shadow">
                    <h2 className="mb-4 text-2xl font-bold text-gray-900">Stat Cards</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        <StatCard
                            title="Utenti Attivi"
                            value={1247}
                            subtitle="Crescita mensile"
                            icon={<Users className="w-5 h-5" />}
                            color="primary"
                            trend={{ value: 12, label: "+12%", isPositive: true }}
                            onClick={() => showToast('Clicked Utenti Attivi', 'info')}
                        />
                        <StatCard
                            title="Workout Completati"
                            value={8432}
                            subtitle="Questo mese"
                            icon={<Dumbbell className="w-5 h-5" />}
                            color="success"
                            trend={{ value: 8, label: "+8%", isPositive: true }}
                        />
                        <StatCard
                            title="Feedback Medi"
                            value={4.7}
                            subtitle="Soddisfazione utenti"
                            icon={<Star className="w-5 h-5" />}
                            color="warning"
                        />
                        <StatCard
                            title="Programmi Attivi"
                            value={342}
                            subtitle="In corso"
                            icon={<ClipboardList className="w-5 h-5" />}
                            color="info"
                        />
                        <StatCard
                            title="Trainer Certificati"
                            value={89}
                            subtitle="Professionisti"
                            icon={<Medal className="w-5 h-5" />}
                            color="success"
                        />
                        <StatCard
                            title="Tasso di Abbandono"
                            value={2.3}
                            subtitle="Diminuzione trimestrale"
                            icon={<TrendingDown className="w-5 h-5" />}
                            color="danger"
                            trend={{ value: -1.2, label: "-1.2%", isPositive: true }}
                        />
                    </div>
                </section>

                {/* Confirmation Modals */}
                <section className="rounded-lg bg-white p-6 shadow">
                    <h2 className="mb-4 text-2xl font-bold text-gray-900">Confirmation Modals</h2>
                    <div className="flex flex-wrap gap-3">
                        <Button
                            variant="primary"
                            onClick={() => {
                                setConfirmVariant('danger')
                                setConfirmModalOpen(true)
                            }}
                            className="bg-red-500 hover:bg-red-600 focus:ring-red-500"
                        >
                            Danger Modal
                        </Button>
                        <Button
                            variant="primary"
                            onClick={() => {
                                setConfirmVariant('warning')
                                setConfirmModalOpen(true)
                            }}
                            className="bg-yellow-500 hover:bg-yellow-600 focus:ring-yellow-500"
                        >
                            Warning Modal
                        </Button>
                        <Button
                            variant="primary"
                            onClick={() => {
                                setConfirmVariant('info')
                                setConfirmModalOpen(true)
                            }}
                        >
                            Info Modal
                        </Button>
                        <Button
                            variant="primary"
                            onClick={() => {
                                setConfirmVariant('success')
                                setConfirmModalOpen(true)
                            }}
                            className="bg-green-500 hover:bg-green-600 focus:ring-green-500"
                        >
                            Success Modal
                        </Button>
                    </div>

                    <ConfirmationModal
                        isOpen={confirmModalOpen}
                        onClose={() => setConfirmModalOpen(false)}
                        onConfirm={async () => {
                            setIsConfirming(true)
                            await new Promise(resolve => setTimeout(resolve, 2000))
                            setIsConfirming(false)
                            setConfirmModalOpen(false)
                            showToast('Azione confermata!', 'success')
                        }}
                        title={
                            confirmVariant === 'danger' ? 'Elimina elemento' :
                                confirmVariant === 'warning' ? 'Attenzione' :
                                    confirmVariant === 'info' ? 'Informazione' :
                                        'Operazione completata'
                        }
                        message={
                            confirmVariant === 'danger' ? 'Sei sicuro di voler eliminare questo elemento? Questa azione non può essere annullata.' :
                                confirmVariant === 'warning' ? 'Questa operazione potrebbe avere effetti collaterali. Vuoi continuare?' :
                                    confirmVariant === 'info' ? 'Questa è una finestra informativa. Conferma per procedere.' :
                                        'Operazione completata con successo. Conferma per chiudere.'
                        }
                        variant={confirmVariant}
                        isLoading={isConfirming}
                    />
                </section>

                {/* Error Boundary Demo */}
                <section className="rounded-lg bg-white p-6 shadow">
                    <h2 className="mb-4 text-2xl font-bold text-gray-900">Error Boundary</h2>
                    <p className="text-sm text-gray-600 mb-4">
                        L&apos;ErrorBoundary cattura errori JavaScript nei componenti figli. Demo:
                    </p>
                    <ErrorBoundary>
                        <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                            <p className="text-green-800 font-semibold">✓ Componente funzionante</p>
                            <p className="text-sm text-green-700 mt-1">
                                Questo contenuto è protetto da ErrorBoundary e viene renderizzato correttamente.
                            </p>
                        </div>
                    </ErrorBoundary>
                </section>

                {/* Navigation Cards */}
                <section className="rounded-lg bg-white p-6 shadow">
                    <h2 className="mb-4 text-2xl font-bold text-gray-900">Navigation Cards</h2>
                    <p className="text-sm text-gray-600 mb-6">
                        Card di navigazione utilizzate nelle dashboard per indirizzare l&apos;utente alle sezioni principali.
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        <NavigationCard
                            href="#"
                            icon={<Users className="w-6 h-6" />}
                            title="Gestione Utenti"
                            description="Visualizza e gestisci tutti gli utenti del sistema."
                            color="blue"
                        />
                        <NavigationCard
                            href="#"
                            icon={<ClipboardList className="w-6 h-6" />}
                            title="Programmi"
                            description="Crea e gestisci i programmi di allenamento."
                            color="green"
                        />
                        <NavigationCard
                            href="#"
                            icon={<Dumbbell className="w-6 h-6" />}
                            title="Libreria Esercizi"
                            description="Gestisci la libreria globale di esercizi."
                            color="primary"
                        />
                        <NavigationCard
                            href="#"
                            icon={<BarChart2 className="w-6 h-6" />}
                            title="Statistiche"
                            description="Analisi avanzate sull'utilizzo della piattaforma."
                            color="purple"
                        />
                        <NavigationCard
                            href="#"
                            icon={<Trophy className="w-6 h-6" />}
                            title="Massimali"
                            description="Visualizza i personal record degli atleti."
                            color="yellow"
                        />
                        <NavigationCard
                            href="#"
                            icon={<Settings className="w-6 h-6" />}
                            title="Impostazioni"
                            description="Configurazione generale dell'applicazione."
                            color="secondary"
                        />
                    </div>
                </section>

                {/* Date Picker */}
                <section className="rounded-lg bg-white p-6 shadow">
                    <h2 className="mb-4 text-2xl font-bold text-gray-900">Date Picker</h2>
                    <p className="text-sm text-gray-600 mb-6">
                        Input data con locale italiano (GG/MM/AAAA). Supporta selezione manuale e picker nativo.
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        <DatePicker
                            label="Data inizio programma"
                            value={dateValue}
                            onChange={setDateValue}
                            required
                        />
                        <DatePicker
                            label="Data con valore default"
                            value={dateWithDefault}
                            onChange={setDateWithDefault}
                            min="2026-01-01"
                            max="2026-12-31"
                        />
                        <DatePicker
                            label="Campo disabilitato"
                            value="2026-06-15"
                            onChange={() => { }}
                            disabled
                        />
                    </div>
                    {dateValue && (
                        <p className="mt-4 text-sm text-gray-600">
                            Valore selezionato (ISO): <span className="font-mono font-semibold text-brand-primary">{dateValue}</span>
                        </p>
                    )}
                </section>

                {/* Autocomplete Search */}
                <section className="rounded-lg bg-white p-6 shadow">
                    <h2 className="mb-4 text-2xl font-bold text-gray-900">Autocomplete Search</h2>
                    <p className="text-sm text-gray-600 mb-6">
                        Dropdown ricercabile con navigazione tastiera (↑↓ Enter Esc) e supporto ricerca asincrona.
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <AutocompleteSearch
                            label="Seleziona esercizio"
                            options={exerciseOptions}
                            value={selectedExercise?.id}
                            onSelect={(opt) => {
                                setSelectedExercise(opt)
                                if (opt) showToast(`Selezionato: ${opt.label}`, 'success')
                            }}
                            onSearch={setAutocompleteQuery}
                            placeholder="Cerca esercizio..."
                            required
                        />
                        <AutocompleteSearch
                            label="Campo disabilitato"
                            options={[]}
                            onSelect={() => { }}
                            placeholder="Non modificabile..."
                            disabled
                        />
                    </div>
                    {selectedExercise && (
                        <p className="mt-4 text-sm text-gray-600">
                            Selezionato: <span className="font-semibold text-brand-primary">{selectedExercise.label}</span>
                            {selectedExercise.sublabel && (
                                <span className="text-gray-500"> — {selectedExercise.sublabel}</span>
                            )}
                        </p>
                    )}
                </section>

            </div>
        </div>
    )
}

export default function ComponentsShowcasePage() {
    return (
        <ToastProvider>
            <ComponentShowcase />
        </ToastProvider>
    )
}
