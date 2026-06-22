import { useEffect, useRef } from 'react'

interface Props {
  value: string
  onChange: (text: string) => void
  placeholder?: string
  className?: string
  autoFocus?: boolean
  /** Вызывается при Enter без Shift (для однополевого редактирования). */
  onEnter?: () => void
  onBlur?: () => void
  'aria-label'?: string
}

/** Textarea без рамок, которая растёт ровно под свой текст. */
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

  // Подгоняем высоту под текст при каждом изменении значения.
  useEffect(resize, [value])

  // Курсор в конец при автофокусе (вход в режим правки горизонта).
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
