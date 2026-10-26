'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  FileSpreadsheet,
  Loader2,
  ScanLine,
  TriangleAlert,
  Upload,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'
import { buildItems, readSheet, type ParsedRow, type SheetContent } from '@/lib/excel-import'

interface ImportExcelDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  categories: string[]
  currency: string
  onImport: (category: string, rows: ParsedRow[]) => void
}

const PREVIEW_LIMIT = 30

export function ImportExcelDialog({
  open,
  onOpenChange,
  categories,
  currency,
  onImport,
}: ImportExcelDialogProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [parsing, setParsing] = useState(false)
  const [error, setError] = useState('')
  const [fileName, setFileName] = useState('')
  const [sheet, setSheet] = useState<SheetContent | null>(null)
  const [ignoreFirst, setIgnoreFirst] = useState(false)

  // Destination : catégorie existante ou nouvelle
  const [target, setTarget] = useState<'existante' | 'nouvelle'>(
    categories.length > 0 ? 'existante' : 'nouvelle'
  )
  const [existingCategory, setExistingCategory] = useState(categories[0] ?? 'Plats')
  const [newCategory, setNewCategory] = useState('Plats')

  const result = useMemo(
    () => (sheet ? buildItems(sheet, ignoreFirst) : null),
    [sheet, ignoreFirst]
  )

  // À chaque ouverture : destination par défaut = première catégorie existante
  useEffect(() => {
    if (open) {
      setTarget(categories.length > 0 ? 'existante' : 'nouvelle')
      setExistingCategory(categories[0] ?? 'Plats')
      setError('')
    }
     
  }, [open])

  const reset = () => {
    setError('')
    setFileName('')
    setSheet(null)
    setIgnoreFirst(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleFile = async (file: File | undefined) => {
    if (!file) return
    setError('')
    setSheet(null)
    setIgnoreFirst(false)
    setParsing(true)
    try {
      const buffer = await file.arrayBuffer()
      const content = readSheet(buffer)
      if (!content.sheetName) {
        setError('Ce fichier ne contient aucun onglet lisible.')
        setFileName(file.name)
        return
      }
      if (content.rows.length === 0) {
        setError('L\'onglet « ' + content.sheetName + ' » est vide : aucune ligne à importer.')
        setFileName(file.name)
        return
      }
      setSheet(content)
      setIgnoreFirst(content.headerAuto)
      setFileName(file.name)
    } catch (e) {
      console.error('Import Excel — erreur de lecture :', e)
      setError(
        `Impossible de lire ce fichier (${e instanceof Error ? e.message : 'format inconnu'}). Essayez de l'enregistrer au format .xlsx ou .csv.`
      )
      setFileName(file.name)
    } finally {
      setParsing(false)
    }
  }

  const chosenCategory =
    target === 'existante' ? existingCategory : newCategory.trim().slice(0, 60) || 'Plats'

  const handleImport = () => {
    if (!result || result.rows.length === 0) return
    onImport(chosenCategory, result.rows)
    reset()
    onOpenChange(false)
  }

  const previewRows = result?.rows.slice(0, PREVIEW_LIMIT) ?? []
  const hiddenCount = result ? result.rows.length - previewRows.length : 0

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset()
        onOpenChange(next)
      }}
    >
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-emerald-700" aria-hidden />
            Importer depuis Excel
          </DialogTitle>
          <DialogDescription>
            Formats acceptés : .xlsx, .xls ou .csv — 1ʳᵉ colonne = nom de l'article, 2ᵉ =
            description, dernière = prix. Les en-têtes de colonnes sont repérés automatiquement.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Zone de choix du fichier */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
            className="sr-only"
            aria-label="Choisir un fichier Excel ou CSV"
            onChange={(e) => void handleFile(e.target.files?.[0])}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className={cn(
              'flex w-full flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed px-4 py-6 text-center transition-colors',
              sheet ? 'border-emerald-300 bg-emerald-50/60' : 'border-stone-300 hover:bg-stone-50'
            )}
          >
            {parsing ? (
              <Loader2 className="h-6 w-6 animate-spin text-stone-400" aria-hidden />
            ) : (
              <Upload className={cn('h-6 w-6', sheet ? 'text-emerald-600' : 'text-stone-400')} aria-hidden />
            )}
            {sheet ? (
              <span className="text-sm font-medium text-emerald-800">{fileName}</span>
            ) : (
              <>
                <span className="text-sm font-medium text-stone-700">
                  {parsing ? 'Lecture du fichier…' : 'Choisir un fichier Excel ou CSV'}
                </span>
                <span className="text-xs text-muted-foreground">
                  Cliquez pour parcourir vos fichiers
                </span>
              </>
            )}
          </button>
          {sheet && (
            <button
              type="button"
              onClick={reset}
              className="text-xs font-medium text-stone-500 underline-offset-2 hover:underline"
            >
              Changer de fichier
            </button>
          )}

          {error && (
            <p
              role="alert"
              className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700"
            >
              <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              {error}
            </p>
          )}

          {sheet && result && (
            <>
              {/* Résumé de la lecture */}
              <div className="flex flex-wrap gap-1.5" aria-live="polite">
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-800">
                  <ScanLine className="h-3 w-3" aria-hidden />
                  {result.rows.length} article{result.rows.length > 1 ? 's' : ''} détecté
                  {result.rows.length > 1 ? 's' : ''}
                </span>
                {ignoreFirst && (
                  <span className="rounded-full bg-stone-100 px-2.5 py-1 text-xs text-stone-600">
                    Ligne d'en-têtes ignorée
                  </span>
                )}
                {result.priceWarnings > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-800">
                    <TriangleAlert className="h-3 w-3" aria-hidden />
                    {result.priceWarnings} prix illisible{result.priceWarnings > 1 ? 's' : ''}
                  </span>
                )}
                {result.skipped > 0 && (
                  <span className="rounded-full bg-stone-100 px-2.5 py-1 text-xs text-stone-600">
                    {result.skipped} ligne{result.skipped > 1 ? 's' : ''} sans nom ignorée
                    {result.skipped > 1 ? 's' : ''}
                  </span>
                )}
              </div>

              {/* Interrupteur en-têtes */}
              <div className="flex items-center justify-between rounded-lg border border-stone-200 px-3 py-2.5">
                <Label htmlFor="ignore-first" className="cursor-pointer text-sm font-normal">
                  Ignorer la première ligne (en-têtes)
                </Label>
                <Switch id="ignore-first" checked={ignoreFirst} onCheckedChange={setIgnoreFirst} />
              </div>

              {/* Aperçu */}
              {result.rows.length > 0 && (
                <div className="overflow-hidden rounded-lg border border-stone-200">
                  <div className="max-h-56 overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 bg-stone-50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                        <tr>
                          <th className="px-3 py-2 font-medium">Nom</th>
                          <th className="px-3 py-2 font-medium">Description</th>
                          <th className="px-3 py-2 text-right font-medium">Prix</th>
                        </tr>
                      </thead>
                      <tbody>
                        {previewRows.map((row, i) => (
                          <tr key={i} className="border-t border-stone-100">
                            <td className="max-w-36 truncate px-3 py-1.5 font-medium text-stone-900">
                              {row.name}
                            </td>
                            <td className="max-w-44 truncate px-3 py-1.5 text-muted-foreground">
                              {row.description || <span className="text-stone-300">—</span>}
                            </td>
                            <td className="px-3 py-1.5 text-right tabular-nums text-stone-700">
                              {row.price !== null
                                ? `${row.price.toFixed(2).replace('.', ',')} ${currency}`
                                : <span className="text-stone-300">—</span>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {hiddenCount > 0 && (
                    <p className="border-t border-stone-100 bg-stone-50 px-3 py-1.5 text-center text-xs text-muted-foreground">
                      et {hiddenCount} autre{hiddenCount > 1 ? 's' : ''} article
                      {hiddenCount > 1 ? 's' : ''}…
                    </p>
                  )}
                </div>
              )}

              {/* Destination */}
              <div className="space-y-2">
                <Label>Ajouter dans quelle catégorie ?</Label>
                {categories.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {categories.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => {
                          setExistingCategory(c)
                          setTarget('existante')
                        }}
                        aria-pressed={target === 'existante' && existingCategory === c}
                        className={cn(
                          'rounded-full border px-3 py-1 text-sm transition-colors',
                          target === 'existante' && existingCategory === c
                            ? 'border-emerald-700 bg-emerald-100 font-medium text-emerald-900'
                            : 'border-stone-200 text-stone-600 hover:bg-stone-50'
                        )}
                      >
                        {c}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setTarget('nouvelle')}
                      aria-pressed={target === 'nouvelle'}
                      className={cn(
                        'rounded-full border px-3 py-1 text-sm transition-colors',
                        target === 'nouvelle'
                          ? 'border-emerald-700 bg-emerald-100 font-medium text-emerald-900'
                          : 'border-dashed border-stone-300 text-stone-600 hover:bg-stone-50'
                      )}
                    >
                      + Nouvelle catégorie
                    </button>
                  </div>
                )}
                {target === 'nouvelle' && (
                  <Input
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    placeholder="Nom de la nouvelle catégorie (ex. Desserts)"
                    maxLength={60}
                    aria-label="Nom de la nouvelle catégorie"
                  />
                )}
                {categories.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    Votre menu n'a pas encore de catégorie : les articles seront ajoutés dans «{' '}
                    {newCategory || 'Plats'} ».
                  </p>
                )}
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button
            onClick={handleImport}
            disabled={!result || result.rows.length === 0 || parsing}
            className="bg-emerald-700 text-white hover:bg-emerald-800"
          >
            <FileSpreadsheet className="mr-1.5 h-4 w-4" aria-hidden />
            {result && result.rows.length > 0
              ? `Importer ${result.rows.length} article${result.rows.length > 1 ? 's' : ''}`
              : 'Importer'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
