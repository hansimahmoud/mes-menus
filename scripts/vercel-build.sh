#!/bin/bash
# Build Vercel — Générateur de QR code « Menu »
# Ce script s'exécute automatiquement sur Vercel après l'installation des dépendances.
set -e

HAS_DB=0
if [ -n "$DATABASE_URL" ]; then
  HAS_DB=1
fi

if [ "$HAS_DB" = "0" ]; then
  # Pas de base de données configurée : on fournit une URL factice car
  # « prisma generate » n'établit jamais de connexion mais exige un format valide.
  # Résultat : l'application est déployée sans historique en ligne, tout le reste fonctionne.
  export DATABASE_URL="postgresql://placeholder:placeholder@localhost:5432/placeholder"
  echo "→ Aucune DATABASE_URL : déploiement sans historique en ligne (l'application reste pleinement fonctionnelle)"
fi

echo "→ Génération du client Prisma (schéma PostgreSQL)"
npx prisma generate --schema prisma/schema.postgres.prisma

if [ "$HAS_DB" = "1" ]; then
  echo "→ DATABASE_URL détectée : synchronisation du schéma (prisma db push)"
  npx prisma db push --schema prisma/schema.postgres.prisma --accept-data-loss --skip-generate
fi

echo "→ Construction Next.js"
npx next build
