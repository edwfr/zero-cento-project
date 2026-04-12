export const E2E_PASSWORDS = {
    admin: process.env.E2E_ADMIN_PASSWORD ?? 'Admin1234!',
    trainer: process.env.E2E_TRAINER_PASSWORD ?? 'Trainer1234!',
    trainee: process.env.E2E_TRAINEE_PASSWORD ?? 'Trainee1234!',
    invalid: process.env.E2E_INVALID_PASSWORD ?? 'WrongPassword123!',
} as const

export const E2E_EMAILS = {
    admin: process.env.E2E_ADMIN_EMAIL ?? 'admin@zerocento.app',
    trainer: process.env.E2E_TRAINER_EMAIL ?? 'trainer1@zerocento.app',
    trainee: process.env.E2E_TRAINEE_EMAIL ?? 'trainee1@zerocento.app',
    invalid: process.env.E2E_INVALID_EMAIL ?? 'invalid@zerocento.app',
} as const

export const E2E_CREDENTIALS = {
    admin: {
        email: E2E_EMAILS.admin,
        password: E2E_PASSWORDS.admin,
    },
    trainer: {
        email: E2E_EMAILS.trainer,
        password: E2E_PASSWORDS.trainer,
    },
    trainee: {
        email: E2E_EMAILS.trainee,
        password: E2E_PASSWORDS.trainee,
    },
    invalid: {
        email: E2E_EMAILS.invalid,
        password: E2E_PASSWORDS.invalid,
    },
} as const