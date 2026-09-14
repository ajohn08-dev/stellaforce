/**
 * Country normalization — free-text country values to ISO 3166-1 alpha-2.
 *
 * Pure: no `server-only`, no Supabase import, so `npm run enrichment-check`
 * drives the real mapping headless.
 *
 * ## Why this exists
 *
 * Résumé parsing produces the same country several ways. In the live data today
 * India arrives as both `IN` and `India`, which means "software engineers in
 * India" cannot be answered by an equality filter on the raw column — the two
 * spellings would return two different result sets. This maps both to `IN`.
 *
 * ## What it does not do
 *
 * **Country only.** No geocoding, no metro areas, no radius, no state or region
 * resolution, and no inferring a country from a city. Those need data we do not
 * have, and a wrong guess about where someone lives is worse than an honest
 * gap: "Greater Boston" and "within 25 miles" stay unsupported and disclosed.
 *
 * It also never rewrites the raw value. `location_country` keeps exactly what
 * the parse produced; the code goes in its own derived column, like every other
 * derived field in this system.
 */

/** ISO-2 → display name, for the filter menu and the applied-filter summary. */
export const COUNTRY_NAMES: Record<string, string> = {
  AE: "United Arab Emirates",
  AR: "Argentina",
  AT: "Austria",
  AU: "Australia",
  BD: "Bangladesh",
  BE: "Belgium",
  BR: "Brazil",
  CA: "Canada",
  CH: "Switzerland",
  CL: "Chile",
  CN: "China",
  CO: "Colombia",
  CZ: "Czechia",
  DE: "Germany",
  DK: "Denmark",
  EG: "Egypt",
  ES: "Spain",
  FI: "Finland",
  FR: "France",
  GB: "United Kingdom",
  HK: "Hong Kong",
  ID: "Indonesia",
  IE: "Ireland",
  IL: "Israel",
  IN: "India",
  IT: "Italy",
  JP: "Japan",
  KE: "Kenya",
  KR: "South Korea",
  LK: "Sri Lanka",
  MX: "Mexico",
  MY: "Malaysia",
  NG: "Nigeria",
  NL: "Netherlands",
  NO: "Norway",
  NZ: "New Zealand",
  PH: "Philippines",
  PK: "Pakistan",
  PL: "Poland",
  PT: "Portugal",
  RO: "Romania",
  SE: "Sweden",
  SG: "Singapore",
  TH: "Thailand",
  TR: "Türkiye",
  UA: "Ukraine",
  US: "United States",
  VN: "Vietnam",
  ZA: "South Africa",
}

export const SUPPORTED_COUNTRY_CODES = Object.keys(COUNTRY_NAMES)

/**
 * Everything that should resolve to a code, beyond the code itself and the
 * display name above (both of which are matched automatically).
 *
 * Deliberately a curated list rather than a full i18n dataset: these are the
 * spellings résumés and recruiters actually produce. An unrecognised value
 * resolves to null and is flagged for review — which is a question a human can
 * answer, unlike a wrong guess.
 */
const ALIASES: Record<string, string> = {
  // United States — by far the most variable in practice.
  usa: "US",
  "u.s.": "US",
  "u.s.a.": "US",
  "united states of america": "US",
  america: "US",
  // United Kingdom. England/Scotland/Wales are countries in their own right but
  // never appear as a *separate* jurisdiction in this data; a recruiter typing
  // "England" means the UK.
  uk: "GB",
  "u.k.": "GB",
  england: "GB",
  scotland: "GB",
  wales: "GB",
  britain: "GB",
  "great britain": "GB",
  "northern ireland": "GB",
  // ISO-3 forms, which some parsers emit.
  ind: "IN",
  can: "CA",
  aus: "AU",
  deu: "DE",
  ger: "DE",
  fra: "FR",
  esp: "ES",
  nld: "NL",
  irl: "IE",
  sgp: "SG",
  phl: "PH",
  bra: "BR",
  mex: "MX",
  zaf: "ZA",
  are: "AE",
  isr: "IL",
  jpn: "JP",
  kor: "KR",
  chn: "CN",
  pak: "PK",
  bgd: "BD",
  // Common alternate names.
  holland: "NL",
  "the netherlands": "NL",
  uae: "AE",
  "south korea": "KR",
  "republic of korea": "KR",
  "czech republic": "CZ",
  turkey: "TR",
  "viet nam": "VN",
  "hong kong sar": "HK",
  eire: "IE",
}

/** Name → code, built once from the display names. */
const BY_NAME: Record<string, string> = Object.fromEntries(
  Object.entries(COUNTRY_NAMES).map(([code, name]) => [name.toLowerCase(), code])
)

/**
 * Resolve a raw country value to ISO-2, or null when it is absent or unknown.
 *
 * Case- and punctuation-insensitive. Null rather than a guess: an unrecognised
 * country becomes an `unresolved_country` review reason, which asks a human
 * rather than filing someone under the wrong nation.
 */
export function toCountryCode(raw: string | null | undefined): string | null {
  const value = (raw ?? "").trim()
  if (!value) return null

  // A bare two-letter code, already in the supported set.
  const upper = value.toUpperCase()
  if (upper.length === 2 && COUNTRY_NAMES[upper]) return upper

  const key = value
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[.,]/g, (m) => (m === "." ? "." : ""))
    .trim()

  if (BY_NAME[key]) return BY_NAME[key]
  if (ALIASES[key]) return ALIASES[key]

  // Retry without periods, so "U.S." and "US" agree without a second alias.
  const stripped = key.replace(/\./g, "").trim()
  if (BY_NAME[stripped]) return BY_NAME[stripped]
  if (ALIASES[stripped]) return ALIASES[stripped]
  const strippedUpper = stripped.toUpperCase()
  if (strippedUpper.length === 2 && COUNTRY_NAMES[strippedUpper]) return strippedUpper

  return null
}

/** "IN" → "India". Falls back to the code so an unknown value still renders. */
export function countryLabel(code: string): string {
  return COUNTRY_NAMES[code] ?? code
}
