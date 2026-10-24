import { NextResponse, type NextRequest } from 'next/server'
import { AUTH_COOKIE_NAME, createSessionCookieValue, isAuthEnabled, safeEqual } from '@/lib/auth'

// Durée de la session : 30 jours.
const SESSION_MAX_AGE = 60 * 60 * 24 * 30

export async function POST(request: NextRequest) {
  if (!isAuthEnabled()) {
    // Aucun mot de passe configuré : la protection est désactivée.
    return NextResponse.json({ ok: true, protected: false })
  }

  const body = (await request.json().catch(() => null)) as { password?: unknown } | null
  const password = typeof body?.password === 'string' ? body.password : ''
  const expected = process.env.ADMIN_PASSWORD ?? ''

  if (password.length === 0 || !safeEqual(password, expected)) {
    return NextResponse.json({ error: 'Mot de passe incorrect.' }, { status: 401 })
  }

  const response = NextResponse.json({ ok: true, protected: true })
  response.cookies.set({
    name: AUTH_COOKIE_NAME,
    value: await createSessionCookieValue(),
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_MAX_AGE,
  })
  return response
}
