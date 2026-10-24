'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { QrCode, UtensilsCrossed } from 'lucide-react'
import { cn } from '@/lib/utils'
import { LogoutButton } from '@/components/logout-button'

const TABS = [
  { href: '/', label: 'Mes menus', icon: UtensilsCrossed },
  { href: '/qr', label: 'QR code', icon: QrCode },
]

export function SiteHeader() {
  const pathname = usePathname()
  const isActive = (href: string) => (href === '/' ? pathname === '/' : pathname.startsWith(href))

  return (
    <header className="border-b border-stone-200 bg-white">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <Link href="/" className="flex min-w-0 items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-600 text-white shadow-sm">
            <QrCode className="h-6 w-6" aria-hidden />
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-xl font-bold tracking-tight sm:text-2xl">Menus &amp; QR codes</h1>
            <p className="truncate text-sm text-muted-foreground">
              Créez vos menus, publiez-les, générez vos QR codes.
            </p>
          </div>
        </Link>
        <div className="flex w-full items-center justify-end gap-2 sm:w-auto">
          <nav aria-label="Navigation principale" className="flex w-full gap-1 rounded-xl bg-stone-100 p-1 sm:w-auto">
            {TABS.map((tab) => {
              const Icon = tab.icon
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  aria-current={isActive(tab.href) ? 'page' : undefined}
                  className={cn(
                    'flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors sm:flex-none',
                    isActive(tab.href)
                      ? 'bg-white text-amber-700 shadow-sm'
                      : 'text-muted-foreground hover:text-stone-900'
                  )}
                >
                  <Icon className="h-4 w-4" aria-hidden />
                  {tab.label}
                </Link>
              )
            })}
          </nav>
          <LogoutButton />
        </div>
      </div>
    </header>
  )
}
