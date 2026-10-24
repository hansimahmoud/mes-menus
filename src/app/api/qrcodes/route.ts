import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

// GET : liste les 30 derniers QR codes générés
export async function GET() {
  if (!db) {
    return NextResponse.json(
      { error: 'Historique en ligne non configuré (aucune base de données).' },
      { status: 503 }
    )
  }
  try {
    const qrcodes = await db.qrCode.findMany({
      orderBy: { createdAt: 'desc' },
      take: 30,
    })
    return NextResponse.json(qrcodes)
  } catch (error) {
    console.error('GET /api/qrcodes error:', error)
    return NextResponse.json(
      { error: 'Impossible de récupérer l\'historique.' },
      { status: 500 }
    )
  }
}

// POST : enregistre un QR code dans l'historique
export async function POST(request: NextRequest) {
  if (!db) {
    return NextResponse.json(
      { error: 'Historique en ligne non configuré (aucune base de données).' },
      { status: 503 }
    )
  }
  try {
    const body = await request.json()
    const { title, url, fgColor, bgColor, size, logo, logoSize } = body

    if (!url || typeof url !== 'string' || url.trim().length === 0) {
      return NextResponse.json(
        { error: 'Le lien est obligatoire.' },
        { status: 400 }
      )
    }

    const qrcode = await db.qrCode.create({
      data: {
        title: typeof title === 'string' && title.trim() ? title.trim() : 'Sans titre',
        url: url.trim(),
        fgColor: typeof fgColor === 'string' ? fgColor : '#18181b',
        bgColor: typeof bgColor === 'string' ? bgColor : '#ffffff',
        size: typeof size === 'number' && size > 0 ? Math.round(size) : 512,
        logo:
          typeof logo === 'string' &&
          logo.length > 0 &&
          logo.length <= 3_000_000 &&
          logo.startsWith('data:image/')
            ? logo
            : null,
        logoSize:
          typeof logoSize === 'number' && logoSize >= 5 && logoSize <= 50
            ? Math.round(logoSize)
            : null,
      },
    })

    return NextResponse.json(qrcode, { status: 201 })
  } catch (error) {
    console.error('POST /api/qrcodes error:', error)
    return NextResponse.json(
      { error: 'Impossible d\'enregistrer le QR code.' },
      { status: 500 }
    )
  }
}
