import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

interface IncomingItem {
  category?: unknown
  name?: unknown
  description?: unknown
  price?: unknown
  sortOrder?: unknown
}

// Valide et nettoie un article entrant du formulaire d'édition
function sanitizeItem(item: IncomingItem, sortOrder: number) {
  const name = typeof item.name === 'string' ? item.name.trim().slice(0, 120) : ''
  if (!name) return null
  const category =
    typeof item.category === 'string' && item.category.trim() ? item.category.trim().slice(0, 60) : 'Plats'
  const description =
    typeof item.description === 'string' && item.description.trim()
      ? item.description.trim().slice(0, 400)
      : null
  let price: number | null = null
  if (typeof item.price === 'number' && Number.isFinite(item.price) && item.price >= 0) {
    price = Math.round(item.price * 100) / 100
  }
  const order =
    typeof item.sortOrder === 'number' && Number.isFinite(item.sortOrder) ? Math.round(item.sortOrder) : sortOrder
  return { category, name, description, price, sortOrder: order }
}

// GET : renvoie un menu complet avec ses articles
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!db) {
    return NextResponse.json(
      { error: 'Historique en ligne non configuré (aucune base de données).' },
      { status: 503 }
    )
  }
  try {
    const { id } = await params
    const menu = await db.menu.findUnique({
      where: { id },
      include: { items: { orderBy: { sortOrder: 'asc' } } },
    })
    if (!menu) {
      return NextResponse.json({ error: 'Menu introuvable.' }, { status: 404 })
    }
    return NextResponse.json(menu)
  } catch (error) {
    console.error('GET /api/menus/[id] error:', error)
    return NextResponse.json({ error: 'Impossible de récupérer ce menu.' }, { status: 500 })
  }
}

// PUT : enregistre le menu (nom, couleurs, note) et remplace la liste des articles
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!db) {
    return NextResponse.json(
      { error: 'Historique en ligne non configuré (aucune base de données).' },
      { status: 503 }
    )
  }
  try {
    const { id } = await params
    const body = await request.json()
    const name = typeof body?.name === 'string' && body.name.trim() ? body.name.trim().slice(0, 80) : null
    if (!name) {
      return NextResponse.json({ error: 'Le nom du menu est obligatoire.' }, { status: 400 })
    }
    const accentColor =
      typeof body?.accentColor === 'string' && /^#[0-9a-fA-F]{6}$/.test(body.accentColor)
        ? body.accentColor
        : '#9a3412'
    const currency =
      typeof body?.currency === 'string' && body.currency.trim() ? body.currency.trim().slice(0, 4) : '€'
    const footerNote =
      typeof body?.footerNote === 'string' && body.footerNote.trim() ? body.footerNote.trim().slice(0, 200) : null

    const rawItems: IncomingItem[] = Array.isArray(body?.items) ? body.items.slice(0, 200) : []
    const items = rawItems
      .map((item, index) => sanitizeItem(item, index))
      .filter((item): item is NonNullable<ReturnType<typeof sanitizeItem>> => item !== null)

    const existing = await db.menu.findUnique({ where: { id }, select: { id: true } })
    if (!existing) {
      return NextResponse.json({ error: 'Menu introuvable.' }, { status: 404 })
    }

    const updated = await db.$transaction(async (tx) => {
      await tx.menuItem.deleteMany({ where: { menuId: id } })
      if (items.length > 0) {
        await tx.menuItem.createMany({ data: items.map((item) => ({ ...item, menuId: id })) })
      }
      return tx.menu.update({
        where: { id },
        data: { name, accentColor, currency, footerNote },
        include: { items: { orderBy: { sortOrder: 'asc' } } },
      })
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('PUT /api/menus/[id] error:', error)
    return NextResponse.json({ error: "Impossible d'enregistrer ce menu." }, { status: 500 })
  }
}

// DELETE : supprime le menu et ses articles (cascade)
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!db) {
    return NextResponse.json(
      { error: 'Historique en ligne non configuré (aucune base de données).' },
      { status: 503 }
    )
  }
  try {
    const { id } = await params
    await db.menu.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE /api/menus/[id] error:', error)
    return NextResponse.json({ error: 'Impossible de supprimer ce menu.' }, { status: 500 })
  }
}
