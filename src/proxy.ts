import { NextResponse, type NextRequest } from 'next/server'
import { AUTH_COOKIE_NAME, isValidSessionToken } from '@/lib/auth'

// Routes toujours accessibles sans connexion :
// - la page publique d'un menu (celle que vos clients ouvrent avec le QR code),
// - la page de connexion et l'API d'authentification.
// Tout le reste (tableau de bord, éditeur de menus, générateur de QR codes,
// API d'administration) exige le cookie de session.
function isPublicPath(pathname: string): boolean {
  return (
    pathname === '/login' ||
    pathname === '/m' ||
    pathname.startsWith('/m/') ||
    pathname.startsWith('/api/auth/')
  )
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (isPublicPath(pathname)) {
    return NextResponse.next()
  }

  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value
  if (await isValidSessionToken(token)) {
    return NextResponse.next()
  }

  // API : réponse JSON 401. Pages : redirection vers /login.
  if (pathname.startsWith('/api/')) {
    return NextResponse.json(
      { error: 'Accès protégé : connectez-vous pour continuer.' },
      { status: 401 },
    )
  }

  const loginUrl = request.nextUrl.clone()
  loginUrl.pathname = '/login'
  loginUrl.search = ''
  loginUrl.searchParams.set('suivant', pathname)
  return NextResponse.redirect(loginUrl)
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|logo.svg|robots.txt).*)'],
}
