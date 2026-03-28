#!/usr/bin/env pwsh

Write-Host "🚀 ZeroCento Training Platform - Setup Script" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""

# Check Node.js
Write-Host "✓ Checking Node.js..." -ForegroundColor Yellow
$nodeVersion = node --version
if ($nodeVersion -match "v(\d+)\.") {
    $majorVersion = [int]$matches[1]
    if ($majorVersion -ge 20) {
        Write-Host "  Node.js $nodeVersion ✓" -ForegroundColor Green
    } else {
        Write-Host "  ⚠️  Node.js $nodeVersion - Required >= 20.0.0" -ForegroundColor Red
        exit 1
    }
}

# Install dependencies
Write-Host ""
Write-Host "✓ Installing dependencies..." -ForegroundColor Yellow
npm install
if ($LASTEXITCODE -ne 0) {
    Write-Host "  ❌ npm install failed" -ForegroundColor Red
    exit 1
}
Write-Host "  Dependencies installed ✓" -ForegroundColor Green

# Generate Prisma Client
Write-Host ""
Write-Host "✓ Generating Prisma Client..." -ForegroundColor Yellow
npm run prisma:generate
if ($LASTEXITCODE -ne 0) {
    Write-Host "  ❌ Prisma generate failed" -ForegroundColor Red
    exit 1
}
Write-Host "  Prisma Client generated ✓" -ForegroundColor Green

# Check .env.local
Write-Host ""
Write-Host "✓ Checking environment variables..." -ForegroundColor Yellow
if (Test-Path ".env.local") {
    $envContent = Get-Content ".env.local" -Raw
    if ($envContent -match "xxx" -or $envContent -match "TUA_PASSWORD") {
        Write-Host "  ⚠️  .env.local contains placeholder values!" -ForegroundColor Red
        Write-Host "  You need to configure Supabase credentials." -ForegroundColor Red
        Write-Host "  See NEXT_ACTIONS.md for instructions." -ForegroundColor Yellow
    } else {
        Write-Host "  .env.local configured ✓" -ForegroundColor Green
    }
} else {
    Write-Host "  ⚠️  .env.local not found!" -ForegroundColor Red
    Write-Host "  Copy .env.example to .env.local and configure." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "================================================" -ForegroundColor Cyan
Write-Host "🎉 Setup complete!" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. Configure Supabase (see NEXT_ACTIONS.md)" -ForegroundColor White
Write-Host "2. Run: npm run prisma:migrate -- --name init" -ForegroundColor White
Write-Host "3. Run: npm run prisma:seed" -ForegroundColor White
Write-Host "4. Run: npm run dev" -ForegroundColor White
Write-Host ""
Write-Host "📚 Documentation:" -ForegroundColor Yellow
Write-Host "  - NEXT_ACTIONS.md - Immediate next steps" -ForegroundColor White
Write-Host "  - QUICK_START.md - Quick start guide" -ForegroundColor White
Write-Host "  - README.md - Full documentation" -ForegroundColor White
Write-Host ""
