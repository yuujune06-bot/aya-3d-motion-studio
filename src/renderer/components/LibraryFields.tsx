import type { Bilingual } from '../../shared/schema/library'

export const fieldClass = 'w-full rounded border border-gray-400 p-2 read-only:bg-gray-50'
export const actionClass =
  'rounded border px-3 py-1.5 enabled:hover:bg-gray-100 disabled:opacity-50'
export function Pair({
  label,
  value,
  onChange,
}: {
  label: string
  value: Bilingual
  onChange?: (value: Bilingual) => void
}): React.JSX.Element {
  return (
    <fieldset className="mb-3 grid grid-cols-2 gap-3">
      <legend className="mb-1 font-medium">{label}</legend>
      <label>
        英語（Klingに入る文）
        <textarea
          className={fieldClass}
          aria-label={label + ' 英語'}
          value={value.en}
          readOnly={!onChange}
          onChange={(event) => onChange?.({ ...value, en: event.target.value })}
        />
      </label>
      <label>
        日本語（確認用）
        <textarea
          className={fieldClass}
          aria-label={label + ' 日本語'}
          value={value.ja}
          readOnly={!onChange}
          onChange={(event) => onChange?.({ ...value, ja: event.target.value })}
        />
      </label>
    </fieldset>
  )
}
