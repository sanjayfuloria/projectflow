#!/bin/bash
# setup-github.sh
# Run this from the projectflow/ root directory
# Usage: bash setup-github.sh <your-github-username> <repo-name>

set -e

GITHUB_USER="${1:-YOUR_USERNAME}"
REPO_NAME="${2:-projectflow}"

echo ""
echo "╔══════════════════════════════════════════════╗"
echo "║       ProjectFlow – GitHub Setup Script      ║"
echo "╚══════════════════════════════════════════════╝"
echo ""

# ── 1. Create .env files from examples ──────────────────────────────────────
if [ ! -f "backend/.env" ]; then
  cp backend/.env.example backend/.env
  echo "✅  Created backend/.env (edit it with your DB credentials)"
fi
if [ ! -f "frontend/.env" ]; then
  cp frontend/.env.example frontend/.env.local
  echo "✅  Created frontend/.env.local"
fi

# ── 2. Git init ───────────────────────────────────────────────────────────────
if [ ! -d ".git" ]; then
  git init
  git branch -M main
  echo "✅  Git repository initialized"
fi

# ── 3. First commit ───────────────────────────────────────────────────────────
git add .
git commit -m "feat: initial ProjectFlow full-stack scaffold

- React + Vite frontend (Vercel-ready)
- Express + Prisma + PostgreSQL backend (Railway-ready)
- JWT authentication (access token + httpOnly refresh cookie)
- Kanban board with drag-and-drop
- Task CRUD, columns, members, comments
- Role-based access (ADMIN / MEMBER / VIEWER)
" 2>/dev/null || echo "ℹ️  Nothing new to commit (already committed)"

# ── 4. Add remote and push ────────────────────────────────────────────────────
REMOTE_URL="https://github.com/${GITHUB_USER}/${REPO_NAME}.git"

if git remote get-url origin &>/dev/null; then
  echo "ℹ️  Remote 'origin' already exists: $(git remote get-url origin)"
else
  git remote add origin "$REMOTE_URL"
  echo "✅  Remote added: $REMOTE_URL"
fi

echo ""
echo "⚡ Pushing to GitHub…"
git push -u origin main

echo ""
echo "╔══════════════════════════════════════════════╗"
echo "║            ✅ Push complete!                 ║"
echo "╚══════════════════════════════════════════════╝"
echo ""
echo "Next steps:"
echo ""
echo "  1. RAILWAY (Backend)"
echo "     → railway.app → New Project → Deploy from GitHub"
echo "     → Set Root Directory = backend"
echo "     → Add PostgreSQL plugin"
echo "     → Set env vars: JWT_SECRET, JWT_REFRESH_SECRET, FRONTEND_URL"
echo ""
echo "  2. VERCEL (Frontend)"
echo "     → vercel.com → New Project → Import GitHub repo"
echo "     → Set Root Directory = frontend"
echo "     → Set VITE_API_URL = https://your-railway-app.up.railway.app"
echo ""
echo "  3. After Railway deploys, run the seed:"
echo "     railway run npx prisma db seed"
echo "     (Default admin: admin@ifhe.ac.in / Admin@1234)"
echo ""
