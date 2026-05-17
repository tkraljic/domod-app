import { getSession } from '@/lib/session'

export const dynamic = 'force-dynamic'

type NominatimItem = {
  display_name: string
  lat: string
  lon: string
  type?: string
  class?: string
  address?: Record<string, string>
  namedetails?: Record<string, string>
}

// Vuk's mapping: Bosnian/Serbian/Montenegrin Cyrillic → Latin.
// Bigrams (Љ Њ Џ) must come before single letters in the regex.
const CYR_TO_LAT_PAIRS: [RegExp, string][] = [
  [/Љ/g, 'Lj'], [/Њ/g, 'Nj'], [/Џ/g, 'Dž'],
  [/љ/g, 'lj'], [/њ/g, 'nj'], [/џ/g, 'dž'],
  [/А/g, 'A'], [/Б/g, 'B'], [/В/g, 'V'], [/Г/g, 'G'], [/Д/g, 'D'],
  [/Ђ/g, 'Đ'], [/Е/g, 'E'], [/Ж/g, 'Ž'], [/З/g, 'Z'], [/И/g, 'I'],
  [/Ј/g, 'J'], [/К/g, 'K'], [/Л/g, 'L'], [/М/g, 'M'], [/Н/g, 'N'],
  [/О/g, 'O'], [/П/g, 'P'], [/Р/g, 'R'], [/С/g, 'S'], [/Т/g, 'T'],
  [/Ћ/g, 'Ć'], [/У/g, 'U'], [/Ф/g, 'F'], [/Х/g, 'H'], [/Ц/g, 'C'],
  [/Ч/g, 'Č'], [/Ш/g, 'Š'],
  [/а/g, 'a'], [/б/g, 'b'], [/в/g, 'v'], [/г/g, 'g'], [/д/g, 'd'],
  [/ђ/g, 'đ'], [/е/g, 'e'], [/ж/g, 'ž'], [/з/g, 'z'], [/и/g, 'i'],
  [/ј/g, 'j'], [/к/g, 'k'], [/л/g, 'l'], [/м/g, 'm'], [/н/g, 'n'],
  [/о/g, 'o'], [/п/g, 'p'], [/р/g, 'r'], [/с/g, 's'], [/т/g, 't'],
  [/ћ/g, 'ć'], [/у/g, 'u'], [/ф/g, 'f'], [/х/g, 'h'], [/ц/g, 'c'],
  [/ч/g, 'č'], [/ш/g, 'š'],
]

const CYRILLIC_RE = /[Ѐ-ӿ]/

export function transliterate(input: string): string {
  if (!CYRILLIC_RE.test(input)) return input
  let out = input
  for (const [pat, rep] of CYR_TO_LAT_PAIRS) out = out.replace(pat, rep)
  return out
}

export type GeocodeResult = {
  displayName: string
  shortLabel: string
  lat: number
  lng: number
}

export async function GET(request: Request) {
  const session = await getSession()
  if (!session?.userId) {
    return new Response('Unauthorized', { status: 401 })
  }

  const url = new URL(request.url)
  const q = (url.searchParams.get('q') ?? '').trim()
  if (q.length < 3) {
    return Response.json([] satisfies GeocodeResult[])
  }

  const params = new URLSearchParams({
    q,
    format: 'json',
    addressdetails: '1',
    limit: '6',
    countrycodes: 'ba',
    'accept-language': 'bs,hr,sr,en',
  })

  let res: Response
  try {
    res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
      headers: {
        'User-Agent': 'DOMOD-Dostave/1.0 (admin@domod.ba)',
      },
      // Nominatim rate-limits aggressively — short cache helps repeat queries
      next: { revalidate: 60 },
    })
  } catch {
    return new Response('Geocoder unreachable', { status: 502 })
  }

  if (!res.ok) {
    return new Response(`Geocoder error: ${res.status}`, { status: 502 })
  }

  const data = (await res.json()) as NominatimItem[]
  const results: GeocodeResult[] = data.map((item) => ({
    displayName: item.display_name,
    shortLabel: shortenLabel(item),
    lat: Number(item.lat),
    lng: Number(item.lon),
  }))

  return Response.json(results, {
    headers: { 'Cache-Control': 'private, max-age=60' },
  })
}

function shortenLabel(item: NominatimItem): string {
  const a = item.address ?? {}
  const street = a.road || a.pedestrian || a.footway || ''
  const houseNo = a.house_number || ''
  const town = a.city || a.town || a.village || a.suburb || ''
  const country = a.country || ''
  const streetPart = [street, houseNo].filter(Boolean).join(' ')
  const parts = [streetPart, town, country].filter(Boolean)
  return parts.length > 0 ? parts.join(', ') : item.display_name
}
