'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useToast } from '@/hooks/use-toast'
import { formatDate, downloadPng, slugify, loadImage, renderQrDataUrl } from '@/lib/qr-utils'
import type { QrHistoryItem } from '@/lib/qr-utils'
import { History, Trash2, RotateCcw, Download, ImageOff, CloudOff } from 'lucide-react'

interface QrHistoryProps {
  items: QrHistoryItem[]
  loading: boolean
  /** true = déploiement sans base de données : l'historique en ligne est désactivé */
  unavailable?: boolean
  onLoad: (item: QrHistoryItem) => void
  onDelete: (id: string) => void
}

export function QrHistory({ items, loading, unavailable = false, onLoad, onDelete }: QrHistoryProps) {
  const { toast } = useToast()
  const [previews, setPreviews] = useState<Record<string, string>>({})

  // Génère des mini-aperçus pour chaque élément de l'historique (logo inclus le cas échéant)
  useEffect(() => {
    let cancelled = false
    const generate = async () => {
      const next: Record<string, string> = {}
      for (const item of items) {
        try {
          let logoImg: HTMLImageElement | null = null
          if (item.logo) {
            try {
              logoImg = await loadImage(item.logo)
            } catch {
              logoImg = null
            }
          }
          next[item.id] = await renderQrDataUrl({
            url: item.url,
            size: 128,
            margin: 1,
            level: logoImg ? 'H' : 'M',
            fgColor: item.fgColor,
            bgColor: item.bgColor,
            logoImg,
            logoSizePct: item.logoSize ?? 22,
            logoPadding: true,
          })
        } catch {
          // ignoré : pas d'aperçu possible
        }
      }
      if (!cancelled) setPreviews(next)
    }
    void generate()
    return () => {
      cancelled = true
    }
  }, [items])

  const handleRedownload = async (item: QrHistoryItem) => {
    try {
      let logoImg: HTMLImageElement | null = null
      if (item.logo) {
        try {
          logoImg = await loadImage(item.logo)
        } catch {
          logoImg = null
        }
      }
      const dataUrl = await renderQrDataUrl({
        url: item.url,
        size: Math.max(item.size, 512),
        margin: 2,
        level: logoImg ? 'H' : 'M',
        fgColor: item.fgColor,
        bgColor: item.bgColor,
        logoImg,
        logoSizePct: item.logoSize ?? 22,
        logoPadding: true,
      })
      downloadPng(dataUrl, `${slugify(item.title)}.png`)
      toast({
        title: 'Téléchargement lancé',
        description: `${slugify(item.title)}.png${logoImg ? ' avec logo' : ''}`,
      })
    } catch {
      toast({
        title: 'Erreur',
        description: 'Impossible de régénérer ce QR code.',
        variant: 'destructive',
      })
    }
  }

  return (
    <section aria-labelledby="history-title" className="space-y-4">
      <div className="flex items-center gap-2">
        <History className="h-5 w-5 text-amber-600" aria-hidden />
        <h2 id="history-title" className="text-xl font-semibold tracking-tight">
          Historique
        </h2>
        {items.length > 0 && (
          <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800">
            {items.length}
          </span>
        )}
      </div>

      {unavailable ? (
        <Card className="border-dashed bg-amber-50/50">
          <CardContent className="flex flex-col items-center gap-2 py-8 text-center">
            <CloudOff className="h-8 w-8 text-muted-foreground/40" aria-hidden />
            <p className="text-sm font-medium">Historique en ligne non configuré</p>
            <p className="max-w-md text-sm text-muted-foreground">
              Rassurez-vous, tout le reste fonctionne : générez vos QR codes et téléchargez-les
              en PNG ou SVG. Pour enregistrer vos réglages et les retrouver plus tard,
              connectez une base de données gratuite (étape facultative du guide de déploiement).
            </p>
          </CardContent>
        </Card>
      ) : loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-2 py-8 text-center">
            <ImageOff className="h-8 w-8 text-muted-foreground/40" aria-hidden />
            <p className="text-sm text-muted-foreground">
              Aucun QR code enregistré pour le moment. Générez-en un puis cliquez sur « Enregistrer ».
            </p>
          </CardContent>
        </Card>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-label="QR codes enregistrés">
          {items.map((item) => (
            <li key={item.id}>
              <Card className="h-full transition-shadow hover:shadow-md">
                <CardContent className="flex h-full items-center gap-4 p-4">
                  <div
                    className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border"
                    style={{ backgroundColor: item.bgColor }}
                  >
                    {previews[item.id] ? (
                      <img
                        src={previews[item.id]}
                        alt={`Miniature du QR code « ${item.title} »`}
                        className="h-full w-full object-contain"
                      />
                    ) : (
                      <History className="h-6 w-6 text-muted-foreground/40" aria-hidden />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium" title={item.title}>
                      {item.title}
                    </p>
                    <p className="truncate text-sm text-muted-foreground" title={item.url}>
                      {item.url}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(item.createdAt)}
                      {item.logo ? ' · avec logo' : ''}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 px-2.5 text-xs"
                        onClick={() => onLoad(item)}
                        title="Recharger ces réglages dans le générateur"
                      >
                        <RotateCcw className="mr-1 h-3.5 w-3.5" aria-hidden />
                        Charger
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 px-2.5 text-xs"
                        onClick={() => void handleRedownload(item)}
                        title="Télécharger un PNG"
                      >
                        <Download className="mr-1 h-3.5 w-3.5" aria-hidden />
                        PNG
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 px-2.5 text-xs text-red-600 hover:bg-red-50 hover:text-red-700"
                        onClick={() => onDelete(item.id)}
                        title="Supprimer de l'historique"
                        aria-label={`Supprimer ${item.title} de l'historique`}
                      >
                        <Trash2 className="mr-1 h-3.5 w-3.5" aria-hidden />
                        Suppr.
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
