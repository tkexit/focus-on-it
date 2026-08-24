import { useEffect, useRef } from 'react'

interface Props {
  value: string
  onChange: (text: string) => void
  placeholder?: string
  className?: string
  autoFocus?: boolean
  /** Called on Enter without Shift (for single-field editing). */
  onEnter?: () => void
  onBlur?: () => void
  'aria-label'?: string
}

/** A borderless textarea that grows to fit its own text. */
export function GrowingTextarea({
  value,
  onChange,
  placeholder,
  className,
  autoFocus,
  onEnter,
  onBlur,
  ['aria-label']: ariaLabel,
}: Props) {
  const ref = useRef<HTMLTextAreaElement>(null)

  const resize = () => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }

  // Fit the height to the text on every value change.
  useEffect(resize, [value])

  // And on width changes (screen rotation, window resize) — otherwise the text would clip.
  useEffect(() => {
    window.addEventListener('resize', resize)
    return () => window.removeEventListener('resize', resize)
  }, [])

  // Cursor to the end on autofocus (entering horizon edit mode).
  useEffect(() => {
    if (!autoFocus) return
    const el = ref.current
    if (!el) return
    el.focus()
    const end = el.value.length
    el.setSelectionRange(end, end)
  }, [autoFocus])

  return (
    <textarea
      ref={ref}
      rows={1}
      value={value}
      placeholder={placeholder}
      className={className}
      aria-label={ariaLabel}
      spellCheck={false}
      onInput={resize}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onBlur}
      onKeyDown={(e) => {
        if (onEnter && e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault()
          onEnter()
        }
      }}
    />
  )
}
