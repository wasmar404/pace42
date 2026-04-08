// Supabase Edge Function: import-gpx
// - Reads a GPX file from Storage via direct REST calls (no SDK dependency)
// - Extracts points, computes distance + duration
// - Returns parsed stats + polyline
//
// DB writes are intentionally NOT done here so the backend can use the ORM.

type ImportBody = {
  gpxBucket: string
  gpxPath: string
  sport?: string
  title?: string
  description?: string
  userJwt?: string
}

function haversineMeters(a: { lat: number; lon: number }, b: { lat: number; lon: number }) {
  const R = 6371000
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLon = toRad(b.lon - a.lon)
  const lat1 = toRad(a.lat)
  const lat2 = toRad(b.lat)

  const s =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2)

  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)))
}

function polylineEncode(points: Array<{ lat: number; lon: number }>): string {
  let lastLat = 0
  let lastLon = 0
  let result = ''

  const encode = (v: number) => {
    let s = ''
    let n = v < 0 ? ~(v << 1) : v << 1
    while (n >= 0x20) {
      s += String.fromCharCode((0x20 | (n & 0x1f)) + 63)
      n >>= 5
    }
    s += String.fromCharCode(n + 63)
    return s
  }

  for (const p of points) {
    const lat = Math.round(p.lat * 1e5)
    const lon = Math.round(p.lon * 1e5)
    const dLat = lat - lastLat
    const dLon = lon - lastLon
    lastLat = lat
    lastLon = lon
    result += encode(dLat) + encode(dLon)
  }

  return result
}

Deno.serve(async (req) => {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
    if (!supabaseUrl || !serviceRoleKey || !anonKey) {
      return new Response(JSON.stringify({ error: 'Missing Supabase env vars' }), { status: 500 })
    }

    const body = (await req.json()) as ImportBody
    if (!body?.gpxBucket || !body?.gpxPath) {
      return new Response(JSON.stringify({ error: 'Missing gpxBucket/gpxPath' }), { status: 400 })
    }

    const token = typeof body.userJwt === 'string' ? body.userJwt : ''
    if (!token) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'content-type': 'application/json' },
      })
    }

    // Verify the user JWT via Supabase Auth REST API (no SDK needed)
    const userRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'apikey': anonKey,
      },
    })
    if (!userRes.ok) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'content-type': 'application/json' },
      })
    }

    // Download the GPX file from Storage via REST API using service role key
    const encodedPath = body.gpxPath.split('/').map(encodeURIComponent).join('/')
    const storageUrl = `${supabaseUrl}/storage/v1/object/${encodeURIComponent(body.gpxBucket)}/${encodedPath}`
    const fileRes = await fetch(storageUrl, {
      headers: {
        'Authorization': `Bearer ${serviceRoleKey}`,
        'apikey': serviceRoleKey,
      },
    })
    if (!fileRes.ok) {
      const msg = await fileRes.text().catch(() => 'Download failed')
      return new Response(JSON.stringify({ error: msg }), { status: 400 })
    }

    const xml = await fileRes.text()

    // Avoid DOMParser dependency; parse trackpoints with a simple regex.
    // This supports typical GPX produced by Strava/Garmin/etc.
    const trkptRe = /<trkpt\b[^>]*\blat="([^"]+)"[^>]*\blon="([^"]+)"[^>]*>([\s\S]*?)<\/trkpt>/gi
    const timeRe = /<time>([^<]+)<\/time>/i

    const points: Array<{ lat: number; lon: number; t?: number }> = []
    let m: RegExpExecArray | null
    while ((m = trkptRe.exec(xml))) {
      const lat = Number(m[1])
      const lon = Number(m[2])
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue

      const inner = m[3] || ''
      const tm = timeRe.exec(inner)
      const t = tm ? Date.parse(tm[1]) : NaN
      points.push({ lat, lon, t: Number.isFinite(t) ? t : undefined })
    }

    if (points.length < 2) {
      return new Response(JSON.stringify({ error: 'GPX has no track points' }), {
        status: 400,
        headers: { 'content-type': 'application/json' },
      })
    }

    // Downsample to keep polyline reasonable
    const maxPoints = 500
    let sampled = points
    if (points.length > maxPoints) {
      const step = Math.ceil(points.length / maxPoints)
      sampled = points.filter((_, idx) => idx % step === 0)
      if (sampled[sampled.length - 1] !== points[points.length - 1]) sampled.push(points[points.length - 1])
    }

    let dist = 0
    for (let i = 1; i < points.length; i++) {
      dist += haversineMeters(points[i - 1], points[i])
    }

    const startTime = points.find((p) => p.t)?.t
    const endTime = [...points].reverse().find((p) => p.t)?.t
    const startedAt = new Date(startTime ?? Date.now()).toISOString()
    const durationSeconds = startTime && endTime ? Math.max(1, Math.round((endTime - startTime) / 1000)) : 1

    const distanceMeters = Math.max(1, Math.round(dist))
    const sport = body.sport ?? 'run'

    const polyline = polylineEncode(sampled)

    return new Response(
      JSON.stringify({
        startedAt,
        durationSeconds,
        distanceMeters,
        polyline,
        sport,
      }),
      { headers: { 'content-type': 'application/json' } },
    )
  } catch (e) {
    // deno-lint-ignore no-console
    console.error(e)
    const msg = e instanceof Error ? e.message : 'Unknown error'
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { 'content-type': 'application/json' } })
  }
})
