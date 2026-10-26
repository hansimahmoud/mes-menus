/**
 * Test de la bibliothèque d'importation Excel des menus.
 * Génère de vrais fichiers .xlsx/.csv puis vérifie readSheet/buildItems/parseFlexiblePrice.
 * Exécution : bun scripts/test-excel-import.ts
 */
import * as XLSX from 'xlsx'
import { readSheet, buildItems, parseFlexiblePrice } from '../src/lib/excel-import'

let failures = 0
function check(label: string, condition: boolean, detail = '') {
  if (condition) {
    console.log(`  OK  ${label}`)
  } else {
    failures += 1
    console.error(`  ÉCHEC  ${label} ${detail}`)
  }
}

/* ---------- 1. parseFlexiblePrice ---------- */
console.log('parseFlexiblePrice :')
const priceCases: [unknown, number | null, boolean][] = [
  ['12,50 €', 12.5, false],
  ['12.5', 12.5, false],
  ['€ 12', 12, false],
  ['12 EUR', 12, false],
  ['1 200,00', 1200, false],
  ['1\u00a0200,00', 1200, false], // espace insécable
  ['1.234,56', 1234.56, false],
  ['1,234', 1234, false], // 3 chiffres après la virgule → milliers
  ['8,5', 8.5, false],
  [8.5, 8.5, false],
  ['', null, false],
  [null, null, false],
  ['abc', null, true],
  ['-3', null, true],
  ['2,5€', 2.5, false],
]
for (const [input, expected, warning] of priceCases) {
  const { value, warning: w } = parseFlexiblePrice(input)
  check(
    `${JSON.stringify(input)} → ${expected}`,
    value === expected && w === warning,
    `(reçu ${value}, warning ${w})`
  )
}

/* ---------- 2. Fichier avec en-têtes ---------- */
const wb1 = XLSX.utils.book_new()
XLSX.utils.book_append_sheet(
  wb1,
  XLSX.utils.aoa_to_sheet([
    ["Nom de l'article", 'Description', 'Prix (€)'],
    ['Poulet rôti', 'Purée maison, jus de volaille', '12,50 €'],
    ['Salade César', 'Laitue, parmesan, croûtons', 9.5],
    ['Tiramisu', '', '6,00'],
    ['Café gourmand', 'Desserts du jour', ''],
  ]),
  'Carte'
)
XLSX.writeFile(wb1, '/tmp/test-avec-entetes.xlsx')

const s1 = readSheet(await Bun.file('/tmp/test-avec-entetes.xlsx').arrayBuffer())
console.log('\nFichier avec en-têtes :')
check('onglet lu = Carte', s1.sheetName === 'Carte')
check('en-têtes détectées', s1.headerAuto === true)
check('5 lignes non vides (en-tête incluse)', s1.rows.length === 5, `(reçu ${s1.rows.length})`)
const b1 = buildItems(s1, s1.headerAuto)
check('4 articles', b1.rows.length === 4, `(reçu ${b1.rows.length})`)
check('b1[0] nom', b1.rows[0]?.name === 'Poulet rôti')
check('b1[0] description', b1.rows[0]?.description === 'Purée maison, jus de volaille')
check('b1[0] prix 12,5', b1.rows[0]?.price === 12.5, `(reçu ${b1.rows[0]?.price})`)
check('b1[1] prix nombre 9,5', b1.rows[1]?.price === 9.5)
check('b1[2] description vide', b1.rows[2]?.description === '')
check('b1[2] prix 6', b1.rows[2]?.price === 6)
check('b1[3] prix absent sans warning', b1.rows[3]?.price === null && b1.priceWarnings === 0)
check('rien de ignoré', b1.skipped === 0)

/* ---------- 3. Fichier sans en-têtes ---------- */
const wb2 = XLSX.utils.book_new()
XLSX.utils.book_append_sheet(
  wb2,
  XLSX.utils.aoa_to_sheet([
    ['Entrecôte', 'Frites fraîches, sauce au poivre', '22,90'],
    ['Moules-frites', 'Marinière', '16'],
    ['Baba au rhum', 'Chantilly maison', '7,50 €'],
  ]),
  'Feuil1'
)
XLSX.writeFile(wb2, '/tmp/test-sans-entetes.xlsx')

const s2 = readSheet(await Bun.file('/tmp/test-sans-entetes.xlsx').arrayBuffer())
console.log('\nFichier sans en-têtes :')
check('pas de détection en-têtes', s2.headerAuto === false)
const b2 = buildItems(s2, false)
check('3 articles', b2.rows.length === 3, `(reçu ${b2.rows.length})`)
check('b2[0] nom Entrecôte', b2.rows[0]?.name === 'Entrecôte')
check('b2[0] prix 22,9', b2.rows[0]?.price === 22.9, `(reçu ${b2.rows[0]?.price})`)
check('b2[1] prix 16', b2.rows[1]?.price === 16)

/* ---------- 4. Fichier à 2 colonnes (nom / prix) ---------- */
const wb3 = XLSX.utils.book_new()
XLSX.utils.book_append_sheet(
  wb3,
  XLSX.utils.aoa_to_sheet([
    ['Coca-Cola', '2,50'],
    ['Bière pression', '4'],
    ['Eau minérale', ''],
  ]),
  'Boissons'
)
XLSX.writeFile(wb3, '/tmp/test-2colonnes.xlsx')

const s3 = readSheet(await Bun.file('/tmp/test-2colonnes.xlsx').arrayBuffer())
console.log('\nFichier à 2 colonnes :')
check('pas de détection en-têtes', s3.headerAuto === false)
const b3 = buildItems(s3, false)
check('3 articles', b3.rows.length === 3)
check('b3[0] prix 2,5', b3.rows[0]?.price === 2.5, `(reçu ${b3.rows[0]?.price})`)
check('b3[0] description vide', b3.rows[0]?.description === '')
check('b3[2] prix null sans warning', b3.rows[2]?.price === null && b3.priceWarnings === 0)

/* ---------- 5. CSV point-virgule avec en-têtes ---------- */
const csv = [
  'Nom;Description;Prix',
  'Croissant;Beurre AOP;1,20',
  'Pain au chocolat;;1,50',
].join('\n')
await Bun.write('/tmp/test-carte.csv', csv)
const s4 = readSheet(await Bun.file('/tmp/test-carte.csv').arrayBuffer())
console.log('\nCSV point-virgule :')
check('3 lignes non vides (en-tête incluse)', s4.rows.length === 3, `(reçu ${s4.rows.length})`)
check('en-têtes détectées', s4.headerAuto === true)
const b4 = buildItems(s4, true)
check('2 articles', b4.rows.length === 2, `(reçu ${b4.rows.length})`)
check('b4[0] nom Croissant', b4.rows[0]?.name === 'Croissant')
check('b4[0] prix 1,2', b4.rows[0]?.price === 1.2, `(reçu ${b4.rows[0]?.price})`)
check('b4[1] prix 1,5', b4.rows[1]?.price === 1.5)

/* ---------- 6. Prix illisible + lignes vides ignorées ---------- */
const wb5 = XLSX.utils.book_new()
XLSX.utils.book_append_sheet(
  wb5,
  XLSX.utils.aoa_to_sheet([
    ['Nom', 'Description', 'Prix'],
    ['Plat A', 'x', 'douze euros'],
    ['', '', ''],
    ['', 'prix seul', '5,00'],
  ]),
  'Feuil1'
)
XLSX.writeFile(wb5, '/tmp/test-limites.xlsx')
const s5 = readSheet(await Bun.file('/tmp/test-limites.xlsx').arrayBuffer())
console.log('\nCas limites :')
const b5 = buildItems(s5, true)
check('1 article', b5.rows.length === 1, `(reçu ${b5.rows.length})`)
check('1 prix illisible signalé', b5.priceWarnings === 1, `(reçu ${b5.priceWarnings})`)
check('1 ligne sans nom ignorée', b5.skipped === 1, `(reçu ${b5.skipped})`)

/* ---------- 7. Forcer l'inclusion de l'en-tête ---------- */
const b6 = buildItems(s1, false)
console.log('\nEn-tête non ignorée (contrôle manuel) :')
check('5 lignes dont en-tête', b6.rows.length === 5, `(reçu ${b6.rows.length})`)
check('première ligne = texte en-tête', b6.rows[0]?.name === "Nom de l'article")

console.log(failures === 0 ? '\nTOUS LES TESTS PASSENT' : `\n${failures} ÉCHEC(S)`)
process.exit(failures === 0 ? 0 : 1)
