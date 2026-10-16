import { CATEGORY_ATTRIBUTES, CONTAINER_ITEMS } from '../../data/composePost'
import { CATEGORIES } from '../../data/homeFeed'
import Icon from '../common/Icon'
import CategoryIcon from '../home/CategoryIcon'
import { cx, focusRing } from '../moderator/classes'
import { chipClass, labelClass, tileClass } from './styles'
import { FieldError, StepHeading } from './ui'

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

// Loại tin, danh mục và thuộc tính của món đồ
export default function ClassifyStep({ form, errors, onChange }) {
  const attributes = CATEGORY_ATTRIBUTES[form.category] ?? []
  const containerItems = CONTAINER_ITEMS[form.category]

  // Đổi danh mục thì thuộc tính cũ không còn đúng nên phải chọn lại
  const pickCategory = (category) => {
    if (category === form.category) return
    onChange({ category, attributes: {}, contents: [] })
  }

  const toggleAttribute = (key, value) => {
    const next = { ...form.attributes }
    if (next[key] === value) delete next[key]
    else next[key] = value
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
      <StepHeading title="Bạn muốn đăng loại tin nào?" />
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
                'flex min-h-24 cursor-pointer flex-col items-center justify-center gap-2.5 rounded-2xl border px-3 py-4 text-center transition sm:flex-row sm:justify-start sm:gap-3.5 sm:px-5 sm:text-left',
                active
                  ? option.active
                  : 'border-line bg-surface hover:border-line-strong hover:bg-surface-muted',
                focusRing
              )}
            >
              <span
                className={cx(
                  'grid size-11 shrink-0 place-items-center rounded-xl transition-colors',
                  active ? option.iconActive : option.iconIdle
                )}
              >
                <Icon name={option.icon} size={20} />
              </span>
              <span>
                <span className="block text-lead font-bold text-ink">{option.label}</span>
                <span className="mt-0.5 hidden text-caption text-ink-muted sm:block">
                  {option.hint}
                </span>
              </span>
            </button>
          )
        })}
      </div>
      <FieldError>{errors.type}</FieldError>

      <div className="my-6 h-px bg-line-subtle" />

      <h3 className={labelClass}>Đây là món đồ gì?</h3>
      <div role="group" aria-label="Danh mục" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {CATEGORIES.map((name) => {
          const active = form.category === name
          return (
            <button
              key={name}
              type="button"
              aria-pressed={active}
              onClick={() => pickCategory(name)}
              className={cx(
                tileClass(active),
                'min-h-11 items-center gap-2 px-3 py-2 text-small font-medium'
              )}
            >
              <CategoryIcon name={name} size={18} className="shrink-0" />
              {name}
            </button>
          )
        })}
      </div>
      <FieldError>{errors.category}</FieldError>

      {form.category && (
        <section
          aria-label="Thuộc tính món đồ"
          className="mt-6 rounded-2xl border border-line bg-surface-muted p-4 sm:p-5"
        >
          <h3 className="m-0 text-small font-semibold text-ink">Thuộc tính</h3>

          {attributes.map((attribute) => (
            <fieldset key={attribute.key} className="m-0 mt-4 border-0 p-0">
              <legend className="mb-2 p-0 text-caption font-semibold text-ink-secondary">
                {attribute.label}
              </legend>
              <div className="flex flex-wrap gap-2">
                {attribute.options.map((option) => {
                  const active = form.attributes[attribute.key] === option
                  return (
                    <button
                      key={option}
                      type="button"
                      aria-pressed={active}
                      onClick={() => toggleAttribute(attribute.key, option)}
                      className={chipClass(active)}
                    >
                      {option}
                    </button>
                  )
                })}
              </div>
            </fieldset>
          ))}

          {containerItems && (
            <fieldset className="m-0 mt-4 border-0 p-0">
              <legend className="mb-2 p-0 text-caption font-semibold text-ink-secondary">
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
