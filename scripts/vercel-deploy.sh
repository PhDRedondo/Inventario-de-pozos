#!/bin/bash
# Doble clic — despliega Inventario de Pozos en Vercel (cuenta PhDRedondo).
set -euo pipefail

REPO="$HOME/Projects/inventario-pozos-anh"
if [[ ! -d "$REPO" ]]; then
  REPO="$HOME/Documents/MacBook Air PhD Redondo/Agentes/Cursor/inventario-pozos-anh"
fi

cd "$REPO"
clear
echo "=============================================="
echo "  Desplegar en Vercel — PhDRedondo"
echo "=============================================="
echo ""

if ! command -v vercel >/dev/null 2>&1; then
  echo "Instala Vercel CLI: npm i -g vercel"
  read -r -p "Enter para cerrar..."
  exit 1
fi

echo "Cuenta Vercel:"
vercel whoami
echo ""

echo "Paso 1: Subir cambios a GitHub (si hay pendientes)..."
git add -A
if git diff --cached --quiet; then
  echo "   Sin cambios nuevos."
else
  git commit -m "Prepare SQLite paths and Vercel config for serverless deploy."
  git push origin main
fi

echo ""
echo "Paso 2: Variable SESSION_SECRET en producción..."
if ! vercel env ls production 2>/dev/null | grep -q SESSION_SECRET; then
  openssl rand -hex 32 | vercel env add SESSION_SECRET production
else
  echo "   SESSION_SECRET ya existe."
fi

echo ""
echo "Paso 3: Deploy a producción..."
vercel deploy --prod

echo ""
echo "Listo: https://vercel.com/dashboard"
read -r -p "Enter para cerrar..."
