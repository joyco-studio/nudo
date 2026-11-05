/**
 * Matches a browser `Origin` against `ALLOWED_ORIGINS`: a comma-separated list where `*` stands
 * for one run of letters, digits and dashes. It never spans a dot or a slash, so
 * `https://nudo-*-joycostudio.vercel.app` covers every preview of the project and
 * `http://localhost:*` covers any local port, but neither reaches another host.
 */
const WILDCARD = '*'
const WILDCARD_PATTERN = '[a-z0-9-]+'

const escapeForRegExp = (text: string): string => text.replace(/[.+?^${}()|[\]\\]/g, '\\$&')

const patternFor = (allowedOrigin: string): RegExp =>
  new RegExp(
    `^${allowedOrigin.toLowerCase().split(WILDCARD).map(escapeForRegExp).join(WILDCARD_PATTERN)}$`,
  )

export const parseAllowedOrigins = (value: string): readonly RegExp[] =>
  value
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin !== '')
    .map(patternFor)

export const isAllowedOrigin = (origin: string | null, allowedOrigins: string): boolean => {
  if (origin === null) return false
  const normalized = origin.toLowerCase()
  return parseAllowedOrigins(allowedOrigins).some((pattern) => pattern.test(normalized))
}
