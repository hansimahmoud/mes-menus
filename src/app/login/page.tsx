'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff, Loader2, LockKeyhole, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default function LoginPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  // null = vérification en cours, false = protection désactivée, true = formulaire.
  const [protectionEnabled, setProtectionEnabled] = useState<boolean | null>(null)

  useEffect(() => {
    fetch('/api/auth/status')
      .then((response) => response.json())
      .then((data) => setProtectionEnabled(Boolean(data?.enabled)))
      .catch(() => setProtectionEnabled(true)) // en cas de doute, on affiche le formulaire
  }, [])

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (loading) return
    setError(null)
    setLoading(true)
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })
      if (!response.ok) {
        setError('Mot de passe incorrect. Réessayez.')
        setPassword('')
        return
      }
      // Retourne vers la page demandée avant la redirection (protection
      // contre les redirections externes : uniquement des chemins internes).
      const params = new URLSearchParams(window.location.search)
      const suivant = params.get('suivant')
      const target = suivant && suivant.startsWith('/') && !suivant.startsWith('//') ? suivant : '/'
      router.replace(target)
    } catch {
      setError('Connexion impossible. Vérifiez votre accès internet.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-stone-50 via-amber-50/40 to-stone-100 px-4 py-10">
      {protectionEnabled === false ? (
        <div className="w-full max-w-sm rounded-2xl border border-stone-200 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
            <ShieldCheck className="h-7 w-7" aria-hidden />
          </div>
          <h1 className="mt-5 text-xl font-bold tracking-tight">Aucune protection active</h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Cet espace est ouvert à tous pour le moment. Pour le protéger par mot de passe,
            définissez la variable d&apos;environnement{' '}
            <code className="rounded bg-stone-100 px-1.5 py-0.5 text-xs">ADMIN_PASSWORD</code> puis
            redéployez l&apos;application.
          </p>
          <Button asChild className="mt-6 w-full bg-amber-600 hover:bg-amber-700">
            <Link href="/">Aller à Mes menus</Link>
          </Button>
        </div>
      ) : (
        <div className="w-full max-w-sm rounded-2xl border border-stone-200 bg-white p-8 shadow-sm">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 text-amber-700">
            <LockKeyhole className="h-7 w-7" aria-hidden />
          </div>
          <h1 className="mt-5 text-center text-xl font-bold tracking-tight">Espace gérant</h1>
          <p className="mt-2 text-center text-sm leading-relaxed text-muted-foreground">
            Cette page est protégée par un mot de passe. La page publique de vos menus reste
            accessible à vos clients, sans connexion.
          </p>
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">Mot de passe</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="current-password"
                  autoFocus
                  required
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground transition-colors hover:text-stone-900"
                  aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" aria-hidden />
                  ) : (
                    <Eye className="h-4 w-4" aria-hidden />
                  )}
                </button>
              </div>
            </div>
            {error && (
              <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </p>
            )}
            <Button
              type="submit"
              disabled={loading || password.length === 0}
              className="w-full bg-amber-600 hover:bg-amber-700"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  Vérification…
                </>
              ) : (
                'Entrer'
              )}
            </Button>
          </form>
        </div>
      )}
    </main>
  )
}
