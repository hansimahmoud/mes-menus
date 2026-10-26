import * as XLSX from 'xlsx'

/**
 * Importation de feuilles Excel / CSV pour les menus.
 *
 * Format attendu (tel que décrit par le gérant) :
 *   1ʳᵉ colonne  → nom de l'article
 *   2ᵉ colonne   → description
 *   dernière colonne → prix
 *
 * La première ligne d'en-têtes est détectée automatiquement et peut être
 * ignorée manuellement dans le dialogue d'importation.
 */

export interface ParsedRow {
  name: string
  description: string
  price: number | null
}

export interface SheetContent {
  sheetName: string
  /** Lignes non vides, cellules nettoyées (l'en-tête éventuel est inclus). */
  rows: string[][]
  /** Vrai si la première ligne ressemble à des en-têtes de colonnes. */
  headerAuto: boolean
}

export interface BuildResult {
  rows: ParsedRow[]
  headerIgnored: boolean
  /** Lignes ignorées car sans nom d'article. */
  skipped: number
  /** Lignes où un prix était présent mais illisible. */
  priceWarnings: number
}

const HEADER_KEYWORDS = [
  'nom',
  'article',
  'plat',
  'produit',
  'description',
  'détail',
  'detail',
  'prix',
  'tarif',
  'montant',
  'price',
  'name',
]

/** Lit le premier onglet du classeur et renvoie les lignes brutes nettoyées. */
export function readSheet(buffer: ArrayBuffer): SheetContent {
  // raw: true — indispensable pour les CSV : sans cela, « 1,20 » serait
  // interprété comme le nombre 120 (virgule lue comme séparateur de milliers).
  const workbook = XLSX.read(new Uint8Array(buffer), { type: 'array', raw: true })
  const sheetName = workbook.SheetNames[0] ?? ''
  if (!sheetName) {
    return { sheetName: '', rows: [], headerAuto: false }
  }
  const raw = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[sheetName], {
    header: 1,
    blankrows: false,
    defval: '',
  })
  const rows = raw
    .map((row) => row.map((cell) => String(cell ?? '').trim()))
    .filter((row) => row.some((cell) => cell !== ''))
  return { sheetName, rows, headerAuto: looksLikeHeader(rows[0] ?? []) }
}

/** Vrai si la ligne ressemble à une ligne d'en-têtes (au moins 2 mots-clés). */
function looksLikeHeader(cells: string[]): boolean {
  if (cells.length === 0) return false
  const hits = cells.filter((cell) => {
    const value = cell.toLowerCase()
    return value !== '' && HEADER_KEYWORDS.some((keyword) => value.includes(keyword))
  }).length
  return hits >= 2
}

/**
 * Prix tolérant : accepte « 12,50 », « 12.5 », « 12,50 € », « € 12 », « 12 EUR »,
 * « 1 200,00 »… Renvoie warning=true si la valeur était présente mais illisible.
 */
export function parseFlexiblePrice(raw: unknown): { value: number | null; warning: boolean } {
  if (raw === null || raw === undefined) return { value: null, warning: false }
  if (typeof raw === 'number') {
    return Number.isFinite(raw) && raw >= 0
      ? { value: Math.round(raw * 100) / 100, warning: false }
      : { value: null, warning: true }
  }
  let text = String(raw).trim().toLowerCase()
  if (!text) return { value: null, warning: false }
  text = text
    .replace(/[\u00a0\u202f\s']/g, '') // espaces (y compris insécables)
    .replace(/(eur|euros?|€|\$|£|chf)/g, '')
    .replace(/[^0-9.,-]/g, '')
  if (!text) return { value: null, warning: true }

  const lastComma = text.lastIndexOf(',')
  const lastDot = text.lastIndexOf('.')
  if (lastComma > -1 && lastDot > -1) {
    // Les deux séparateurs présents : le dernier est la décimale
    if (lastComma > lastDot) text = text.replace(/\./g, '').replace(',', '.')
    else text = text.replace(/,/g, '')
  } else if (lastComma > -1) {
    // « 1,234 » ambigu : 3 chiffres après la virgule → séparateur de milliers
    const after = text.length - lastComma - 1
    text = after === 3 ? text.replace(/,/g, '') : text.replace(',', '.')
  }
  // Plusieurs points restants → tous milliers sauf le dernier
  const parts = text.split('.')
  if (parts.length > 2) text = parts.slice(0, -1).join('') + '.' + parts[parts.length - 1]

  const value = Number.parseFloat(text)
  if (!Number.isFinite(value) || value < 0) return { value: null, warning: true }
  return { value: Math.round(value * 100) / 100, warning: false }
}

/**
 * Transforme les lignes brutes en articles de menu.
 * `ignoreFirst` force l'ignorance (ou non) de la première ligne d'en-têtes.
 */
export function buildItems(sheet: SheetContent, ignoreFirst: boolean): BuildResult {
  const width = Math.max(0, ...sheet.rows.map((row) => row.length))
  let dataRows = sheet.rows
  let headerIgnored = false
  if (ignoreFirst && sheet.rows.length > 0) {
    dataRows = sheet.rows.slice(1)
    headerIgnored = true
  }

  const rows: ParsedRow[] = []
  let skipped = 0
  let priceWarnings = 0

  for (const cells of dataRows) {
    const name = (cells[0] ?? '').trim()
    if (!name) {
      skipped += 1
      continue
    }

    let description = ''
    let price: number | null = null

    if (width >= 3) {
      // Nom / Description / … / Prix (dernière colonne non vide à partir de la 3ᵉ)
      description = (cells[1] ?? '').trim()
      let lastIdx = -1
      for (let i = 2; i < cells.length; i += 1) {
        if ((cells[i] ?? '').trim() !== '') lastIdx = i
      }
      if (lastIdx >= 2) {
        const parsed = parseFlexiblePrice(cells[lastIdx])
        price = parsed.value
        if (parsed.warning) priceWarnings += 1
      }
    } else if (width === 2) {
      // Nom / Prix (pas de description)
      const parsed = parseFlexiblePrice(cells[1] ?? '')
      price = parsed.value
      if (parsed.warning) priceWarnings += 1
    }
    // width <= 1 : nom seul, ni description ni prix

    rows.push({ name, description, price })
  }

  return { rows, headerIgnored, skipped, priceWarnings }
}
