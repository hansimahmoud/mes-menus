import type { Metadata } from 'next'
import type { CSSProperties } from 'react'
import Link from 'next/link'
import { db } from '@/lib/db'
import { UtensilsCrossed, ScanLine, Sparkles, TriangleAlert } from 'lucide-react'

export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ preview?: string }>
}

interface PublicItem {
  id: string
  category: string
  name: string
  description: string | null
  price: number | null
}

interface PublicSection {
  category: string
  items: PublicItem[]
}

async function getMenu(slug: string) {
  if (!db) return null
  try {
    return await db.menu.findUnique({
      where: { slug },
      include: { items: { orderBy: { sortOrder: 'asc' } } },
    })
  } catch (error) {
    console.error('Menu public — erreur de lecture :', error)
    return null
  }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params
  const menu = await getMenu(slug)
  if (!menu || !menu.published) {
    return { title: 'Menu indisponible' }
  }
  return {
    title: `${menu.name} — Menu`,
    description: `Découvrez le menu « ${menu.name} » : plats, prix et suggestions.`,
  }
}

function formatPrice(price: number, currency: string): string {
  return `${price.toFixed(2).replace('.', ',')} ${currency}`
}

/** Assombrit (facteur < 1) ou éclaircit (facteur > 1) une couleur hex #rrggbb, avec repli sûr. */
function shade(hex: string, factor: number): string {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  if (!match) return hex
  const value = Number.parseInt(match[1], 16)
  const r = Math.min(255, Math.max(0, Math.round(((value >> 16) & 255) * factor)))
  const g = Math.min(255, Math.max(0, Math.round(((value >> 8) & 255) * factor)))
  const b = Math.min(255, Math.max(0, Math.round((value & 255) * factor)))
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`
}

const dateFormatter = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})

// Styles d'écriture disponibles pour la page publique (choisis dans l'éditeur).
// Les variables --font-* sont définies dans src/app/layout.tsx (next/font).
const FONT_STYLES: Record<
  string,
  {
    titres: string
    texte: string
    majuscules: 'uppercase' | 'none'
    espacement: string
    echelleCategorie: number
  }
> = {
  classique: {
    titres: 'var(--font-playfair)',
    texte: 'var(--font-lora)',
    majuscules: 'uppercase',
    espacement: '0.2em',
    echelleCategorie: 1,
  },
  moderne: {
    titres: 'var(--font-geist-sans)',
    texte: 'var(--font-geist-sans)',
    majuscules: 'uppercase',
    espacement: '0.2em',
    echelleCategorie: 1,
  },
  bistrot: {
    titres: 'var(--font-cormorant)',
    texte: 'var(--font-lora)',
    majuscules: 'uppercase',
    espacement: '0.16em',
    echelleCategorie: 1.15,
  },
  manuscrit: {
    titres: 'var(--font-dancing)',
    texte: 'var(--font-lora)',
    majuscules: 'none',
    espacement: '0.02em',
    echelleCategorie: 1.4,
  },
}

// Échelles de taille du texte (Compacte / Normale / Généreuse).
const FONT_SIZES: Record<
  string,
  { nom: string; categorie: string; item: string; description: string; prix: string }
> = {
  compact: {
    nom: '1.4rem',
    categorie: '0.7rem',
    item: '0.88rem',
    description: '0.75rem',
    prix: '0.88rem',
  },
  normal: {
    nom: '1.75rem',
    categorie: '0.8rem',
    item: '1rem',
    description: '0.85rem',
    prix: '1rem',
  },
  grand: {
    nom: '2.15rem',
    categorie: '0.92rem',
    item: '1.12rem',
    description: '0.95rem',
    prix: '1.12rem',
  },
}

// Séparateur décoratif « carte imprimée » : filet — losange — filet
function Ornament({ color }: { color: string }) {
  return (
    <div aria-hidden className="flex items-center justify-center gap-2.5">
      <span
        className="h-px w-10 rounded-full"
        style={{ background: `linear-gradient(to left, ${color}, transparent)` }}
      />
      <span className="h-1.5 w-1.5 rotate-45 rounded-[2px]" style={{ backgroundColor: color }} />
      <span
        className="h-px w-10 rounded-full"
        style={{ background: `linear-gradient(to right, ${color}, transparent)` }}
      />
    </div>
  )
}

// Une catégorie avec ses plats, façon carte imprimée (pointillés vers le prix)
function MenuSection({
  section,
  accent,
  currency,
}: {
  section: PublicSection
  accent: string
  currency: string
}) {
  return (
    <section aria-label={section.category}>
      <div className="mb-5 flex items-center justify-center gap-2.5">
        <span
          aria-hidden
          className="h-px w-8 rounded-full"
          style={{ background: `linear-gradient(to left, ${accent}, transparent)` }}
        />
        <span
          aria-hidden
          className="h-1.5 w-1.5 rotate-45 rounded-[2px]"
          style={{ backgroundColor: accent }}
        />
        <h2
          className="font-bold"
          style={{
            color: accent,
            fontFamily: 'var(--menu-titres)',
            fontSize: 'calc(var(--taille-categorie) * var(--menu-echelle-categorie))',
            textTransform: 'var(--menu-majuscules)',
            letterSpacing: 'var(--menu-espacement)',
          }}
        >
          {section.category}
        </h2>
        <span
          aria-hidden
          className="h-1.5 w-1.5 rotate-45 rounded-[2px]"
          style={{ backgroundColor: accent }}
        />
        <span
          aria-hidden
          className="h-px w-8 rounded-full"
          style={{ background: `linear-gradient(to right, ${accent}, transparent)` }}
        />
      </div>
      <ul className="space-y-4">
        {section.items.map((item) => (
          <li key={item.id}>
            <div className="flex items-baseline gap-1.5">
              <h3
                className="font-semibold text-stone-900"
                style={{ fontSize: 'var(--taille-item)' }}
              >
                {item.name}
              </h3>
              {item.price !== null && (
                <>
                  <span
                    aria-hidden
                    className="mx-1 flex-1 border-b border-dotted border-stone-300"
                  />
                  <span
                    className="shrink-0 font-bold tabular-nums"
                    style={{ color: accent, fontSize: 'var(--taille-prix)' }}
                  >
                    {formatPrice(item.price, currency)}
                  </span>
                </>
              )}
            </div>
            {item.description && (
              <p
                className="mt-1 pr-8 italic leading-relaxed text-stone-500"
                style={{ fontSize: 'var(--taille-description)' }}
              >
                {item.description}
              </p>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}

// Écran chaleureux quand le menu n'existe pas ou n'est pas publié
function Unavailable() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[#fdf9f2] px-4 py-16">
      <div className="w-full max-w-sm rounded-3xl border border-orange-100 bg-white p-8 text-center shadow-xl shadow-orange-900/5">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-100">
          <ScanLine className="h-7 w-7 text-orange-500" aria-hidden />
        </div>
        <h1 className="mt-4 text-xl font-bold tracking-tight">Menu indisponible</h1>
        <p className="mt-2 text-sm leading-relaxed text-stone-500">
          Ce menu n'existe pas, a été retiré ou n'est pas encore publié. Rapprochez-vous du
          restaurant ou réessayez plus tard.
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex items-center gap-2 rounded-full bg-orange-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-orange-500 hover:shadow-md"
        >
          <UtensilsCrossed className="h-4 w-4" aria-hidden />
          Créer votre propre menu
        </Link>
      </div>
      <p className="mt-6 text-xs text-stone-400">Générateur de menus et QR codes</p>
    </main>
  )
}

export default async function PublicMenuPage({ params, searchParams }: PageProps) {
  const { slug } = await params
  const { preview } = await searchParams
  const menu = await getMenu(slug)

  if (!menu) return <Unavailable />
  // Un menu non publié n'est visible qu'en aperçu (lien secret ?preview=<id>)
  if (!menu.published && preview !== menu.id) return <Unavailable />

  // Regroupe les articles par catégorie en conservant l'ordre défini dans l'éditeur
  const sections: PublicSection[] = []
  const index = new Map<string, number>()
  for (const item of menu.items) {
    const existing = index.get(item.category)
    if (existing === undefined) {
      index.set(item.category, sections.length)
      sections.push({ category: item.category, items: [item] })
    } else {
      sections[existing].items.push(item)
    }
  }

  const accent = menu.accentColor || '#ea580c'
  const styleEcriture = FONT_STYLES[menu.fontStyle] ?? FONT_STYLES.classique
  const tailleTexte = FONT_SIZES[menu.fontSize] ?? FONT_SIZES.normal
  const isDraftPreview = !menu.published

  return (
    <main className="relative min-h-screen bg-[#fdf9f2]">
      {/* Taches de couleur floues : l'ambiance vivante, sans gêner la lecture */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className="absolute -left-28 -top-28 h-80 w-80 rounded-full opacity-[0.13] blur-2xl"
          style={{ backgroundColor: accent }}
        />
        <div
          className="animate-float-soft absolute -right-24 top-1/4 h-64 w-64 rounded-full opacity-10 blur-2xl"
          style={{ backgroundColor: accent }}
        />
        <div
          className="absolute -left-20 bottom-16 h-56 w-56 rounded-full opacity-[0.07] blur-2xl"
          style={{ backgroundColor: accent }}
        />
      </div>

      <div className="relative mx-auto w-full max-w-xl px-4 pb-14 pt-7 sm:max-w-2xl sm:px-6 sm:pt-10">
        {isDraftPreview && (
          <p className="mb-4 flex items-center justify-center gap-2 rounded-2xl border border-amber-300 bg-amber-100 px-4 py-2.5 text-center text-xs font-semibold text-amber-800">
            <TriangleAlert className="h-4 w-4 shrink-0" aria-hidden />
            Aperçu du brouillon — lien secret, ce menu n'est pas encore publié
          </p>
        )}

        {/* La feuille de menu : une seule page posée sur la table,
            en-tête réduite et éclatante, corps aéré façon carte imprimée. */}
        <article
          className="animate-fade-up overflow-hidden rounded-[1.75rem] bg-[#fffdf8] shadow-[0_24px_70px_-24px_rgba(68,50,30,0.28)] ring-1 ring-stone-900/5"
          style={{
            fontFamily: styleEcriture.texte,
            '--menu-titres': styleEcriture.titres,
            '--menu-majuscules': styleEcriture.majuscules,
            '--menu-espacement': styleEcriture.espacement,
            '--menu-echelle-categorie': String(styleEcriture.echelleCategorie),
            '--taille-nom': tailleTexte.nom,
            '--taille-categorie': tailleTexte.categorie,
            '--taille-item': tailleTexte.item,
            '--taille-description': tailleTexte.description,
            '--taille-prix': tailleTexte.prix,
          } as CSSProperties}
        >
          {/* En-tête réduite, en dégradé éclatant avec balayage de lumière */}
          <header
            className="relative overflow-hidden px-6 pb-7 pt-7 text-center text-white sm:px-10 sm:pb-8 sm:pt-9"
            style={{
              background: `linear-gradient(150deg, ${shade(accent, 1.12)}, ${accent} 55%, ${shade(accent, 0.66)})`,
            }}
          >
            {/* Reflet lumineux en haut à gauche + bulles délicates */}
            <div
              aria-hidden
              className="absolute inset-0"
              style={{
                background:
                  'radial-gradient(circle at 26% 8%, rgb(255 255 255 / 0.3), transparent 52%)',
              }}
            />
            <div aria-hidden className="absolute -right-10 -top-14 h-32 w-32 rounded-full bg-white/10" />
            <div aria-hidden className="absolute -left-12 bottom-0 h-24 w-24 rounded-full bg-white/10" />
            {/* Balayage brillant (animation discrète, coupée si mouvement réduit) */}
            <span aria-hidden className="sheet-shine" />

            <div className="relative">
              <div className="animate-float-soft mx-auto flex h-11 w-11 items-center justify-center rounded-2xl bg-white/20 shadow-inner ring-1 ring-white/40">
                <UtensilsCrossed className="h-5 w-5" aria-hidden />
              </div>
              <h1
                className="mt-3.5 font-extrabold leading-tight tracking-tight"
                style={{
                  fontFamily: 'var(--menu-titres)',
                  fontSize: 'calc(var(--taille-nom) * 0.88)',
                  textShadow: '0 1px 12px rgb(0 0 0 / 0.16)',
                }}
              >
                {menu.name}
              </h1>
              <span className="mt-3.5 inline-flex w-fit items-center gap-1.5 rounded-full bg-white/15 px-3.5 py-1 text-[10px] font-bold uppercase tracking-[0.22em] ring-1 ring-white/30 backdrop-blur-sm">
                <Sparkles className="h-3 w-3" aria-hidden />
                Notre carte
              </span>
            </div>

            {/* Filet doré éclatant entre l'en-tête et le corps de la feuille */}
            <div
              aria-hidden
              className="absolute inset-x-0 bottom-0 h-[3px]"
              style={{
                background:
                  'linear-gradient(90deg, transparent, rgb(251 191 36 / 0.85) 26%, rgb(255 255 255 / 0.95) 50%, rgb(251 191 36 / 0.85) 74%, transparent)',
              }}
            />
          </header>

          {/* Corps de la feuille : cadre intérieur délicat + toutes les catégories */}
          <div className="relative px-6 py-9 sm:px-10 sm:py-11">
            <div
              aria-hidden
              className="pointer-events-none absolute inset-2.5 rounded-[1.15rem] border"
              style={{ borderColor: `${accent}2e` }}
            />
            <div className="relative space-y-9">
              {sections.length === 0 ? (
                <p className="py-6 text-center text-sm italic text-stone-500">
                  Ce menu est en cours de préparation. Revenez très bientôt !
                </p>
              ) : (
                sections.map((section) => (
                  <MenuSection
                    key={section.category}
                    section={section}
                    accent={accent}
                    currency={menu.currency}
                  />
                ))
              )}
            </div>

            <div className="relative mt-11 text-center">
              <Ornament color={`${accent}99`} />
              <p
                className="mt-3.5 text-lg italic"
                style={{ fontFamily: 'var(--menu-titres)', color: shade(accent, 0.82) }}
              >
                Bon appétit !
              </p>
              {menu.footerNote && (
                <p className="mx-auto mt-3.5 max-w-sm text-xs italic leading-relaxed text-stone-500">
                  {menu.footerNote}
                </p>
              )}
            </div>
          </div>
        </article>

        <p className="mt-5 flex items-center justify-center gap-2 text-xs font-medium text-stone-400">
          <span className="relative flex h-2.5 w-2.5 shrink-0" aria-hidden>
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
          </span>
          Menu toujours à jour — {dateFormatter.format(menu.updatedAt)}
        </p>
      </div>
    </main>
  )
}
