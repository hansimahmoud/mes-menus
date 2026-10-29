'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import {
  ArrowLeft,
  BadgeCheck,
  ChevronDown,
  ChevronUp,
  CircleDashed,
  Copy,
  ExternalLink,
  Eye,
  FileSpreadsheet,
  Globe,
  ImagePlus,
  Link2,
  Loader2,
  Plus,
  QrCode,
  Save,
  Trash2,
  TriangleAlert,
} from 'lucide-react'
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
import { SiteHeader } from '@/components/site-header'
import { SiteFooter } from '@/components/site-footer'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import { ImportExcelDialog } from '@/components/import-excel-dialog'
import type { ParsedRow } from '@/lib/excel-import'

interface MenuData {
  id: string
  name: string
  slug: string
  published: boolean
  publishedAt: string | null
  accentColor: string
  fontStyle: string
  fontSize: string
  currency: string
  footerNote: string | null
  photo: string | null
  updatedAt: string
  items: {
    id: string
    category: string
    name: string
    description: string | null
    price: number | null
    sortOrder: number
  }[]
}

interface EditorItem {
  key: string
  category: string
  name: string
  description: string
  price: string
}

const ACCENT_PRESETS: { name: string; value: string }[] = [
  { name: 'Orange zesté', value: '#ea580c' },
  { name: 'Framboise', value: '#e11d48' },
  { name: 'Vert basilic', value: '#16a34a' },
  { name: 'Sarcelle', value: '#0d9488' },
  { name: 'Violet', value: '#9333ea' },
  { name: 'Rouge tomate', value: '#dc2626' },
]

// Styles d'écriture proposés dans l'éditeur (rendus avec les vraies polices,
// chargées globalement par layout.tsx).
const FONT_STYLE_OPTIONS: { value: string; label: string; sampleFont: string }[] = [
  { value: 'classique', label: 'Classique', sampleFont: 'var(--font-playfair)' },
  { value: 'moderne', label: 'Moderne', sampleFont: 'var(--font-geist-sans)' },
  { value: 'bistrot', label: 'Bistrot', sampleFont: 'var(--font-cormorant)' },
  { value: 'manuscrit', label: 'Manuscrit', sampleFont: 'var(--font-dancing)' },
]

// Échelles de taille du texte de la page publique.
const FONT_SIZE_OPTIONS: { value: string; label: string; sampleSize: string }[] = [
  { value: 'compact', label: 'Compacte', sampleSize: '0.8rem' },
  { value: 'normal', label: 'Normale', sampleSize: '1.05rem' },
  { value: 'grand', label: 'Généreuse', sampleSize: '1.35rem' },
]

function parsePrice(raw: string): number | null {
  const cleaned = raw.trim().replace(',', '.')
  if (!cleaned) return null
  const value = Number.parseFloat(cleaned)
  if (!Number.isFinite(value) || value < 0) return null
  return Math.round(value * 100) / 100
}

function priceToInput(price: number | null): string {
  return price === null ? '' : price.toFixed(2).replace('.', ',')
}

// Compresse une photo choisie pour l'arrière-plan de la feuille : 1600 px max, JPEG ~82 %.
// Évite des data URLs géantes en base tout en gardant une belle résolution d'affichage.
function compressPhotoFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!/^image\/(png|jpe?g|webp)$/i.test(file.type)) {
      reject(new Error('format'))
      return
    }
    if (file.size > 12 * 1024 * 1024) {
      reject(new Error('taille'))
      return
    }
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      try {
        const MAX = 1600
        const scale = Math.min(1, MAX / Math.max(img.width, img.height))
        const width = Math.max(1, Math.round(img.width * scale))
        const height = Math.max(1, Math.round(img.height * scale))
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        if (!ctx) throw new Error('canvas')
        ctx.drawImage(img, 0, 0, width, height)
        resolve(canvas.toDataURL('image/jpeg', 0.82))
      } catch (error) {
        reject(error)
      } finally {
        URL.revokeObjectURL(url)
      }
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('lecture'))
    }
    img.src = url
  })
}

export default function MenuEditorPage() {
  const { toast } = useToast()
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const menuId = params?.id

  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [menu, setMenu] = useState<MenuData | null>(null)
  const [name, setName] = useState('')
  const [accentColor, setAccentColor] = useState('#ea580c')
  const [fontStyle, setFontStyle] = useState('classique')
  const [fontSize, setFontSize] = useState('normal')
  const [currency, setCurrency] = useState('€')
  const [footerNote, setFooterNote] = useState('')
  const [photo, setPhoto] = useState<string | null>(null)
  const [items, setItems] = useState<EditorItem[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [newCategory, setNewCategory] = useState('')
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [publicUrl, setPublicUrl] = useState('')
  const [importOpen, setImportOpen] = useState(false)
  const [categoryToDelete, setCategoryToDelete] = useState<string | null>(null)
  const keyCounter = useRef(0)

  const nextKey = () => {
    keyCounter.current += 1
    return `item-${keyCounter.current}`
  }

  const loadMenu = useCallback(async () => {
    if (!menuId) return
    try {
      const res = await fetch(`/api/menus/${menuId}`, { cache: 'no-store' })
      if (res.status === 404) {
        setNotFound(true)
        return
      }
      if (!res.ok) throw new Error('fetch failed')
      const data: MenuData = await res.json()
      setMenu(data)
      setName(data.name)
      setAccentColor(data.accentColor)
      setFontStyle(data.fontStyle || 'classique')
      setFontSize(data.fontSize || 'normal')
      setCurrency(data.currency)
      setFooterNote(data.footerNote ?? '')
      setPhoto(data.photo ?? null)
      const mapped = data.items.map((item) => ({
        key: nextKey(),
        category: item.category,
        name: item.name,
        description: item.description ?? '',
        price: priceToInput(item.price),
      }))
      setItems(mapped)
      setCategories([...new Set(mapped.map((item) => item.category))])
      setDirty(false)
    } catch {
      toast({
        title: 'Erreur',
        description: 'Impossible de charger ce menu.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [menuId, toast])

  useEffect(() => {
    void loadMenu()
  }, [loadMenu])

  useEffect(() => {
    setPublicUrl(menu ? `${window.location.origin}/m/${menu.slug}` : '')
  }, [menu])

  // Alerte avant de quitter avec des modifications non enregistrées
  useEffect(() => {
    if (!dirty) return
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault()
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [dirty])

  const markDirty = () => setDirty(true)

  const updateItem = (key: string, patch: Partial<EditorItem>) => {
    setItems((current) => current.map((item) => (item.key === key ? { ...item, ...patch } : item)))
    markDirty()
  }

  const addItem = (category: string) => {
    setItems((current) => [...current, { key: nextKey(), category, name: '', description: '', price: '' }])
    markDirty()
  }

  const removeItem = (key: string) => {
    setItems((current) => current.filter((item) => item.key !== key))
    markDirty()
  }

  // Déplace un article, sans jamais sortir de son bloc de catégorie
  const moveItem = (index: number, direction: -1 | 1) => {
    setItems((current) => {
      const target = index + direction
      if (target < 0 || target >= current.length) return current
      if (current[target].category !== current[index].category) return current
      const next = [...current]
      const [moved] = next.splice(index, 1)
      next.splice(target, 0, moved)
      return next
    })
    markDirty()
  }

  // Déplace une catégorie d'un cran : les cartes de l'éditeur ET les articles
  // suivent le nouvel ordre (la page publique regroupe les sections dans
  // l'ordre de la liste d'articles, donc tout reste synchronisé après enregistrement).
  const moveCategory = (category: string, direction: -1 | 1) => {
    const index = categories.indexOf(category)
    const target = index + direction
    if (index === -1 || target < 0 || target >= categories.length) return
    const nextCategories = [...categories]
    const [moved] = nextCategories.splice(index, 1)
    nextCategories.splice(target, 0, moved)
    setCategories(nextCategories)
    const rank = new Map(nextCategories.map((c, i) => [c, i]))
    setItems((current) =>
      [...current].sort(
        (a, b) =>
          (rank.get(a.category) ?? Number.MAX_SAFE_INTEGER) -
          (rank.get(b.category) ?? Number.MAX_SAFE_INTEGER)
      )
    )
    markDirty()
  }

  // Suppression confirmée d'une catégorie : retire la catégorie et tous ses articles
  // (définitif au prochain « Enregistrer », l'API remplace toute la liste)
  const confirmDeleteCategory = () => {
    if (!categoryToDelete) return
    const target = categoryToDelete
    setItems((current) => current.filter((item) => item.category !== target))
    setCategories((current) => current.filter((c) => c !== target))
    setCategoryToDelete(null)
    markDirty()
    toast({
      title: `Catégorie « ${target} » supprimée`,
      description: 'Cliquez sur Enregistrer pour confirmer la suppression.',
    })
  }

  const addCategory = () => {
    const value = newCategory.trim().slice(0, 60)
    if (!value) return
    setCategories((current) => (current.includes(value) ? current : [...current, value]))
    setNewCategory('')
  }

  // Insère les articles issus du fichier Excel à la fin de la liste, dans la catégorie choisie
  const handleImportRows = (category: string, rows: ParsedRow[]) => {
    const additions = rows.map((row) => ({
      key: nextKey(),
      category,
      name: row.name,
      description: row.description,
      price: row.price === null ? '' : priceToInput(row.price),
    }))
    setItems((current) => [...current, ...additions])
    setCategories((current) => (current.includes(category) ? current : [...current, category]))
    markDirty()
    if (items.length + additions.length > 200) {
      toast({
        title: 'Limite de 200 articles',
        description: 'Le menu ne peut contenir que 200 articles : les excédents seront ignorés à l\u2019enregistrement.',
        variant: 'destructive',
      })
    } else {
      toast({
        title: `${additions.length} article${additions.length > 1 ? 's' : ''} importé${additions.length > 1 ? 's' : ''}`,
        description: `Ajoutés dans « ${category} ». Vérifiez l'aperçu puis cliquez sur Enregistrer.`,
      })
    }
  }

  // Photo du restaurant : compression locale puis ajout à l'aperçu (enregistrée au prochain « Enregistrer »)
  const applyPhotoFile = async (file: File | undefined | null) => {
    if (!file) return
    try {
      const dataUrl = await compressPhotoFile(file)
      setPhoto(dataUrl)
      markDirty()
      toast({
        title: 'Photo ajoutée',
        description: 'Enregistrez puis republiez pour l\u2019afficher sur la page publique.',
      })
    } catch {
      toast({
        title: 'Photo refusée',
        description: 'Utilisez une image JPG, PNG ou WebP de 12 Mo maximum.',
        variant: 'destructive',
      })
    }
  }

  const buildPayload = () => ({
    name: name.trim() || 'Menu sans nom',
    accentColor,
    fontStyle,
    fontSize,
    currency: currency.trim() || '€',
    footerNote: footerNote.trim() || null,
    photo,
    items: items.map((item, index) => ({
      category: item.category,
      name: item.name.trim(),
      description: item.description.trim() || null,
      price: parsePrice(item.price),
      sortOrder: index,
    })),
  })

  const handleSave = async (): Promise<boolean> => {
    if (!menuId || !menu) return false
    if (!name.trim()) {
      toast({ title: 'Nom requis', description: 'Donnez un nom à votre menu avant d’enregistrer.' })
      return false
    }
    setSaving(true)
    try {
      const res = await fetch(`/api/menus/${menuId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildPayload()),
      })
      if (res.status === 503) {
        toast({
          title: 'Base de données non configurée',
          description: 'Sur Vercel, connectez une base gratuite pour enregistrer (guide de déploiement).',
          variant: 'destructive',
        })
        return false
      }
      if (!res.ok) throw new Error('save failed')
      const data: MenuData = await res.json()
      setMenu(data)
      const mapped = data.items.map((item) => ({
        key: nextKey(),
        category: item.category,
        name: item.name,
        description: item.description ?? '',
        price: priceToInput(item.price),
      }))
      setItems(mapped)
      setCategories((current) => {
        const used = [...new Set(mapped.map((item) => item.category))]
        return [...current.filter((c) => used.includes(c) || mapped.length === 0), ...used.filter((c) => !current.includes(c))]
      })
      setDirty(false)
      toast({ title: 'Menu enregistré', description: 'Vos modifications sont sauvegardées.' })
      return true
    } catch {
      toast({
        title: 'Erreur',
        description: "L'enregistrement a échoué. Réessayez.",
        variant: 'destructive',
      })
      return false
    } finally {
      setSaving(false)
    }
  }

  const handlePublish = async (published: boolean) => {
    if (!menuId || !menu) return
    setPublishing(true)
    try {
      if (dirty) {
        const saved = await handleSave()
        if (!saved) return
      }
      const res = await fetch(`/api/menus/${menuId}/publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ published }),
      })
      if (res.status === 503) {
        toast({
          title: 'Base de données non configurée',
          description: 'Sur Vercel, connectez une base gratuite pour publier (guide de déploiement).',
          variant: 'destructive',
        })
        return
      }
      if (!res.ok) throw new Error('publish failed')
      const data: MenuData = await res.json()
      setMenu((current) =>
        current
          ? { ...current, published: data.published, publishedAt: data.publishedAt, updatedAt: data.updatedAt }
          : current
      )
      toast(
        published
          ? {
              title: 'Menu publié !',
              description: 'Vos QR codes déjà imprimés restent valables : seule la page web est mise à jour.',
            }
          : { title: 'Menu dépublié', description: 'La page publique n’est plus accessible.' }
      )
    } catch {
      toast({
        title: 'Erreur',
        description: 'La publication a échoué. Réessayez.',
        variant: 'destructive',
      })
    } finally {
      setPublishing(false)
    }
  }

  const copyLink = async () => {
    if (!publicUrl) return
    try {
      await navigator.clipboard.writeText(publicUrl)
      toast({ title: 'Lien copié', description: publicUrl })
    } catch {
      toast({ title: 'Copie impossible', description: publicUrl })
    }
  }

  // Tolérance de 2 s : Prisma et JS peuvent dater à quelques ms d'écart
  const hasUnpublishedChanges =
    dirty ||
    (menu?.published === true &&
      menu.publishedAt !== null &&
      new Date(menu.updatedAt).getTime() - new Date(menu.publishedAt).getTime() > 2000)

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col bg-stone-50">
        <SiteHeader />
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6">
          <Skeleton className="h-14 rounded-xl" />
          <div className="mt-6 grid gap-6 lg:grid-cols-3">
            <div className="space-y-4 lg:col-span-2">
              <Skeleton className="h-64 rounded-xl" />
              <Skeleton className="h-40 rounded-xl" />
            </div>
            <Skeleton className="h-72 rounded-xl" />
          </div>
        </main>
      </div>
    )
  }

  if (notFound || !menu) {
    return (
      <div className="flex min-h-screen flex-col bg-stone-50">
        <SiteHeader />
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-16 text-center">
          <p className="text-lg font-semibold">Menu introuvable</p>
          <p className="mt-2 text-sm text-muted-foreground">Il a peut-être été supprimé.</p>
          <Button asChild className="mt-6">
            <Link href="/">
              <ArrowLeft className="mr-2 h-4 w-4" aria-hidden />
              Retour à mes menus
            </Link>
          </Button>
        </main>
        <SiteFooter />
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col bg-stone-50">
      <SiteHeader />

      {/* Barre d'outils */}
      <div className="sticky top-0 z-10 border-b border-stone-200 bg-stone-50/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center gap-2 px-4 py-3 sm:px-6">
          <Button asChild variant="ghost" size="icon" className="h-9 w-9 shrink-0" aria-label="Retour à mes menus">
            <Link href="/">
              <ArrowLeft className="h-4 w-4" aria-hidden />
            </Link>
          </Button>
          <Input
            value={name}
            onChange={(e) => {
              setName(e.target.value)
              markDirty()
            }}
            placeholder="Nom du menu"
            className="h-9 min-w-0 flex-1 border-transparent bg-transparent text-base font-semibold shadow-none focus-visible:border-stone-300 focus-visible:bg-white sm:text-lg"
            maxLength={80}
            aria-label="Nom du menu"
          />
          {menu.published ? (
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-800">
              <BadgeCheck className="h-3.5 w-3.5" aria-hidden />
              Publié
            </span>
          ) : (
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-stone-200 px-2.5 py-1 text-xs font-medium text-stone-600">
              <CircleDashed className="h-3.5 w-3.5" aria-hidden />
              Brouillon
            </span>
          )}
          {hasUnpublishedChanges && (
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-800">
              <TriangleAlert className="h-3.5 w-3.5" aria-hidden />
              <span className="hidden sm:inline">Modifications non publiées</span>
              <span className="sm:hidden">Non publié</span>
            </span>
          )}
          <div className="flex shrink-0 items-center gap-2">
            <Button variant="outline" size="sm" className="h-9" onClick={() => void handleSave()} disabled={saving}>
              {saving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden /> : <Save className="mr-1.5 h-4 w-4" aria-hidden />}
              Enregistrer
            </Button>
            <Button
              size="sm"
              className="h-9 bg-amber-600 text-white hover:bg-amber-700"
              onClick={() => void handlePublish(true)}
              disabled={publishing}
            >
              {publishing ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden /> : <Globe className="mr-1.5 h-4 w-4" aria-hidden />}
              {menu.published ? (dirty ? 'Enregistrer & republier' : 'Republier') : 'Publier'}
            </Button>
          </div>
        </div>
      </div>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 sm:px-6">
        {/* grid-cols-1 explicite (minmax(0,1fr)) : empêche la colonne de dépasser l'écran sur mobile */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Colonne principale : catégories et articles */}
          <div className="space-y-5 lg:col-span-2">
            {categories.map((category, categoryIndex) => {
              const sectionItems = items
                .map((item, index) => ({ item, index }))
                .filter(({ item }) => item.category === category)
              return (
                <Card key={category}>
                  <CardHeader className="flex flex-wrap items-center justify-between gap-2 space-y-0 pb-3">
                    <div className="flex min-w-0 items-center gap-2">
                      <div
                        className="flex shrink-0 items-center overflow-hidden rounded-lg border border-stone-200 bg-white"
                        role="group"
                        aria-label={`Déplacer la catégorie ${category}`}
                      >
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 rounded-none"
                          onClick={() => moveCategory(category, -1)}
                          disabled={categoryIndex === 0}
                          aria-label={`Monter la catégorie ${category}`}
                        >
                          <ChevronUp className="h-3.5 w-3.5" aria-hidden />
                        </Button>
                        <span className="h-4 w-px shrink-0 bg-stone-200" aria-hidden />
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 rounded-none"
                          onClick={() => moveCategory(category, 1)}
                          disabled={categoryIndex === categories.length - 1}
                          aria-label={`Descendre la catégorie ${category}`}
                        >
                          <ChevronDown className="h-3.5 w-3.5" aria-hidden />
                        </Button>
                      </div>
                      <div className="min-w-0">
                        <CardTitle className="truncate text-lg" style={{ color: accentColor }}>
                          {category}
                        </CardTitle>
                        <p className="text-xs text-muted-foreground">
                          {sectionItems.length} article{sectionItems.length > 1 ? 's' : ''}
                        </p>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 text-xs text-amber-700 hover:bg-amber-50 hover:text-amber-800"
                        onClick={() => addItem(category)}
                      >
                        <Plus className="mr-1 h-3.5 w-3.5" aria-hidden />
                        Ajouter un article
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-red-600 hover:bg-red-50 hover:text-red-700"
                        onClick={() => setCategoryToDelete(category)}
                        aria-label={`Supprimer la catégorie ${category}`}
                      >
                        <Trash2 className="h-4 w-4" aria-hidden />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {sectionItems.length === 0 ? (
                      <p className="rounded-lg border border-dashed border-stone-200 py-4 text-center text-sm text-muted-foreground">
                        Aucun article dans cette catégorie pour l'instant.
                      </p>
                    ) : (
                      sectionItems.map(({ item, index }) => (
                        <div key={item.key} className="rounded-xl border border-stone-200 bg-white p-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <Input
                              value={item.name}
                              onChange={(e) => updateItem(item.key, { name: e.target.value })}
                              placeholder="Nom du plat"
                              className="h-9 min-w-0 flex-1 font-medium"
                              maxLength={120}
                              aria-label="Nom du plat"
                            />
                            <Input
                              value={item.price}
                              onChange={(e) => updateItem(item.key, { price: e.target.value })}
                              placeholder="Prix"
                              inputMode="decimal"
                              className="h-9 w-24 shrink-0 text-right tabular-nums"
                              aria-label={`Prix en ${currency}`}
                            />
                            <div className="flex shrink-0 items-center gap-0.5">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-muted-foreground"
                                onClick={() => moveItem(index, -1)}
                                disabled={index === 0 || items[index - 1]?.category !== item.category}
                                aria-label="Monter l'article"
                              >
                                <ChevronUp className="h-4 w-4" aria-hidden />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-muted-foreground"
                                onClick={() => moveItem(index, 1)}
                                disabled={
                                  index === items.length - 1 || items[index + 1]?.category !== item.category
                                }
                                aria-label="Descendre l'article"
                              >
                                <ChevronDown className="h-4 w-4" aria-hidden />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-red-600 hover:bg-red-50 hover:text-red-700"
                                onClick={() => removeItem(item.key)}
                                aria-label={`Supprimer ${item.name || 'cet article'}`}
                              >
                                <Trash2 className="h-4 w-4" aria-hidden />
                              </Button>
                            </div>
                          </div>
                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            <Input
                              value={item.description}
                              onChange={(e) => updateItem(item.key, { description: e.target.value })}
                              placeholder="Description (ingrédients, accompagnement…)"
                              className="h-8 min-w-0 flex-1 text-sm"
                              maxLength={400}
                              aria-label="Description du plat"
                            />
                            <Select
                              value={category}
                              onValueChange={(value) => updateItem(item.key, { category: value })}
                            >
                              <SelectTrigger className="h-8 w-36 shrink-0 text-xs" aria-label="Catégorie de l'article">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {categories.map((c) => (
                                  <SelectItem key={c} value={c}>
                                    {c}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      ))
                    )}
                  </CardContent>
                </Card>
              )
            })}

            {/* Nouvelle catégorie + import Excel */}
            <Card className="border-dashed">
              <CardContent className="space-y-3 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Input
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        addCategory()
                      }
                    }}
                    placeholder="Nouvelle catégorie (ex. Entrées, Plats, Desserts, Boissons…)"
                    className="h-9 min-w-0 flex-1"
                    maxLength={60}
                    aria-label="Nom de la nouvelle catégorie"
                  />
                  <Button variant="outline" className="h-9" onClick={addCategory}>
                    <Plus className="mr-1.5 h-4 w-4" aria-hidden />
                    Ajouter la catégorie
                  </Button>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-dashed border-stone-200 pt-3">
                  <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <FileSpreadsheet className="h-3.5 w-3.5 shrink-0 text-emerald-700" aria-hidden />
                    Vos plats sont déjà dans un fichier Excel ? Importez-les d'un coup.
                  </p>
                  <Button
                    variant="outline"
                    className="h-9 border-emerald-700 text-emerald-800 hover:bg-emerald-50 hover:text-emerald-900"
                    onClick={() => setImportOpen(true)}
                  >
                    <FileSpreadsheet className="mr-1.5 h-4 w-4" aria-hidden />
                    Importer depuis Excel
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Colonne latérale : apparence et publication */}
          <div className="space-y-5">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Apparence</CardTitle>
                <CardDescription>
                  Couleur, écriture et taille : habillez la page publique de votre menu.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="accent-color">Couleur d'accent</Label>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {ACCENT_PRESETS.map((preset) => (
                      <button
                        key={preset.value}
                        type="button"
                        onClick={() => {
                          setAccentColor(preset.value)
                          markDirty()
                        }}
                        className="h-7 w-7 rounded-full border-2 transition-transform hover:scale-110"
                        style={{
                          backgroundColor: preset.value,
                          borderColor: accentColor === preset.value ? '#1c1917' : 'transparent',
                        }}
                        aria-label={`Couleur ${preset.name}`}
                        aria-pressed={accentColor === preset.value}
                        title={preset.name}
                      />
                    ))}
                    <label className="ml-1 flex h-7 cursor-pointer items-center gap-1.5 rounded-full border border-stone-200 px-2 text-xs text-muted-foreground hover:bg-stone-50">
                      <span className="h-3.5 w-3.5 rounded-full border" style={{ backgroundColor: accentColor }} aria-hidden />
                      Autre
                      <input
                        id="accent-color"
                        type="color"
                        value={accentColor}
                        onChange={(e) => {
                          setAccentColor(e.target.value)
                          markDirty()
                        }}
                        className="sr-only"
                      />
                    </label>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Style d'écriture</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {FONT_STYLE_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => {
                          setFontStyle(option.value)
                          markDirty()
                        }}
                        aria-pressed={fontStyle === option.value}
                        className={cn(
                          'rounded-xl border px-3 py-2 text-left transition-all hover:bg-stone-50',
                          fontStyle === option.value
                            ? 'border-amber-600 bg-amber-50 ring-1 ring-amber-600'
                            : 'border-stone-200'
                        )}
                      >
                        <span
                          className="block text-lg leading-snug text-stone-900"
                          style={{ fontFamily: option.sampleFont }}
                        >
                          La carte
                        </span>
                        <span className="mt-0.5 block text-xs text-muted-foreground">{option.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Taille du texte</Label>
                  <div className="grid grid-cols-3 gap-2">
                    {FONT_SIZE_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => {
                          setFontSize(option.value)
                          markDirty()
                        }}
                        aria-pressed={fontSize === option.value}
                        className={cn(
                          'rounded-xl border px-2 py-2 text-center transition-all hover:bg-stone-50',
                          fontSize === option.value
                            ? 'border-amber-600 bg-amber-50 ring-1 ring-amber-600'
                            : 'border-stone-200'
                        )}
                      >
                        <span
                          className="block font-semibold leading-none text-stone-900"
                          style={{ fontSize: option.sampleSize }}
                        >
                          Aa
                        </span>
                        <span className="mt-1 block text-xs text-muted-foreground">{option.label}</span>
                      </button>
                    ))}
                  </div>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    Compacte pour les grandes cartes, Généreuse pour être lu facilement sur
                    téléphone ou affiché en salle.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="currency">Symbole de devise</Label>
                  <Input
                    id="currency"
                    value={currency}
                    onChange={(e) => {
                      setCurrency(e.target.value)
                      markDirty()
                    }}
                    className="h-9 w-20 text-center"
                    maxLength={4}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="footer-note">Note de bas de menu (facultatif)</Label>
                  <Textarea
                    id="footer-note"
                    value={footerNote}
                    onChange={(e) => {
                      setFooterNote(e.target.value)
                      markDirty()
                    }}
                    placeholder="Ex. Prix TTC — service compris · Supplément pain 1 €"
                    className="min-h-20 text-sm"
                    maxLength={200}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Photo du restaurant (facultatif)</Label>
                  {photo ? (
                    <div className="overflow-hidden rounded-xl border border-stone-200">
                      <div
                        className="h-28 w-full"
                        style={{
                          backgroundImage: `url(${photo})`,
                          backgroundSize: 'cover',
                          backgroundPosition: 'center',
                        }}
                        role="img"
                        aria-label="Photo du restaurant choisie pour l'arrière-plan"
                      />
                      <div className="flex items-center justify-between gap-2 bg-white p-2">
                        <p className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                          Affichée en fond de la feuille de menu.
                        </p>
                        <div className="flex shrink-0 items-center gap-1">
                          <label className="cursor-pointer rounded-md px-2 py-1 text-xs font-medium text-amber-700 hover:bg-amber-50">
                            Remplacer
                            <input
                              type="file"
                              accept="image/png,image/jpeg,image/webp"
                              className="sr-only"
                              onChange={(e) => {
                                void applyPhotoFile(e.target.files?.[0])
                                e.target.value = ''
                              }}
                            />
                          </label>
                          <button
                            type="button"
                            onClick={() => {
                              setPhoto(null)
                              markDirty()
                            }}
                            className="rounded-md px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
                          >
                            Retirer
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <label
                      className="flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-stone-300 bg-stone-50/60 px-4 py-6 text-center transition-colors hover:border-amber-400 hover:bg-amber-50/50"
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        e.preventDefault()
                        void applyPhotoFile(e.dataTransfer.files?.[0])
                      }}
                    >
                      <ImagePlus className="h-6 w-6 text-stone-400" aria-hidden />
                      <span className="text-sm font-medium text-stone-700">Ajouter une photo</span>
                      <span className="text-xs text-muted-foreground">
                        Cliquez ou glissez-déposez — JPG, PNG, WebP (12 Mo max)
                      </span>
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        className="sr-only"
                        onChange={(e) => {
                          void applyPhotoFile(e.target.files?.[0])
                          e.target.value = ''
                        }}
                      />
                    </label>
                  )}
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    La photo habille le fond de la page publique derrière la feuille de menu. Elle est
                    automatiquement réduite pour rester légère.
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Publication</CardTitle>
                <CardDescription>
                  {menu.published
                    ? 'Votre menu est visible en ligne. Republiez après chaque modification : l’adresse reste la même.'
                    : 'Publiez votre menu pour obtenir son adresse web et générer son QR code.'}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {menu.published ? (
                  <>
                    <div className="flex items-center gap-2 rounded-lg border border-stone-200 bg-stone-50 p-2.5">
                      <Link2 className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                      <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground" title={publicUrl}>
                        {publicUrl}
                      </span>
                      <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => void copyLink()} aria-label="Copier le lien public">
                        <Copy className="h-3.5 w-3.5" aria-hidden />
                      </Button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <Button variant="outline" size="sm" className="h-9" onClick={() => window.open(`/m/${menu.slug}`, '_blank')}>
                        <Eye className="mr-1.5 h-4 w-4" aria-hidden />
                        Voir en ligne
                      </Button>
                      <Button
                        size="sm"
                        className="h-9 bg-amber-600 text-white hover:bg-amber-700"
                        onClick={() => router.push(`/qr?url=${encodeURIComponent(publicUrl)}&title=${encodeURIComponent(menu.name)}`)}
                      >
                        <QrCode className="mr-1.5 h-4 w-4" aria-hidden />
                        QR code
                      </Button>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-full text-xs text-muted-foreground"
                      onClick={() => void handlePublish(false)}
                      disabled={publishing}
                    >
                      Dépublier ce menu
                    </Button>
                  </>
                ) : (
                  <>
                    <p className="text-xs leading-relaxed text-muted-foreground">
                      Astuce : vous pouvez prévisualiser le rendu avant publication via l'aperçu
                      ci-dessous — seul vous pouvez voir ce lien secret.
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-9 w-full"
                      onClick={() => window.open(`/m/${menu.slug}?preview=${menu.id}`, '_blank')}
                    >
                      <Eye className="mr-1.5 h-4 w-4" aria-hidden />
                      Prévisualiser le brouillon
                    </Button>
                    <Button
                      className="h-9 w-full bg-amber-600 text-white hover:bg-amber-700"
                      onClick={() => void handlePublish(true)}
                      disabled={publishing}
                    >
                      <Globe className="mr-1.5 h-4 w-4" aria-hidden />
                      Publier maintenant
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>

            <Card className="border-amber-200 bg-amber-50/60">
              <CardContent className="flex gap-3 p-4">
                <QrCode className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" aria-hidden />
                <p className="text-xs leading-relaxed text-amber-900">
                  <strong>Le QR code ne change jamais.</strong> Une fois imprimé, il pointe toujours
                  vers la même adresse : modifiez vos prix ou ajoutez un plat, republiez, et vos
                  tables affichent instantanément la nouvelle version.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

      <SiteFooter />

      {/* Confirmation de suppression d'une catégorie */}
      <AlertDialog
        open={categoryToDelete !== null}
        onOpenChange={(open) => {
          if (!open) setCategoryToDelete(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer la catégorie « {categoryToDelete} » ?</AlertDialogTitle>
            <AlertDialogDescription>
              {categoryToDelete !== null && items.some((item) => item.category === categoryToDelete)
                ? `${items.filter((item) => item.category === categoryToDelete).length} article${items.filter((item) => item.category === categoryToDelete).length > 1 ? 's' : ''} de cette catégorie ser${items.filter((item) => item.category === categoryToDelete).length > 1 ? 'ont' : 'a'} retiré${items.filter((item) => item.category === categoryToDelete).length > 1 ? 's' : ''} du menu. Cette action devient définitive après un clic sur « Enregistrer ».`
                : 'Cette catégorie est vide : elle sera simplement retirée de la liste. La suppression devient définitive après un clic sur « Enregistrer ».'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 text-white hover:bg-red-700"
              onClick={confirmDeleteCategory}
            >
              Supprimer la catégorie
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Importation Excel / CSV des articles (nom, description, prix) */}
      <ImportExcelDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        categories={categories}
        currency={currency}
        onImport={handleImportRows}
      />
    </div>
  )
}
