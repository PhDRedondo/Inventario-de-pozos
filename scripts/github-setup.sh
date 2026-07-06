#!/bin/bash
# Conecta este repo a GitHub como PhDRedondo y hace push.
set -euo pipefail

REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_DIR"

echo "=== Inventario de Pozos → GitHub PhDRedondo ==="
echo "Directorio: $REPO_DIR"
echo ""

if ! command -v gh >/dev/null 2>&1; then
  echo "Error: instala GitHub CLI (brew install gh)"
  exit 1
fi

echo "1) Inicia sesión en GitHub como PhDRedondo (NO ceocomplexity)"
echo "   Se abrirá el navegador con un código de un solo uso."
echo ""
gh auth login --hostname github.com --git-protocol https --web --skip-ssh-key

echo ""
echo "2) Si tienes varias cuentas, activa PhDRedondo:"
if gh auth switch -u PhDRedondo 2>/dev/null; then
  echo "   Cuenta activa: PhDRedondo"
else
  echo "   (Usando la cuenta recién autenticada)"
fi

gh auth setup-git
gh auth status

echo ""
echo "3) Remote origin:"
git remote set-url origin https://github.com/PhDRedondo/Inventario-de-pozos.git
git remote -v

echo ""
echo "4) Push a main..."
git push -u origin main

echo ""
echo "Listo: https://github.com/PhDRedondo/Inventario-de-pozos"
