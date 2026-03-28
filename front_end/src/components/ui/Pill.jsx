export default function Pill({ children, accent = false, className = '' }) {
  const base = accent ? 'pill accent' : 'pill'
  const cls = `${base} ${className}`.trim()
  return <span className={cls}>{children}</span>
}
