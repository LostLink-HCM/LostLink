import { useId } from 'react'
import { DESCRIPTION_MAX, TITLE_MAX, selectedAttributes } from '../../../lib/user/composePost'
import { cx } from '../classes'
import ImagePicker from '../ImagePicker'
import { inputClass } from './styles'
import Note from '../Note'
import { FieldError, RequiredMark, StepHeading } from './ui'

function Counter({ value, max }) {
  return (
    <span className="text-caption text-ink-subtle">
      {value.length}/{max}
    </span>
  )
}

const chipClass = 'flex items-center gap-1.5 rounded-full bg-surface px-3 py-1.5 text-caption'

// Đặc điểm đã chọn ở bước Phân loại, để người dùng không phải ghi lại trong mô tả
function ChosenTraits({ form, category }) {
  const traits = selectedAttributes(form, category)
  if (!traits.length && !form.contents.length) return null

  return (
    <div className="mb-3 rounded-xl bg-line-subtle/60 px-3.5 py-3">
      <p className="m-0 mb-2 text-tiny font-semibold tracking-wide text-ink-subtle uppercase">
        Đặc điểm đã chọn
      </p>
      <dl className="m-0 flex flex-wrap gap-2">
        {traits.map(({ name, value }) => (
          <div key={name} className={chipClass}>
            <dt className="text-ink-muted">{name}:</dt>
            <dd className="m-0 font-semibold text-ink">{value}</dd>
          </div>
        ))}
        {form.contents.length > 0 && (
          <div className={chipClass}>
            <dt className="text-ink-muted">Bên trong có:</dt>
            <dd className="m-0 font-semibold text-ink">{form.contents.join(', ')}</dd>
          </div>
        )}
      </dl>
      <p className="m-0 mt-2 text-caption leading-relaxed text-ink-muted">
        {traits.length > 0 && 'Đặc điểm hiển thị riêng trên bài đăng, bạn không cần ghi lại. '}
        {form.contents.length > 0 &&
          'Đồ bên trong chỉ dùng để tìm manh mối, không hiển thị công khai.'}
      </p>
    </div>
  )
}

const PLACEHOLDERS = {
  lost: 'Đặc điểm riêng giúp người khác nhận ra: vết xước, móc khóa, sticker, đồ đi kèm… và hoàn cảnh bị mất.',
  found:
    'Nơi và hoàn cảnh nhặt được, đặc điểm dễ thấy bên ngoài. Đừng ghi chi tiết chỉ chủ nhân mới biết.',
}

// Tiêu đề, mô tả và ảnh
export default function ContentStep({
  form,
  category,
  errors,
  onChange,
  onAddImages,
  onRemoveImage,
  onMakeCover,
}) {
  const id = useId()
  const found = form.type === 'found'

  return (
    <>
      <StepHeading title="Kể về món đồ" />

      <div className="mb-4">
        <div className="mb-1.5 flex items-baseline justify-between gap-3">
          <label htmlFor={`${id}-title`} className="text-small font-semibold text-ink">
            Tiêu đề
            <RequiredMark />
          </label>
          <Counter value={form.title} max={TITLE_MAX} />
        </div>
        <input
          id={`${id}-title`}
          value={form.title}
          maxLength={TITLE_MAX}
          onChange={(e) => onChange({ title: e.target.value })}
          aria-required="true"
          aria-invalid={errors.title ? true : undefined}
          aria-describedby={errors.title ? `${id}-title-error` : undefined}
          className={cx(inputClass, 'h-10')}
        />
        <FieldError id={`${id}-title-error`}>{errors.title}</FieldError>
      </div>

      <div className="mb-5">
        <div className="mb-1.5 flex items-baseline justify-between gap-3">
          <label htmlFor={`${id}-desc`} className="text-small font-semibold text-ink">
            Mô tả chi tiết
          </label>
          <Counter value={form.description} max={DESCRIPTION_MAX} />
        </div>
        <ChosenTraits form={form} category={category} />
        <textarea
          id={`${id}-desc`}
          value={form.description}
          maxLength={DESCRIPTION_MAX}
          placeholder={PLACEHOLDERS[form.type] ?? PLACEHOLDERS.lost}
          onChange={(e) => onChange({ description: e.target.value })}
          aria-invalid={errors.description ? true : undefined}
          aria-describedby={errors.description ? `${id}-desc-error` : undefined}
          className={cx(inputClass, 'min-h-32 resize-y py-2.5 leading-relaxed')}
        />
        <FieldError id={`${id}-desc-error`}>{errors.description}</FieldError>
        {found && (
          <Note icon="lock" tone="warning" className="mt-3">
            Đừng ghi những chi tiết chỉ chủ nhân mới biết (số thẻ, đồ bên trong…) vào mô tả công
            khai. Hãy để dành chúng cho câu hỏi xác minh ở bước cuối.
          </Note>
        )}
      </div>

      <ImagePicker
        images={form.images}
        onAdd={onAddImages}
        onRemove={onRemoveImage}
        onMakeCover={onMakeCover}
        hint="Thêm hình ảnh giúp mọi người nhận ra món đồ nhanh hơn."
        showOptional={false}
      />
      <FieldError>{errors.images}</FieldError>
    </>
  )
}
