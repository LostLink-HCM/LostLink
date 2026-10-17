import { useId } from 'react'
import { DESCRIPTION_MAX, TITLE_MAX } from '../../lib/composePost'
import { cx } from '../moderator/classes'
import ImagePicker from './ImagePicker'
import { inputClass } from './styles'
import { FieldError, Note, StepHeading } from './ui'

function Counter({ value, max }) {
  return (
    <span className="text-caption text-ink-subtle">
      {value.length}/{max}
    </span>
  )
}

// Tiêu đề, mô tả và ảnh
export default function ContentStep({ form, errors, onChange, onAddImages, onRemoveImage }) {
  const id = useId()
  const found = form.type === 'found'
  const focusFirstLine = (e) => {
    if (!form.attributeBlock || form.description !== `\n${form.attributeBlock}`) return
    const textarea = e.currentTarget
    requestAnimationFrame(() => textarea.setSelectionRange(0, 0))
  }

  return (
    <>
      <StepHeading title="Kể về món đồ" />

      <div className="mb-5">
        <div className="mb-2 flex items-baseline justify-between gap-3">
          <label htmlFor={`${id}-title`} className="text-small font-semibold text-ink">
            Tiêu đề
          </label>
          <Counter value={form.title} max={TITLE_MAX} />
        </div>
        <input
          id={`${id}-title`}
          value={form.title}
          maxLength={TITLE_MAX}
          onChange={(e) => onChange({ title: e.target.value })}
          aria-invalid={errors.title ? true : undefined}
          aria-describedby={errors.title ? `${id}-title-error` : undefined}
          className={cx(inputClass, 'h-11')}
        />
        <FieldError id={`${id}-title-error`}>{errors.title}</FieldError>
      </div>

      <div className="mb-6">
        <div className="mb-2 flex items-baseline justify-between gap-3">
          <label htmlFor={`${id}-desc`} className="text-small font-semibold text-ink">
            Mô tả chi tiết
          </label>
          <Counter value={form.description} max={DESCRIPTION_MAX} />
        </div>
        <textarea
          id={`${id}-desc`}
          value={form.description}
          maxLength={DESCRIPTION_MAX}
          onChange={(e) => onChange({ description: e.target.value })}
          onFocus={focusFirstLine}
          aria-invalid={errors.description ? true : undefined}
          aria-describedby={errors.description ? `${id}-desc-error` : undefined}
          className={cx(inputClass, 'min-h-36 resize-y py-3 leading-relaxed')}
        />
        <FieldError id={`${id}-desc-error`}>{errors.description}</FieldError>
        {found && (
          <Note icon="lock" tone="warning" className="mt-3">
            Đừng ghi những chi tiết chỉ chủ nhân mới biết (số thẻ, đồ bên trong…) vào mô tả công
            khai. Hãy để dành chúng cho câu hỏi xác minh ở bước cuối.
          </Note>
        )}
      </div>

      <ImagePicker images={form.images} onAdd={onAddImages} onRemove={onRemoveImage} />
    </>
  )
}
