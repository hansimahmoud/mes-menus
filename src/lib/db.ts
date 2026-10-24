import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// PrismaClient est créé uniquement si DATABASE_URL est définie.
// Sans base de données (ex. déploiement Vercel sans historique en ligne),
// l'application reste pleinement fonctionnelle : seule la sauvegarde
// de l'historique est désactivée (réponse 503 propre de l'API).
export const db: PrismaClient | null = (() => {
  if (!process.env.DATABASE_URL) return null
  try {
    return globalForPrisma.prisma ?? new PrismaClient()
  } catch (error) {
    console.error('Initialisation de Prisma impossible :', error)
    return null
  }
})()

if (db && process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
