function placeholderDataUri() {
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#FC4C02" stop-opacity="0.30"/>
      <stop offset="1" stop-color="#0B1220" stop-opacity="0.08"/>
    </linearGradient>
  </defs>
  <rect x="0" y="0" width="128" height="128" rx="28" fill="url(#g)"/>
  <circle cx="64" cy="52" r="18" fill="rgba(11,18,32,0.35)"/>
  <path d="M32 108c6-18 20-28 32-28s26 10 32 28" fill="rgba(11,18,32,0.28)"/>
</svg>`
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

export default function Avatar({ avatarUrl, alt = '', className = '', loading = 'lazy', size }) {
  const style = size ? { width: `${Number(size)}px`, height: `${Number(size)}px` } : undefined
  const src = avatarUrl || placeholderDataUri()
  return <img src={src} alt={alt} className={className} loading={loading} style={style} />
}
