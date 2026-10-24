// Protection par mot de passe de l'espace d'administration.
//
// Principe :
// - La variable d'environnement ADMIN_PASSWORD définit le mot de passe.
//   Si elle n'est pas définie, la protection est désactivée (accès libre) :
//   l'application se comporte exactement comme avant, ce qui permet de
//   continuer à l'utiliser en développement ou sur un déploiement de test.
// - Une fois le mot de passe validé sur la page /login, un cookie HttpOnly
//   « admin_session » est posé. Sa valeur est un HMAC-SHA256 calculé à partir
//   du mot de passe : impossible de remonter vers le mot de passe, et changer
//   ADMIN_PASSWORD invalide automatiquement toutes les sessions existantes.
// - Le fichier src/proxy.ts vérifie ce cookie sur toutes les routes, sauf la
//   page publique des menus (/m/...) et la page de connexion (/login).

export const AUTH_COOKIE_NAME = 'admin_session'

// Sert uniquement de « sel » stable pour le calcul du jeton de session.
const TOKEN_MESSAGE = 'menu-admin-session-v1'

/** Vrai si un mot de passe d'administration est configuré. */
export function isAuthEnabled(): boolean {
  return typeof process.env.ADMIN_PASSWORD === 'string' && process.env.ADMIN_PASSWORD.length > 0
}

async function computeToken(password: string): Promise<string> {
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(TOKEN_MESSAGE))
  return Array.from(new Uint8Array(signature))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

/** Valeur à écrire dans le cookie après une connexion réussie. */
export async function createSessionCookieValue(): Promise<string> {
  return computeToken(process.env.ADMIN_PASSWORD ?? '')
}

/** Vrai si le jeton de session est valide (ou si la protection est désactivée). */
export async function isValidSessionToken(token: string | undefined): Promise<boolean> {
  if (!isAuthEnabled()) return true
  if (!token) return false
  const expected = await computeToken(process.env.ADMIN_PASSWORD ?? '')
  return safeEqual(token, expected)
}

/** Comparaison en temps constant (évite les attaques par analyse de durée). */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return diff === 0
}
