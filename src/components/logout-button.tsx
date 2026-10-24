'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { LogOut } from 'lucide-react'
import { Button } from '@/components/ui/button'

// Bouton de déconnexion, affiché uniquement lorsqu'une protection
// par mot de passe est active (variable ADMIN_PASSWORD définie).
export function LogoutButton() {
  const router = useRouter()
  const [enabled, setEnabled] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetch('/api/auth/status')
      .then((response) => response.json())
      .then((data) => {
        if (!cancelled) setEnabled(Boolean(data?.enabled))
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  if (!enabled) return null

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {})
    router.replace('/login')
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleLogout}
      aria-label="Se déconnecter"
      className="text-muted-foreground hover:text-stone-900"
    >
      <LogOut className="h-4 w-4" aria-hidden />
      <span className="hidden sm:inline">Déconnexion</span>
    </Button>
  )
}
