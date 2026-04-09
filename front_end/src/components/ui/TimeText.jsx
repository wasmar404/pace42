function safeParseIso(iso) {
  const t = Date.parse(String(iso || ''))
  return Number.isFinite(t) ? t : null
}

function formatRelative(ms) {
  const diff = Date.now() - ms
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'now'
  if (mins < 60) return `${mins}m`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h`
  const days = Math.floor(hrs / 24)
  return `${days}d`
}

function formatLocale(ms, opts) {
  try {
    return new Date(ms).toLocaleString(undefined, opts)
  } catch {
    return ''
  }
}

export default function TimeText({
  iso,
  variant = 'datetime-short',
  className,
  wrap = true,
  fallback = '',
}) {
  const ms = safeParseIso(iso)
  let text = fallback

  if (ms != null) {
    if (variant === 'relative') text = formatRelative(ms)
    else if (variant === 'date-short') text = formatLocale(ms, { month: 'short', day: '2-digit' })
    else if (variant === 'datetime-long') {
      text = formatLocale(ms, { weekday: 'short', month: 'short', day: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    } else {
      text = formatLocale(ms, { month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' })
    }
  }

  if (!wrap) return text
  return <span className={className}>{text}</span>
}
