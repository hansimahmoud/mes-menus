'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import QRCode from 'qrcode'
import type { QRCodeErrorCorrectionLevel } from 'qrcode'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { useToast } from '@/hooks/use-toast'
import {
  PRESETS,
  ERROR_LEVELS,
  ACCEPTED_LOGO_TYPES,
  normalizeUrl,
  slugify,
  downloadPng,
  downloadSvg,
  loadImage,
  prepareLogoFile,
  renderQrDataUrl,
  buildSvgWithLogo,
} from '@/lib/qr-utils'
import type { QrHistoryItem } from '@/lib/qr-utils'
import {
  QrCode,
  Link2,
  Download,
  FileImage,
  Copy,
  Save,
  Palette,
  ScanLine,
  AlertCircle,
  Loader2,
  ImagePlus,
  RefreshCcw,
  Trash2,
} from 'lucide-react'

interface QrGeneratorProps {
  onSaved: () => void
  /** Demande de chargement d'un élément de l'historique (identifiée par son horodatage) */
  loadRequest?: { item: QrHistoryItem; ts: number } | null
  /** Lien pré-rempli à l'ouverture (ex. lien public d'un menu publié) */
  initialUrl?: string
  /** Nom pré-rempli à l'ouverture (ex. nom du menu) */
  initialTitle?: string
}

export function QrGenerator({ onSaved, loadRequest, initialUrl = '', initialTitle = '' }: QrGeneratorProps) {
  const { toast } = useToast()

  const [urlInput, setUrlInput] = useState(initialUrl)
  const [title, setTitle] = useState(initialTitle)
  const [fgColor, setFgColor] = useState('#1c1917')
  const [bgColor, setBgColor] = useState('#ffffff')
  const [size, setSize] = useState(512)
  const [level, setLevel] = useState<QRCodeErrorCorrectionLevel>('M')

  const [logoDataUrl, setLogoDataUrl] = useState<string | null>(null)
  const [logoSizePct, setLogoSizePct] = useState(22)
  const [logoPadding, setLogoPadding] = useState(true)
  const [logoTick, setLogoTick] = useState(0)
  const [logoLoading, setLogoLoading] = useState(false)
  const [dropActive, setDropActive] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const logoImgRef = useRef<HTMLImageElement | null>(null)

  const [dataUrl, setDataUrl] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [saving, setSaving] = useState(false)

  // Lien normalisé utilisé pour la génération et l'enregistrement
  const normalizedUrl = useMemo(() => normalizeUrl(urlInput), [urlInput])

  // Chargement des réglages depuis l'historique
  useEffect(() => {
    if (!loadRequest) return
    const item = loadRequest.item
    setUrlInput(item.url)
    setTitle(item.title === 'Sans titre' ? '' : item.title)
    setFgColor(item.fgColor)
    setBgColor(item.bgColor)
    setSize(item.size)
    setLogoDataUrl(item.logo ?? null)
    if (item.logoSize) setLogoSizePct(item.logoSize)
  }, [loadRequest])

  // Préchargement de l'image du logo dès qu'une data URL est définie
  useEffect(() => {
    if (!logoDataUrl) {
      logoImgRef.current = null
      setLogoTick((t) => t + 1)
      return
    }
    let cancelled = false
    setLogoLoading(true)
    loadImage(logoDataUrl)
      .then((img) => {
        if (cancelled) return
        logoImgRef.current = img
        setLogoTick((t) => t + 1)
      })
      .catch(() => {
        if (cancelled) return
        logoImgRef.current = null
        toast({
          title: 'Logo illisible',
          description: "Le fichier n'a pas pu être décodé. Essayez un PNG ou un JPG.",
          variant: 'destructive',
        })
      })
      .finally(() => {
        if (!cancelled) setLogoLoading(false)
      })
    return () => {
      cancelled = true
    }
     
  }, [logoDataUrl])

  // Génération en direct avec anti-rebond
  useEffect(() => {
    if (!urlInput.trim()) {
      setDataUrl('')
      setError(null)
      return
    }
    if (!normalizedUrl) {
      setError("Lien invalide — vérifiez l'adresse saisie (ex. https://mon-restaurant.com/menu.pdf).")
      setDataUrl('')
      return
    }

    setBusy(true)
    const timer = setTimeout(() => {
      renderQrDataUrl({
        url: normalizedUrl,
        size,
        margin: 2,
        level,
        fgColor,
        bgColor,
        logoImg: logoImgRef.current,
        logoSizePct,
        logoPadding,
      })
        .then((url) => {
          setDataUrl(url)
          setError(null)
        })
        .catch(() => {
          setError('Impossible de générer le QR code pour ce contenu.')
          setDataUrl('')
        })
        .finally(() => setBusy(false))
    }, 250)

    return () => clearTimeout(timer)
  }, [urlInput, normalizedUrl, fgColor, bgColor, size, level, logoTick, logoSizePct, logoPadding])

  const hasQr = Boolean(dataUrl)
  const filename = slugify(title || 'qrcode-menu')

  const handleLogoFile = async (file: File | undefined | null) => {
    if (!file) return
    try {
      const dataUrl = await prepareLogoFile(file)
      setLogoDataUrl(dataUrl)
      if (level !== 'H') {
        setLevel('H')
        toast({
          title: 'Logo ajouté',
          description:
            'La correction d’erreur est passée en « Haute » pour garantir la lisibilité du QR avec le logo.',
        })
      } else {
        toast({ title: 'Logo ajouté', description: 'Il apparaît au centre du QR code.' })
      }
    } catch (e) {
      toast({
        title: 'Logo refusé',
        description: e instanceof Error ? e.message : 'Impossible de traiter ce fichier.',
        variant: 'destructive',
      })
    }
  }

  const handleRemoveLogo = () => {
    setLogoDataUrl(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleDownloadPng = () => {
    if (!hasQr || !normalizedUrl) return
    downloadPng(dataUrl, `${filename}.png`)
    toast({
      title: 'QR code téléchargé',
      description: `${filename}.png — ${size} × ${size} px${logoDataUrl ? ' avec logo' : ''}`,
    })
  }

  const handleDownloadSvg = async () => {
    if (!hasQr || !normalizedUrl) return
    try {
      const svg = await QRCode.toString(normalizedUrl, {
        type: 'svg',
        margin: 2,
        errorCorrectionLevel: level,
        color: { dark: fgColor, light: bgColor },
      })
      const finalSvg =
        logoDataUrl && logoImgRef.current
          ? buildSvgWithLogo(
              svg,
              logoDataUrl,
              logoImgRef.current.naturalWidth / (logoImgRef.current.naturalHeight || 1),
              logoSizePct,
              bgColor,
              logoPadding,
            )
          : svg
      downloadSvg(finalSvg, `${filename}.svg`)
      toast({
        title: 'QR code téléchargé',
        description: `${filename}.svg — vectoriel, qualité illimitée`,
      })
    } catch {
      toast({
        title: 'Erreur',
        description: 'Impossible de générer le fichier SVG.',
        variant: 'destructive',
      })
    }
  }

  const handleCopy = async () => {
    if (!hasQr) return
    try {
      const blob = await (await fetch(dataUrl)).blob()
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
      toast({ title: 'Image copiée', description: 'Le QR code est dans le presse-papiers.' })
    } catch {
      toast({
        title: 'Copie impossible',
        description: 'Votre navigateur ne permet pas la copie d’images. Téléchargez le PNG instead.',
        variant: 'destructive',
      })
    }
  }

  const handleSave = async () => {
    if (!hasQr || !normalizedUrl) return
    setSaving(true)
    try {
      const res = await fetch('/api/qrcodes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim() || 'Sans titre',
          url: normalizedUrl,
          fgColor,
          bgColor,
          size,
          logo: logoDataUrl,
          logoSize: logoDataUrl ? logoSizePct : null,
        }),
      })
      if (res.status === 503) {
        // Déploiement sans base de données : pas d'historique, mais tout le reste fonctionne
        toast({
          title: 'Historique en ligne non configuré',
          description:
            'Vos téléchargements PNG/SVG restent disponibles. Pour activer l’historique, connectez une base de données gratuite (étape facultative du guide de déploiement).',
        })
        return
      }
      if (!res.ok) throw new Error('save failed')
      toast({
        title: 'Enregistré dans l’historique',
        description: 'Retrouvez ce QR code en bas de page.',
      })
      onSaved()
    } catch {
      toast({
        title: 'Erreur',
        description: "L'enregistrement a échoué. Réessayez.",
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  const applyPreset = (fg: string, bg: string) => {
    setFgColor(fg)
    setBgColor(bg)
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Colonne gauche : saisie + personnalisation */}
      <div className="flex flex-col gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Link2 className="h-5 w-5 text-amber-600" aria-hidden />
              1. Lien de votre menu
            </CardTitle>
            <CardDescription>
              Collez l’adresse de téléchargement de votre menu (PDF, page web, Drive…).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="menu-url">Lien à encoder</Label>
              <Input
                id="menu-url"
                type="text"
                inputMode="url"
                placeholder="https://mon-restaurant.com/menu.pdf"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                autoComplete="off"
                spellCheck={false}
              />
              {error ? (
                <p className="flex items-start gap-1.5 text-sm text-red-600" role="alert">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                  {error}
                </p>
              ) : normalizedUrl ? (
                <p className="truncate text-sm text-emerald-700">
                  Encodé : <span className="font-medium">{normalizedUrl}</span>
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Le préfixe « https:// » est ajouté automatiquement si besoin.
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="menu-title">Nom du menu (facultatif)</Label>
              <Input
                id="menu-title"
                type="text"
                placeholder="Menu du soir — Restaurant Le Petit Bistrot"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={80}
              />
              <p className="text-sm text-muted-foreground">
                Sert de nom de fichier lors du téléchargement et d’intitulé dans l’historique.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Palette className="h-5 w-5 text-amber-600" aria-hidden />
              2. Personnalisation
            </CardTitle>
            <CardDescription>
              Adaptez le style à votre identité visuelle.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label>Styles rapides</Label>
              <div className="flex flex-wrap gap-2">
                {PRESETS.map((preset) => {
                  const active = preset.fg === fgColor && preset.bg === bgColor
                  return (
                    <button
                      key={preset.name}
                      type="button"
                      onClick={() => applyPreset(preset.fg, preset.bg)}
                      className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-colors hover:border-amber-600 hover:bg-amber-50 ${
                        active ? 'border-amber-600 bg-amber-50 font-medium' : 'border-border bg-background'
                      }`}
                      aria-pressed={active}
                    >
                      <span
                        className="h-4 w-4 rounded-full border border-black/10"
                        style={{
                          background: `linear-gradient(135deg, ${preset.fg} 50%, ${preset.bg} 50%)`,
                        }}
                        aria-hidden
                      />
                      {preset.name}
                    </button>
                  )
                })}
              </div>
            </div>

            <Separator />

            {/* Logo */}
            <div className="space-y-3">
              <Label htmlFor="logo-file">Logo au centre (facultatif)</Label>
              {logoDataUrl ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-3 rounded-lg border bg-muted/40 p-3">
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-md border bg-white">
                      { }
                      <img
                        src={logoDataUrl}
                        alt="Logo importé"
                        className="max-h-full max-w-full object-contain"
                      />
                    </div>
                    <div className="flex flex-1 flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <RefreshCcw className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                        Remplacer
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="text-red-600 hover:bg-red-50 hover:text-red-700"
                        onClick={handleRemoveLogo}
                      >
                        <Trash2 className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                        Retirer
                      </Button>
                    </div>
                    {logoLoading && <Loader2 className="h-4 w-4 animate-spin text-amber-600" aria-hidden />}
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="logo-size">Taille du logo</Label>
                      <Badge variant="secondary" className="font-mono">
                        {logoSizePct} %
                      </Badge>
                    </div>
                    <Slider
                      id="logo-size"
                      min={10}
                      max={30}
                      step={1}
                      value={[logoSizePct]}
                      onValueChange={(v) => setLogoSizePct(v[0])}
                      aria-label="Taille du logo en pourcentage du QR code"
                    />
                    <p className="text-sm text-muted-foreground">
                      Au-delà de 30 %, le QR devient difficile à scanner.
                    </p>
                  </div>
                  <div className="flex items-center justify-between rounded-lg border p-3">
                    <div className="space-y-0.5">
                      <Label htmlFor="logo-padding">Zone dégagée autour du logo</Label>
                      <p className="text-sm text-muted-foreground">
                        Efface les modules sous le logo pour le mettre en valeur.
                      </p>
                    </div>
                    <Switch
                      id="logo-padding"
                      checked={logoPadding}
                      onCheckedChange={setLogoPadding}
                      aria-label="Activer la zone dégagée autour du logo"
                    />
                  </div>
                </div>
              ) : (
                <label
                  htmlFor="logo-file"
                  onDragOver={(e) => {
                    e.preventDefault()
                    setDropActive(true)
                  }}
                  onDragLeave={() => setDropActive(false)}
                  onDrop={(e) => {
                    e.preventDefault()
                    setDropActive(false)
                    void handleLogoFile(e.dataTransfer.files?.[0])
                  }}
                  className={`flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed p-6 text-center transition-colors ${
                    dropActive
                      ? 'border-amber-600 bg-amber-50'
                      : 'border-border hover:border-amber-600 hover:bg-amber-50/50'
                  }`}
                >
                  <ImagePlus className="h-8 w-8 text-muted-foreground" aria-hidden />
                  <span className="text-sm font-medium">
                    Cliquez ou déposez votre logo ici
                  </span>
                  <span className="text-xs text-muted-foreground">
                    PNG, JPG, WebP ou SVG — 2 Mo max
                  </span>
                  <input
                    ref={fileInputRef}
                    id="logo-file"
                    type="file"
                    accept={ACCEPTED_LOGO_TYPES.join(',')}
                    className="sr-only"
                    onChange={(e) => {
                      void handleLogoFile(e.target.files?.[0])
                    }}
                  />
                </label>
              )}
              {logoDataUrl && (
                <input
                  ref={fileInputRef}
                  id="logo-file"
                  type="file"
                  accept={ACCEPTED_LOGO_TYPES.join(',')}
                  className="sr-only"
                  onChange={(e) => {
                    void handleLogoFile(e.target.files?.[0])
                  }}
                />
              )}
            </div>

            <Separator />

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="fg-color">Couleur du code</Label>
                <div className="flex items-center gap-2">
                  <input
                    id="fg-color"
                    type="color"
                    value={fgColor}
                    onChange={(e) => setFgColor(e.target.value)}
                    className="h-10 w-12 cursor-pointer rounded-md border border-input bg-transparent p-1"
                    aria-label="Couleur des modules du QR code"
                  />
                  <Input
                    value={fgColor}
                    onChange={(e) => {
                      const v = e.target.value.startsWith('#') ? e.target.value : `#${e.target.value}`
                      setFgColor(v)
                    }}
                    className="font-mono text-sm"
                    maxLength={7}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="bg-color">Couleur de fond</Label>
                <div className="flex items-center gap-2">
                  <input
                    id="bg-color"
                    type="color"
                    value={bgColor}
                    onChange={(e) => setBgColor(e.target.value)}
                    className="h-10 w-12 cursor-pointer rounded-md border border-input bg-transparent p-1"
                    aria-label="Couleur de fond du QR code"
                  />
                  <Input
                    value={bgColor}
                    onChange={(e) => {
                      const v = e.target.value.startsWith('#') ? e.target.value : `#${e.target.value}`
                      setBgColor(v)
                    }}
                    className="font-mono text-sm"
                    maxLength={7}
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="qr-size">Taille d’export</Label>
                <Badge variant="secondary" className="font-mono">
                  {size} px
                </Badge>
              </div>
              <Slider
                id="qr-size"
                min={256}
                max={1024}
                step={64}
                value={[size]}
                onValueChange={(v) => setSize(v[0])}
                aria-label="Taille d'export du QR code en pixels"
              />
              <p className="text-sm text-muted-foreground">
                Pour une impression nette, privilégiez 512 px ou plus.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="qr-level">Correction d’erreur</Label>
              <Select value={level} onValueChange={(v) => setLevel(v as QRCodeErrorCorrectionLevel)}>
                <SelectTrigger id="qr-level" className="w-full">
                  <SelectValue placeholder="Choisir un niveau" />
                </SelectTrigger>
                <SelectContent>
                  {ERROR_LEVELS.map((lvl) => (
                    <SelectItem key={lvl.value} value={lvl.value}>
                      <span className="font-medium">{lvl.label}</span>
                      <span className="ml-2 text-muted-foreground">{lvl.hint}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground">
                Plus la correction est élevée, plus le QR reste lisible s’il est abîmé ou masqué par un logo.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Colonne droite : aperçu + export */}
      <div className="flex flex-col gap-6">
        <Card className="lg:sticky lg:top-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <ScanLine className="h-5 w-5 text-amber-600" aria-hidden />
              Aperçu en direct
            </CardTitle>
            <CardDescription>
              Le QR code se met à jour automatiquement à chaque modification.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div
              className="flex min-h-[320px] items-center justify-center rounded-xl border-2 border-dashed p-6"
              style={{ backgroundColor: hasQr ? bgColor : undefined }}
            >
              {error ? (
                <p className="max-w-xs text-center text-sm text-muted-foreground">
                  Corrigez le lien ci-contre pour voir l’aperçu.
                </p>
              ) : hasQr ? (
                <img
                  src={dataUrl}
                  alt={`QR code pointant vers ${normalizedUrl}`}
                  className={`h-auto max-h-[320px] w-auto max-w-full rounded-lg shadow-sm transition-opacity duration-200 ${
                    busy ? 'opacity-60' : 'opacity-100'
                  }`}
                  width={size}
                  height={size}
                />
              ) : busy ? (
                <Skeleton className="h-64 w-64 rounded-lg" />
              ) : (
                <div className="flex flex-col items-center gap-3 text-center">
                  <QrCode className="h-16 w-16 text-muted-foreground/40" aria-hidden />
                  <p className="max-w-[220px] text-sm text-muted-foreground">
                    Saisissez le lien de votre menu pour générer le QR code.
                  </p>
                </div>
              )}
              {busy && hasQr && (
                <Loader2 className="absolute h-6 w-6 animate-spin text-amber-600" aria-hidden />
              )}
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-3">
            <div className="grid w-full grid-cols-1 gap-2 sm:grid-cols-2">
              <Button onClick={handleDownloadPng} disabled={!hasQr} className="bg-amber-600 text-white hover:bg-amber-700">
                <Download className="mr-2 h-4 w-4" aria-hidden />
                Télécharger PNG
              </Button>
              <Button onClick={handleDownloadSvg} disabled={!hasQr} variant="outline">
                <FileImage className="mr-2 h-4 w-4" aria-hidden />
                Télécharger SVG
              </Button>
              <Button onClick={handleCopy} disabled={!hasQr} variant="outline">
                <Copy className="mr-2 h-4 w-4" aria-hidden />
                Copier l’image
              </Button>
              <Button onClick={handleSave} disabled={!hasQr || saving} variant="secondary">
                {saving ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                ) : (
                  <Save className="mr-2 h-4 w-4" aria-hidden />
                )}
                Enregistrer
              </Button>
            </div>
            <p className="text-center text-sm text-muted-foreground">
              Astuce : imprimez le QR code en 2 × 2 cm minimum et testez un scan avant tirage.
            </p>
          </CardFooter>
        </Card>
      </div>
    </div>
  )
}
