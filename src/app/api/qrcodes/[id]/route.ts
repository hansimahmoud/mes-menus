import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

// DELETE : supprime un QR code de l'historique
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!db) {
    return NextResponse.json(
      { error: 'Historique en ligne non configuré (aucune base de données).' },
      { status: 503 }
    )
  }
  try {
    const { id } = await params
    await db.qrCode.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE /api/qrcodes/[id] error:', error)
    return NextResponse.json(
      { error: 'Impossible de supprimer ce QR code.' },
      { status: 500 }
    )
  }
}
