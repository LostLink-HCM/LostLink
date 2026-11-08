import Icon from '../../common/Icon'
import CategoryIcon from '../home/CategoryIcon'
import { cx, focusRing } from '../classes'
import { chipClass, labelClass, tileClass } from './styles'
import { FieldError, RequiredMark, StepHeading } from './ui'

const TYPE_OPTIONS = [
  {
    value: 'lost',
    label: 'Tôi bị mất đồ',
    hint: 'Mô tả để người nhặt nhận ra món đồ',
    icon: 'search',
    active: 'border-danger/60 bg-danger-soft ring-3 ring-danger/12',
    iconIdle: 'bg-danger-soft text-danger-ink',
    iconActive: 'bg-danger text-white',
  },
  {
    value: 'found',
    label: 'Tôi nhặt được đồ',
    hint: 'Giúp món đồ quay về đúng chủ',
    icon: 'check',
    active: 'border-primary/60 bg-primary-soft ring-3 ring-primary/12',
    iconIdle: 'bg-primary-soft text-primary',
    iconActive: 'bg-primary text-white',
  },
]

// Loại tin, danh mục và thuộc tính; category là danh mục đang chọn
export default function ClassifyStep({ form, categories, category, errors, onChange }) {
  const attributes = category?.attributes ?? []
  const containerItems = category?.contentItems ?? []

  // Đổi danh mục thì thuộc tính cũ không còn đúng nên phải chọn lại
  const pickCategory = (slug) => {
    if (slug === form.category) return
    onChange({ category: slug, attributes: {}, contents: [] })
  }

  // Lưu theo id, bấm lại giá trị đang chọn để bỏ chọn
  const toggleAttribute = (attributeId, valueId) => {
    const next = { ...form.attributes }
    if (next[attributeId] === valueId) delete next[attributeId]
    else next[attributeId] = valueId
    onChange({ attributes: next })
  }

  const toggleContent = (item) =>
    onChange({
      contents: form.contents.includes(item)
        ? form.contents.filter((value) => value !== item)
        : [...form.contents, item],
    })

  return (
    <>
      <StepHeading title="Bạn muốn đăng loại tin nào?" required />
      <div role="group" aria-label="Loại tin" className="grid grid-cols-2 gap-3">
        {TYPE_OPTIONS.map((option) => {
          const active = form.type === option.value
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={active}
              onClick={() => onChange({ type: option.value })}
              className={cx(
                'flex min-h-18 cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border px-3 py-3 text-center transition sm:flex-row sm:justify-start sm:gap-3 sm:px-4 sm:text-left',
                active
                  ? option.active
                  : 'border-line bg-surface hover:border-line-strong hover:bg-surface-muted',
                focusRing
              )}
            >
              <span
                className={cx(
                  'grid size-9 shrink-0 place-items-center rounded-xl transition-colors',
                  active ? option.iconActive : option.iconIdle
                )}
              >
                <Icon name={option.icon} size={18} />
              </span>
              <span>
                <span className="block text-body font-bold text-ink">{option.label}</span>
                <span className="mt-0.5 hidden text-caption text-ink-muted sm:block">
                  {option.hint}
                </span>
              </span>
            </button>
          )
        })}
      </div>
      <FieldError>{errors.type}</FieldError>

      <div className="my-5 h-px bg-line-subtle" />

      <h3 className={labelClass}>
        Đây là món đồ gì?
        <RequiredMark />
      </h3>
      <div role="group" aria-label="Danh mục" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {categories.map((item) => {
          const active = form.category === item.slug
          return (
            <button
              key={item.slug}
              type="button"
              aria-pressed={active}
              onClick={() => pickCategory(item.slug)}
              className={cx(
                tileClass(active),
                'min-h-10 items-center gap-2 px-3 py-1.5 text-small font-medium'
              )}
            >
              <CategoryIcon name={item.name} size={18} className="shrink-0" />
              {item.name}
            </button>
          )
        })}
      </div>
      <FieldError>{errors.category}</FieldError>

      {category && (attributes.length > 0 || containerItems.length > 0) && (
        <section
          aria-label="Thuộc tính món đồ"
          className="mt-5 rounded-2xl border border-line bg-surface-muted p-3.5 sm:p-4"
        >
          <h3 className="m-0 text-small font-semibold text-ink">Thuộc tính</h3>

          {attributes.map((attribute) => (
            <fieldset key={attribute.id} className="m-0 mt-3 border-0 p-0">
              <legend className="mb-1.5 p-0 text-caption font-semibold text-ink-secondary">
                {attribute.name}
                {attribute.isRequired && <RequiredMark />}
              </legend>
              <div className="flex flex-wrap gap-2">
                {attribute.values.map((value) => {
                  const active = form.attributes[attribute.id] === value.id
                  return (
                    <button
                      key={value.id}
                      type="button"
                      aria-pressed={active}
                      onClick={() => toggleAttribute(attribute.id, value.id)}
                      className={chipClass(active)}
                    >
                      {value.value}
                    </button>
                  )
                })}
              </div>
            </fieldset>
          ))}
          <FieldError>{errors.attributes}</FieldError>

          {containerItems.length > 0 && (
            <fieldset className="m-0 mt-3 border-0 p-0">
              <legend className="mb-1.5 p-0 text-caption font-semibold text-ink-secondary">
                Bên trong có <span className="font-normal text-ink-muted">· chọn nhiều</span>
              </legend>
              <div className="flex flex-wrap gap-2">
                {containerItems.map((item) => {
                  const active = form.contents.includes(item)
                  return (
                    <button
                      key={item}
                      type="button"
                      aria-pressed={active}
                      onClick={() => toggleContent(item)}
                      className={chipClass(active)}
                    >
                      {active && <Icon name="check" size={14} />}
                      {item}
                    </button>
                  )
                })}
              </div>
            </fieldset>
          )}
        </section>
      )}
    </>
  )
}
