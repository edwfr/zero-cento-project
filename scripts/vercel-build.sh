#!/bin/sh
# Vercel runs `vercel-build` instead of `build` when present.
# Production deploys apply pending Prisma migrations before building, so new
# code never goes live against an old schema. If a migration fails the build
# fails and the previous deployment stays live.
# Preview deploys skip migrations: the only database is production.
set -e

if [ "$VERCEL_ENV" = "production" ]; then
  echo "▶ VERCEL_ENV=production: applying Prisma migrations"
  npx prisma migrate deploy
else
  echo "▶ VERCEL_ENV=${VERCEL_ENV:-unset}: skipping Prisma migrations"
fi

npx next build
