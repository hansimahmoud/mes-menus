import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

// POST : publie ou dépublie le menu.
// Publier ne change JAMAIS l'adresse /m/<slug> : les QR codes déjà
// imprimés continuent de fonctionner et affichent la nouvelle version.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!db) {
    return NextResponse.json(
      { error: 'Historique en ligne non configuré (aucune base de données).' },
      { status: 503 }
    )
  }
  try {
    const { id } = await params
    const body = await request.json().catch(() => ({}))
    const published = body?.published === true

    const existing = await db.menu.findUnique({ where: { id }, select: { id: true } })
    if (!existing) {
      return NextResponse.json({ error: 'Menu introuvable.' }, { status: 404 })
    }

    const menu = await db.menu.update({
      where: { id },
      data: { published, publishedAt: published ? new Date() : null },
    })
    return NextResponse.json(menu)
  } catch (error) {
    console.error('POST /api/menus/[id]/publish error:', error)
    return NextResponse.json({ error: 'Impossible de changer la publication.' }, { status: 500 })
  }
}
