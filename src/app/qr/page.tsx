'use client'

import { Suspense, useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { SiteHeader } from '@/components/site-header'
import { SiteFooter } from '@/components/site-footer'
import { QrGenerator } from '@/components/qr-generator'
import { QrHistory } from '@/components/qr-history'
import { useToast } from '@/hooks/use-toast'
import type { QrHistoryItem } from '@/lib/qr-utils'
import { QrCode, Sparkles } from 'lucide-react'

function QrPageContent() {
  const { toast } = useToast()
  const searchParams = useSearchParams()
  const initialUrl = searchParams.get('url') ?? ''
  const initialTitle = searchParams.get('title') ?? ''

  const [items, setItems] = useState<QrHistoryItem[]>([])
  const [loadingHistory, setLoadingHistory] = useState(true)
  const [historyUnavailable, setHistoryUnavailable] = useState(false)
  const [loadRequest, setLoadRequest] = useState<{ item: QrHistoryItem; ts: number } | null>(null)

  const fetchHistory = useCallback(async () => {
    try {
      const res = await fetch('/api/qrcodes', { cache: 'no-store' })
      if (res.status === 503) {
        setHistoryUnavailable(true)
        return
      }
      if (!res.ok) throw new Error('fetch failed')
      setHistoryUnavailable(false)
      const data: QrHistoryItem[] = await res.json()
      setItems(data)
    } catch {
      toast({
        title: 'Erreur',
        description: "Impossible de charger l'historique.",
        variant: 'destructive',
      })
    } finally {
      setLoadingHistory(false)
    }
  }, [toast])

  useEffect(() => {
    void fetchHistory()
  }, [fetchHistory])

  const handleLoad = (item: QrHistoryItem) => {
    setLoadRequest({ item, ts: Date.now() })
    toast({
      title: 'Réglages chargés',
      description: `« ${item.title} » est prêt à être modifié ou retéléchargé.`,
    })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleDelete = async (id: string) => {
    const previous = items
    setItems((current) => current.filter((it) => it.id !== id))
    try {
      const res = await fetch(`/api/qrcodes/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('delete failed')
      toast({ title: 'Supprimé', description: 'Le QR code a été retiré de l’historique.' })
    } catch {
      setItems(previous)
      toast({
        title: 'Erreur',
        description: 'La suppression a échoué. Réessayez.',
        variant: 'destructive',
      })
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-stone-50">
      <SiteHeader />

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6">
        {initialUrl && (
          <div className="mb-6 flex items-center gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <Sparkles className="h-4 w-4 shrink-0 text-amber-600" aria-hidden />
            <p>
              Lien pré-rempli depuis votre menu
              {initialTitle ? (
                <>
                  {' '}
                  <strong>« {initialTitle} »</strong>
                </>
              ) : null}
              . Personnalisez le QR code (logo, couleurs), puis téléchargez-le pour l'imprimer.
            </p>
          </div>
        )}

        <QrGenerator
          onSaved={() => void fetchHistory()}
          loadRequest={loadRequest}
          initialUrl={initialUrl}
          initialTitle={initialTitle}
        />

        <div className="my-8 border-t border-stone-200" aria-hidden />

        <QrHistory
          items={items}
          loading={loadingHistory}
          unavailable={historyUnavailable}
          onLoad={handleLoad}
          onDelete={handleDelete}
        />
      </main>

      <SiteFooter />
    </div>
  )
}

export default function QrPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen flex-col bg-stone-50">
          <SiteHeader />
          <main className="mx-auto flex w-full max-w-5xl flex-1 items-center justify-center px-4 py-16">
            <QrCode className="h-8 w-8 animate-pulse text-stone-300" aria-hidden />
          </main>
          <SiteFooter />
        </div>
      }
    >
      <QrPageContent />
    </Suspense>
  )
}
