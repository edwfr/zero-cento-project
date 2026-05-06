import type { Config } from 'tailwindcss'

const config: Config = {
    content: [
        './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
        './src/components/**/*.{js,ts,jsx,tsx,mdx}',
        './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    ],
    theme: {
        extend: {
            colors: {
                brand: {
                    primary: '#FFA700',
                    'primary-hover': '#E69500',
                    secondary: '#000000',
                    accent: '#FFFFFF',
                },
                week: {
                    tecnica: {
                        light: '#ede9fe',
                        DEFAULT: '#7c3aed',
                        dark: '#6d28d9',
                    },
                    ipertrofia: {
                        light: '#fce7f3',
                        DEFAULT: '#db2777',
                        dark: '#be185d',
                    },
                    volume: {
                        light: '#dbeafe',
                        DEFAULT: '#2563eb',
                        dark: '#1d4ed8',
                    },
                    'forza-generale': {
                        light: '#ffedd5',
                        DEFAULT: '#ea580c',
                        dark: '#c2410c',
                    },
                    intensificazione: {
                        light: '#fef3c7',
                        DEFAULT: '#d97706',
                        dark: '#b45309',
                    },
                    picco: {
                        light: '#fefce8',
                        DEFAULT: '#ca8a04',
                        dark: '#a16207',
                    },
                    test: {
                        light: '#fecaca',
                        DEFAULT: '#ef4444',
                        dark: '#dc2626',
                    },
                    deload: {
                        light: '#6ee7b7',
                        DEFAULT: '#10b981',
                        dark: '#059669',
                    },
                },
                state: {
                    error: {
                        light: '#fecaca',
                        DEFAULT: '#ef4444',
                        dark: '#dc2626',
                    },
                    success: {
                        light: '#d1fae5',
                        DEFAULT: '#10b981',
                        dark: '#059669',
                    },
                    warning: {
                        light: '#fef3c7',
                        DEFAULT: '#f59e0b',
                        dark: '#d97706',
                    },
                    info: {
                        light: '#dbeafe',
                        DEFAULT: '#3b82f6',
                        dark: '#2563eb',
                    },
                },
            },
            spacing: {
                '18': '4.5rem',
                '88': '22rem',
            },
            minHeight: {
                touch: '44px', // Touch-friendly minimum for mobile
            },
            minWidth: {
                touch: '44px',
            },
        },
    },
    plugins: [],
}

export default config
