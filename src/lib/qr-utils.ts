import QRCode from 'qrcode'
import type { QRCodeErrorCorrectionLevel } from 'qrcode'

/** Paramètres de génération d'un QR code */
export interface QrSettings {
  url: string
  fgColor: string
  bgColor: string
  size: number
  level: QRCodeErrorCorrectionLevel
}

/** Élément de l'historique (correspond au modèle Prisma QrCode) */
export interface QrHistoryItem {
  id: string
  title: string
  url: string
  fgColor: string
  bgColor: string
  size: number
  logo: string | null
  logoSize: number | null
  createdAt: string
}

/** Palette de styles prêts à l'emploi (ambiance restauration) */
export const PRESETS: { name: string; fg: string; bg: string }[] = [
  { name: 'Classique', fg: '#1c1917', bg: '#ffffff' },
  { name: 'Bordeaux', fg: '#7f1d1d', bg: '#fef2f2' },
  { name: 'Olive', fg: '#3f6212', bg: '#f7fee7' },
  { name: 'Café', fg: '#432818', bg: '#f5ebe0' },
  { name: 'Terracotta', fg: '#9a3412', bg: '#fff7ed' },
  { name: 'Nuit dorée', fg: '#f59e0b', bg: '#1c1917' },
]

export const ERROR_LEVELS: {
  value: QRCodeErrorCorrectionLevel
  label: string
  hint: string
}[] = [
  { value: 'L', label: 'Faible (7 %)', hint: 'Pour un affichage protégé' },
  { value: 'M', label: 'Moyenne (15 %)', hint: 'Recommandé sans logo' },
  { value: 'Q', label: 'Quartile (25 %)', hint: 'Pour affiches et vitrines' },
  { value: 'H', label: 'Haute (30 %)', hint: 'Recommandé avec un logo' },
]

/** Types de fichiers logo acceptés */
export const ACCEPTED_LOGO_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']

/** Taille maximale d'un fichier logo (2 Mo) */
export const MAX_LOGO_BYTES = 2 * 1024 * 1024

/** Limite de caractères pour stocker un logo en base */
export const MAX_LOGO_DATA_LENGTH = 3_000_000

/**
 * Normalise et valide un lien saisi.
 * Ajoute « https:// » si absent et vérifie que l'URL est exploitable.
 */
export function normalizeUrl(raw: string): string | null {
  let value = raw.trim()
  if (!value) return null
  if (!/^https?:\/\//i.test(value)) value = `https://${value}`
  try {
    const parsed = new URL(value)
    if (!parsed.hostname.includes('.') && parsed.hostname !== 'localhost') {
      return null
    }
    return parsed.toString()
  } catch {
    return null
  }
}

/** Transforme un titre en nom de fichier sûr (sans accents ni espaces). */
export function slugify(title: string): string {
  const slug = title
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
  return slug || 'qrcode-menu'
}

/** Formate une date ISO en français (ex. « 22 oct. 2026, 14:30 »). */
export function formatDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat('fr-FR', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(iso))
  } catch {
    return iso
  }
}

/** Déclenche le téléchargement d'une data URL PNG. */
export function downloadPng(dataUrl: string, filename: string): void {
  const link = document.createElement('a')
  link.href = dataUrl
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
}

/** Déclenche le téléchargement d'une chaîne SVG. */
export function downloadSvg(svgString: string, filename: string): void {
  const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** Charge une image depuis une data URL. */
export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error("Échec du chargement de l'image"))
    img.src = src
  })
}

/**
 * Prépare un fichier logo : validation (type, taille), décodage puis
 * réduction à 512 px maximum sur le bord le plus long (PNG avec transparence).
 */
export async function prepareLogoFile(file: File): Promise<string> {
  if (!ACCEPTED_LOGO_TYPES.includes(file.type)) {
    throw new Error('Format non supporté — utilisez PNG, JPG, WebP ou SVG.')
  }
  if (file.size > MAX_LOGO_BYTES) {
    throw new Error('Fichier trop volumineux — 2 Mo maximum.')
  }
  const rawDataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(new Error('Lecture du fichier impossible.'))
    reader.readAsDataURL(file)
  })
  const img = await loadImage(rawDataUrl)
  const srcW = img.naturalWidth || 512
  const srcH = img.naturalHeight || 512
  const maxEdge = Math.max(srcW, srcH)
  // Petit logo déjà léger : on le garde tel quel
  if (maxEdge <= 512 && rawDataUrl.length < 200_000) return rawDataUrl
  const scale = Math.min(1, 512 / maxEdge)
  const w = Math.max(1, Math.round(srcW * scale))
  const h = Math.max(1, Math.round(srcH * scale))
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) return rawDataUrl
  ctx.drawImage(img, 0, 0, w, h)
  return canvas.toDataURL('image/png')
}

/** Dessine le logo centré sur le canvas du QR code. */
function drawLogoOnCanvas(
  canvas: HTMLCanvasElement,
  logo: HTMLImageElement,
  sizePct: number,
  padding: boolean,
  bgColor: string,
): void {
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const qr = canvas.width
  const logoW0 = logo.naturalWidth || 1
  const logoH0 = logo.naturalHeight || 1
  const aspect = logoW0 / logoH0
  const target = (qr * sizePct) / 100
  // Le bord le plus long du logo correspond au pourcentage choisi
  const logoW = aspect >= 1 ? target : target * aspect
  const logoH = aspect >= 1 ? target / aspect : target
  const x = (qr - logoW) / 2
  const y = (qr - logoH) / 2

  if (padding) {
    const pad = qr * 0.018
    ctx.fillStyle = bgColor
    const bx = x - pad
    const by = y - pad
    const bw = logoW + pad * 2
    const bh = logoH + pad * 2
    if (typeof ctx.roundRect === 'function') {
      ctx.beginPath()
      ctx.roundRect(bx, by, bw, bh, pad)
      ctx.fill()
    } else {
      ctx.fillRect(bx, by, bw, bh)
    }
  }
  ctx.drawImage(logo, x, y, logoW, logoH)
}

export interface RenderQrOptions {
  url: string
  size: number
  margin?: number
  level: QRCodeErrorCorrectionLevel
  fgColor: string
  bgColor: string
  logoImg?: HTMLImageElement | null
  logoSizePct?: number
  logoPadding?: boolean
}

/**
 * Génère le QR code en PNG (data URL) sur canvas,
 * avec logo centré si une image est fournie.
 */
export async function renderQrDataUrl(opts: RenderQrOptions): Promise<string> {
  const canvas = document.createElement('canvas')
  await QRCode.toCanvas(canvas, opts.url, {
    width: opts.size,
    margin: opts.margin ?? 2,
    errorCorrectionLevel: opts.level,
    color: { dark: opts.fgColor, light: opts.bgColor },
  })
  if (opts.logoImg && opts.logoImg.naturalWidth > 0) {
    drawLogoOnCanvas(
      canvas,
      opts.logoImg,
      opts.logoSizePct ?? 22,
      opts.logoPadding ?? true,
      opts.bgColor,
    )
  }
  return canvas.toDataURL('image/png')
}

/**
 * Insère le logo (data URL) au centre d'un SVG de QR code généré
 * par la bibliothèque qrcode, en respectant le viewBox.
 */
export function buildSvgWithLogo(
  svgString: string,
  logoDataUrl: string,
  logoAspect: number,
  sizePct: number,
  bgColor: string,
  padding: boolean,
): string {
  const match = svgString.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/)
  if (!match) return svgString
  const vb = parseFloat(match[1])
  const safeAspect = logoAspect > 0 ? logoAspect : 1
  const target = (vb * sizePct) / 100
  const w = safeAspect >= 1 ? target : target * safeAspect
  const h = safeAspect >= 1 ? target / safeAspect : target
  const x = (vb - w) / 2
  const y = (vb - h) / 2

  let rectTag = ''
  if (padding) {
    const pad = vb * 0.018
    rectTag =
      `<rect x="${(x - pad).toFixed(2)}" y="${(y - pad).toFixed(2)}" ` +
      `width="${(w + pad * 2).toFixed(2)}" height="${(h + pad * 2).toFixed(2)}" ` +
      `rx="${pad.toFixed(2)}" fill="${bgColor}"/>`
  }
  const imgTag =
    `<image x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${w.toFixed(2)}" ` +
    `height="${h.toFixed(2)}" preserveAspectRatio="xMidYMid meet" ` +
    `xlink:href="${logoDataUrl}" href="${logoDataUrl}"/>`

  let out = svgString
  if (!out.includes('xmlns:xlink')) {
    out = out.replace('<svg ', '<svg xmlns:xlink="http://www.w3.org/1999/xlink" ')
  }
  return out.replace('</svg>', `${rectTag}${imgTag}</svg>`)
}
