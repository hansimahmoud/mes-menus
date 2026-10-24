import type { Metadata } from 'next'
import Link from 'next/link'
import { db } from '@/lib/db'
import { UtensilsCrossed, ScanLine, Clock, TriangleAlert } from 'lucide-react'

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

/** Assombrit (facteur < 1) une couleur hex #rrggbb, avec repli sûr. */
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
          className="text-sm font-bold uppercase tracking-[0.2em]"
          style={{ color: accent }}
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
              <h3 className="font-semibold text-stone-900">{item.name}</h3>
              {item.price !== null && (
                <>
                  <span
                    aria-hidden
                    className="mx-1 flex-1 border-b border-dotted border-stone-300"
                  />
                  <span className="shrink-0 font-bold tabular-nums" style={{ color: accent }}>
                    {formatPrice(item.price, currency)}
                  </span>
                </>
              )}
            </div>
            {item.description && (
              <p className="mt-1 pr-8 text-sm italic leading-relaxed text-stone-500">
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
  const isDraftPreview = !menu.published

  // Répartit les catégories sur les deux volets intérieurs du dépliant
  const midCount = Math.ceil(sections.length / 2)
  const voletMilieu = sections.slice(0, midCount)
  const voletDroit = sections.slice(midCount)

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

      <div className="relative mx-auto w-full max-w-lg px-4 pb-14 pt-7 sm:px-6 sm:pt-10 md:max-w-4xl">
        {isDraftPreview && (
          <p className="mb-4 flex items-center justify-center gap-2 rounded-2xl border border-amber-300 bg-amber-100 px-4 py-2.5 text-center text-xs font-semibold text-amber-800">
            <TriangleAlert className="h-4 w-4 shrink-0" aria-hidden />
            Aperçu du brouillon — lien secret, ce menu n'est pas encore publié
          </p>
        )}

        {/* Le dépliant ouvert : couverture + deux volets intérieurs */}
        <article className="animate-fade-up overflow-hidden rounded-[2rem] bg-[#fffdf8] shadow-xl shadow-stone-900/10 ring-1 ring-stone-900/5 md:grid md:grid-cols-3">
          {/* Volet 1 — la couverture, en couleur, sur toute la hauteur */}
          <header
            className="relative flex flex-col overflow-hidden px-6 pb-8 pt-10 text-center text-white sm:px-10"
            style={{ background: `linear-gradient(160deg, ${accent}, ${shade(accent, 0.7)})` }}
          >
            <div aria-hidden className="absolute -right-12 -top-12 h-36 w-36 rounded-full bg-white/10" />
            <div aria-hidden className="absolute -left-14 top-1/2 h-28 w-28 rounded-full bg-white/10" />
            <div aria-hidden className="absolute bottom-24 right-9 h-3 w-3 rounded-full bg-white/25" />
            <div aria-hidden className="absolute top-16 left-8 h-2 w-2 rounded-full bg-white/25" />

            <div className="animate-float-soft mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-sm">
              <UtensilsCrossed className="h-7 w-7" aria-hidden />
            </div>
            <h1 className="mt-4 text-3xl font-extrabold tracking-tight drop-shadow-sm sm:text-4xl">
              {menu.name}
            </h1>
            <span className="mx-auto mt-4 inline-flex w-fit items-center rounded-full bg-white/20 px-4 py-1.5 text-[11px] font-bold uppercase tracking-[0.18em] backdrop-blur-sm">
              Notre carte
            </span>

            <div className="mt-auto pt-10">
              <Ornament color="rgb(255 255 255 / 0.55)" />
              <p className="mt-3 font-serif text-lg italic text-white/90">Bon appétit !</p>
            </div>
          </header>

          {/* Volet 2 — premières catégories, volet central légèrement plus clair */}
          <div className="relative flex flex-col border-t border-stone-900/5 px-6 py-8 sm:px-7 md:border-x md:border-t-0 md:bg-white/50 pli-droite pli-gauche">
            <div className="space-y-8">
              {voletMilieu.length === 0 ? (
                <p className="py-6 text-center text-sm italic text-stone-500">
                  Ce menu est en cours de préparation. Revenez très bientôt !
                </p>
              ) : (
                voletMilieu.map((section) => (
                  <MenuSection
                    key={section.category}
                    section={section}
                    accent={accent}
                    currency={menu.currency}
                  />
                ))
              )}
            </div>
          </div>

          {/* Volet 3 — catégories suivantes, note et fraîcheur du menu */}
          <div className="relative flex flex-col border-t border-stone-900/5 px-6 py-8 sm:px-7 md:border-t-0 pli-gauche">
            <div className="space-y-8">
              {voletDroit.map((section) => (
                <MenuSection
                  key={section.category}
                  section={section}
                  accent={accent}
                  currency={menu.currency}
                />
              ))}
            </div>

            {menu.footerNote && (
              <div className="mt-9 text-center">
                <Ornament color={`${accent}99`} />
                <p className="mt-3 text-xs italic leading-relaxed text-stone-500">
                  {menu.footerNote}
                </p>
              </div>
            )}

            <div className="mt-auto pt-8">
              <p className="flex items-center justify-center gap-2 text-center text-xs font-medium text-stone-400">
                <span className="relative flex h-2.5 w-2.5 shrink-0" aria-hidden>
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
                </span>
                Menu toujours à jour — {dateFormatter.format(menu.updatedAt)}
              </p>
            </div>
          </div>
        </article>

        <p className="mx-auto mt-5 flex max-w-lg items-center justify-center gap-1.5 text-xs text-stone-400">
          <Clock className="h-3.5 w-3.5" aria-hidden />
          Ce menu en ligne est la version la plus récente du restaurant
        </p>
      </div>
    </main>
  )
}
