-- CreateEnum
CREATE TYPE "UserStatusEventType" AS ENUM ('created', 'activated', 'deactivated', 'reactivated', 'invitation_resent');

-- CreateTable
CREATE TABLE "user_status_events" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "UserStatusEventType" NOT NULL,
    "actorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_status_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "user_status_events_userId_createdAt_idx" ON "user_status_events"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "user_status_events" ADD CONSTRAINT "user_status_events_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_status_events" ADD CONSTRAINT "user_status_events_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill: existing users were created by their current trainer (null for trainers/admins)
INSERT INTO "user_status_events" ("id", "userId", "type", "actorId", "createdAt")
SELECT gen_random_uuid()::text, u."id", 'created', tt."trainerId", u."createdAt"
FROM "users" u
LEFT JOIN "trainer_trainee" tt ON tt."traineeId" = u."id";

-- Backfill: users with a confirmed email activated their own account.
-- email_confirmed_at is the invite-link click, an approximation of the activation.
-- The shadow database of `prisma migrate dev` has no auth schema: skip there.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'auth' AND table_name = 'users'
    ) THEN
        INSERT INTO "user_status_events" ("id", "userId", "type", "actorId", "createdAt")
        SELECT gen_random_uuid()::text, u."id", 'activated', u."id", au.email_confirmed_at
        FROM "users" u
        JOIN auth.users au ON au.id::text = u."id"
        WHERE au.email_confirmed_at IS NOT NULL;
    END IF;
END $$;
