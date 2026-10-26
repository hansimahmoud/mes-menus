import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

// Génère un slug court et unique à partir du nom du menu.
// Ce slug ne change JAMAIS ensuite : les QR codes imprimés restent valables.
async function generateUniqueSlug(name: string): Promise<string> {
  if (!db) return `menu-${Date.now().toString(36)}`
  const base =
    name
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 32) || 'menu'
  for (let attempt = 0; attempt < 8; attempt++) {
    const suffix = Math.random().toString(36).slice(2, 8)
    const slug = `${base}-${suffix}`
    const existing = await db.menu.findUnique({ where: { slug }, select: { id: true } })
    if (!existing) return slug
  }
  return `${base}-${Date.now().toString(36)}`
}

// GET : liste des menus avec le nombre d'articles
export async function GET() {
  if (!db) {
    return NextResponse.json(
      { error: 'Historique en ligne non configuré (aucune base de données).' },
      { status: 503 }
    )
  }
  try {
    const menus = await db.menu.findMany({
      orderBy: { updatedAt: 'desc' },
      include: { _count: { select: { items: true } } },
    })
    return NextResponse.json(
      menus.map((menu) => ({
        id: menu.id,
        name: menu.name,
        slug: menu.slug,
        published: menu.published,
        publishedAt: menu.publishedAt,
        accentColor: menu.accentColor,
        currency: menu.currency,
        itemCount: menu._count.items,
        createdAt: menu.createdAt,
        updatedAt: menu.updatedAt,
      }))
    )
  } catch (error) {
    console.error('GET /api/menus error:', error)
    return NextResponse.json({ error: 'Impossible de récupérer les menus.' }, { status: 500 })
  }
}

// POST : crée un menu vide et renvoie son identifiant
export async function POST(request: NextRequest) {
  if (!db) {
    return NextResponse.json(
      { error: 'Historique en ligne non configuré (aucune base de données).' },
      { status: 503 }
    )
  }
  try {
    const body = await request.json().catch(() => ({}))
    const name =
      typeof body?.name === 'string' && body.name.trim() ? body.name.trim().slice(0, 80) : 'Nouveau menu'
    const slug = await generateUniqueSlug(name)
    const menu = await db.menu.create({ data: { name, slug } })
    return NextResponse.json(menu, { status: 201 })
  } catch (error) {
    console.error('POST /api/menus error:', error)
    return NextResponse.json({ error: 'Impossible de créer le menu.' }, { status: 500 })
  }
}
