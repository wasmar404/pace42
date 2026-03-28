export default function SegmentedControl({
  value,
  options,
  onChange,
  ariaLabel,
  disabled = false,
  className = '',
}) {
  const list = Array.isArray(options) ? options : []
  const v = String(value ?? '')

  return (
    <div className={`seg ${className}`.trim()} role="group" aria-label={ariaLabel}>
      {list.map((opt) => {
        const o = typeof opt === 'string' ? { value: opt, label: opt } : opt
        const ov = String(o?.value ?? '')
        const selected = ov === v
        return (
          <button
            key={ov}
            className={selected ? 'seg-btn on' : 'seg-btn'}
            type="button"
            disabled={disabled}
            onClick={() => onChange?.(ov)}
          >
            {o?.label ?? ov}
          </button>
        )
      })}
    </div>
  )
}
