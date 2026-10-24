'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  BadgeCheck,
  CircleDashed,
  Copy,
  ExternalLink,
  FileText,
  Globe,
  Link2,
  MoreVertical,
  Pencil,
  Plus,
  QrCode,
  Trash2,
  UtensilsCrossed,
} from 'lucide-react'
import { SiteHeader } from '@/components/site-header'
import { SiteFooter } from '@/components/site-footer'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { useToast } from '@/hooks/use-toast'
import { formatDate } from '@/lib/qr-utils'

interface MenuListItem {
  id: string
  name: string
  slug: string
  published: boolean
  publishedAt: string | null
  accentColor: string
  itemCount: number
  updatedAt: string
}

export default function MenusHomePage() {
  const { toast } = useToast()
  const router = useRouter()
  const [menus, setMenus] = useState<MenuListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [unavailable, setUnavailable] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [newName, setNewName] = useState('')
  const [creating, setCreating] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<MenuListItem | null>(null)

  const fetchMenus = useCallback(async () => {
    try {
      const res = await fetch('/api/menus', { cache: 'no-store' })
      if (res.status === 503) {
        setUnavailable(true)
        return
      }
      if (!res.ok) throw new Error('fetch failed')
      const data: MenuListItem[] = await res.json()
      setMenus(data)
    } catch {
      toast({
        title: 'Erreur',
        description: 'Impossible de charger vos menus.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    void fetchMenus()
  }, [fetchMenus])

  const handleCreate = async () => {
    setCreating(true)
    try {
      const res = await fetch('/api/menus', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim() || 'Nouveau menu' }),
      })
      if (!res.ok) throw new Error('create failed')
      const menu = await res.json()
      router.push(`/menus/${menu.id}`)
    } catch {
      toast({
        title: 'Erreur',
        description: 'La création du menu a échoué. Réessayez.',
        variant: 'destructive',
      })
      setCreating(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    const target = deleteTarget
    const previous = menus
    setMenus((current) => current.filter((m) => m.id !== target.id))
    setDeleteTarget(null)
    try {
      const res = await fetch(`/api/menus/${target.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('delete failed')
      toast({ title: 'Menu supprimé', description: `« ${target.name} » a été retiré.` })
    } catch {
      setMenus(previous)
      toast({
        title: 'Erreur',
        description: 'La suppression a échoué. Réessayez.',
        variant: 'destructive',
      })
    }
  }

  const copyLink = async (menu: MenuListItem) => {
    const url = `${window.location.origin}/m/${menu.slug}`
    try {
      await navigator.clipboard.writeText(url)
      toast({ title: 'Lien copié', description: url })
    } catch {
      toast({
        title: 'Copie impossible',
        description: url,
      })
    }
  }

  // Tolérance de 2 s : Prisma et JS peuvent dater à quelques ms d'écart
  const wasModifiedSincePublish = (menu: MenuListItem) =>
    menu.published &&
    menu.publishedAt !== null &&
    new Date(menu.updatedAt).getTime() - new Date(menu.publishedAt).getTime() > 2000

  return (
    <div className="flex min-h-screen flex-col bg-stone-50">
      <SiteHeader />

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Mes menus</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Créez un menu, publiez-le, puis générez son QR code. Modifiez-le à volonté :
              l'adresse publique ne change jamais.
            </p>
          </div>
          <Button
            onClick={() => setCreateOpen(true)}
            className="bg-amber-600 text-white hover:bg-amber-700"
            disabled={unavailable}
          >
            <Plus className="mr-2 h-4 w-4" aria-hidden />
            Créer un menu
          </Button>
        </div>

        {unavailable ? (
          <Card className="border-dashed bg-amber-50/50">
            <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
              <Globe className="h-8 w-8 text-muted-foreground/40" aria-hidden />
              <p className="text-sm font-medium">Base de données non configurée</p>
              <p className="max-w-md text-sm text-muted-foreground">
                La création de menus nécessite une base de données. Sur votre déploiement Vercel,
                connectez une base gratuite (étape facultative du guide de déploiement), puis
                rechargez cette page. Le générateur de QR codes, lui, fonctionne déjà dans
                l'onglet « QR code ».
              </p>
            </CardContent>
          </Card>
        ) : loading ? (
          <div className="grid gap-4 sm:grid-cols-2">
            {Array.from({ length: 2 }).map((_, i) => (
              <Skeleton key={i} className="h-40 rounded-xl" />
            ))}
          </div>
        ) : menus.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center gap-6 py-10 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-amber-100">
                <UtensilsCrossed className="h-7 w-7 text-amber-700" aria-hidden />
              </div>
              <div>
                <p className="font-medium">Aucun menu pour le moment</p>
                <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
                  Créez votre premier menu : ajoutez vos catégories (entrées, plats, desserts…),
                  vos plats et leurs prix, publiez, puis imprimez le QR code sur vos tables.
                </p>
              </div>
              <Button
                onClick={() => setCreateOpen(true)}
                className="bg-amber-600 text-white hover:bg-amber-700"
              >
                <Plus className="mr-2 h-4 w-4" aria-hidden />
                Créer mon premier menu
              </Button>
              <div className="grid w-full max-w-2xl gap-3 pt-4 text-left sm:grid-cols-3">
                {[
                  {
                    icon: Pencil,
                    title: '1. Créez',
                    text: 'Nom du menu, catégories, plats, prix et description.',
                  },
                  {
                    icon: Globe,
                    title: '2. Publiez',
                    text: 'Votre menu obtient une adresse web élégante, lisible sur mobile.',
                  },
                  {
                    icon: QrCode,
                    title: '3. Imprimez',
                    text: 'Générez le QR code avec votre logo et vos couleurs.',
                  },
                ].map((step) => {
                  const Icon = step.icon
                  return (
                    <div key={step.title} className="rounded-xl border border-stone-200 bg-white p-4">
                      <Icon className="h-5 w-5 text-amber-600" aria-hidden />
                      <p className="mt-2 text-sm font-semibold">{step.title}</p>
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{step.text}</p>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2" aria-label="Vos menus">
            {menus.map((menu) => (
              <li key={menu.id}>
                <Card className="h-full transition-shadow hover:shadow-md">
                  <CardContent className="flex h-full flex-col gap-4 p-5">
                    <div className="flex items-start gap-3">
                      <div
                        className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-white"
                        style={{ backgroundColor: menu.accentColor }}
                        aria-hidden
                      >
                        <FileText className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold" title={menu.name}>
                          {menu.name}
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {menu.itemCount} article{menu.itemCount > 1 ? 's' : ''} · modifié le{' '}
                          {formatDate(menu.updatedAt)}
                        </p>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 shrink-0 text-muted-foreground"
                            aria-label={`Actions pour le menu ${menu.name}`}
                          >
                            <MoreVertical className="h-4 w-4" aria-hidden />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => router.push(`/menus/${menu.id}`)}>
                            <Pencil className="mr-2 h-4 w-4" aria-hidden />
                            Modifier
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => copyLink(menu)} disabled={!menu.published}>
                            <Link2 className="mr-2 h-4 w-4" aria-hidden />
                            Copier le lien public
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-red-600 focus:text-red-700"
                            onClick={() => setDeleteTarget(menu)}
                          >
                            <Trash2 className="mr-2 h-4 w-4" aria-hidden />
                            Supprimer
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {menu.published ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-800">
                          <BadgeCheck className="h-3.5 w-3.5" aria-hidden />
                          Publié
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-stone-200 px-2.5 py-0.5 text-xs font-medium text-stone-600">
                          <CircleDashed className="h-3.5 w-3.5" aria-hidden />
                          Brouillon
                        </span>
                      )}
                      {wasModifiedSincePublish(menu) && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800">
                          Modifié depuis la publication
                        </span>
                      )}
                    </div>

                    <div className="mt-auto flex flex-wrap gap-1.5">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 px-3 text-xs"
                        onClick={() => router.push(`/menus/${menu.id}`)}
                      >
                        <Pencil className="mr-1 h-3.5 w-3.5" aria-hidden />
                        Modifier
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 px-3 text-xs"
                        onClick={() =>
                          window.open(`/m/${menu.slug}${menu.published ? '' : `?preview=${menu.id}`}`, '_blank')
                        }
                      >
                        <ExternalLink className="mr-1 h-3.5 w-3.5" aria-hidden />
                        Aperçu
                      </Button>
                      {menu.published && (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 px-3 text-xs"
                            onClick={() => copyLink(menu)}
                          >
                            <Link2 className="mr-1 h-3.5 w-3.5" aria-hidden />
                            Copier le lien
                          </Button>
                          <Button
                            size="sm"
                            className="h-8 bg-amber-600 px-3 text-xs text-white hover:bg-amber-700"
                            onClick={() =>
                              router.push(
                                `/qr?url=${encodeURIComponent(`${window.location.origin}/m/${menu.slug}`)}&title=${encodeURIComponent(menu.name)}`
                              )
                            }
                          >
                            <QrCode className="mr-1 h-3.5 w-3.5" aria-hidden />
                            QR code
                          </Button>
                        </>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </main>

      <SiteFooter />

      {/* Boîte de création de menu */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Créer un nouveau menu</DialogTitle>
            <DialogDescription>
              Vous pourrez ensuite ajouter vos catégories, plats, prix et publier quand vous voulez.
            </DialogDescription>
          </DialogHeader>
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Ex. Carte du soir — Hiver 2026"
            autoFocus
            maxLength={80}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !creating) void handleCreate()
            }}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={creating}>
              Annuler
            </Button>
            <Button
              onClick={() => void handleCreate()}
              disabled={creating}
              className="bg-amber-600 text-white hover:bg-amber-700"
            >
              {creating ? 'Création…' : 'Créer le menu'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmation de suppression */}
      <AlertDialog open={deleteTarget !== null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce menu ?</AlertDialogTitle>
            <AlertDialogDescription>
              « {deleteTarget?.name} » et tous ses articles seront définitivement supprimés.
              {deleteTarget?.published &&
                ' Attention : les QR codes déjà imprimés pointeront vers une page indisponible.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 text-white hover:bg-red-700"
              onClick={(e) => {
                e.preventDefault()
                void handleDelete()
              }}
            >
              Supprimer définitivement
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
