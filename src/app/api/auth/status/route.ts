import { NextResponse } from 'next/server'
import { isAuthEnabled } from '@/lib/auth'

// Indique à l'interface si une protection par mot de passe est active,
// pour afficher (ou non) le formulaire de connexion et le bouton Déconnexion.
export async function GET() {
  return NextResponse.json({ enabled: isAuthEnabled() })
}
