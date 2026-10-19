import { useMemo, useRef, useState } from 'react'
import Icon from '../../components/common/Icon'
import { cx, focusRing } from '../../components/moderator/classes'
import { createAdminCategories } from '../../data/adminCategories'

const EMPTY_CATEGORY = { name: '', aliases: [], radius: 400 }
const EMPTY_ATTRIBUTE = { name: '', aliases: [], strength: 'medium', values: [] }
const STRENGTH_LABELS = { strong: 'Mạnh', medium: 'Vừa', weak: 'Nhẹ' }

const inputClass =
  'min-h-10 w-full rounded-lg border border-line-strong bg-surface px-3 py-2 text-body font-medium text-ink-secondary outline-none transition focus:border-primary focus:ring-3 focus:ring-primary/10'
const labelClass = 'flex flex-col gap-2 text-small font-semibold text-ink-secondary'
const buttonClass =
  'inline-flex min-h-9 cursor-pointer items-center justify-center gap-1.5 rounded-lg border px-3 text-small font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-45'

function makeId(prefix) {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return `${prefix}-${crypto.randomUUID()}`
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function Button({ children, icon, variant = 'secondary', className, ...props }) {
  const variants = {
    secondary:
      'border-line-strong bg-surface text-ink-secondary hover:border-primary hover:bg-primary-subtle hover:text-primary',
    primary: 'border-primary bg-primary text-white hover:bg-primary-hover',
    danger: 'border-[#e4bbc5] bg-[#fff7f8] text-danger-ink hover:bg-danger-soft',
  }
  return (
    <button
      type="button"
      className={cx(buttonClass, variants[variant], focusRing, className)}
      {...props}
    >
      {icon && <Icon name={icon} size={16} />}
      {children}
    </button>
  )
}

function IconButton({ label, icon, danger = false, className, onClick }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      className={cx(
        'inline-flex size-8 cursor-pointer items-center justify-center rounded-md text-ink-subtle transition-colors hover:bg-primary-subtle hover:text-primary',
        danger && 'text-danger-ink hover:bg-danger-soft hover:text-danger-ink',
        className,
        focusRing
      )}
      onClick={onClick}
    >
      <Icon name={icon} size={15} />
    </button>
  )
}

function Dialog({ title, onClose, children, footer }) {
  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-sidebar/45 p-4 backdrop-blur-[3px]"
      role="presentation"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="max-h-[calc(100dvh-32px)] w-full max-w-[680px] overflow-y-auto rounded-2xl bg-surface text-ink shadow-dialog"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="flex items-center justify-between gap-3 border-b border-line bg-surface-muted px-5 py-3 max-sm:px-4">
          <h2 className="text-lead font-bold text-ink">{title}</h2>
          <button
            type="button"
            aria-label="Đóng"
            className={cx(
              'inline-flex size-8 cursor-pointer items-center justify-center rounded-md text-ink-muted hover:bg-primary-subtle hover:text-primary',
              focusRing
            )}
            onClick={onClose}
          >
            <Icon name="close" size={18} />
          </button>
        </header>
        <div className="px-5 py-4 max-sm:p-4">{children}</div>
        {footer && (
          <footer className="flex flex-wrap justify-end gap-2.5 border-t border-line px-5 py-3 max-sm:px-4">
            {footer}
          </footer>
        )}
      </section>
    </div>
  )
}

function FormError({ children, id }) {
  return (
    <p id={id} className="-mt-1 text-small text-danger-ink" role="alert">
      {children}
    </p>
  )
}

function normalizeAliases(value) {
  if (Array.isArray(value)) return [...value]
  const aliases = String(value || '')
    .split(',')
    .map((alias) => alias.trim())
    .filter(Boolean)
  return aliases
}

function cleanAliases(value) {
  const seen = new Set()
  return value
    .map((alias) => alias.trim().normalize('NFC'))
    .filter((alias) => {
      const key = alias.toLocaleLowerCase('vi')
      if (!key || seen.has(key)) return false
      seen.add(key)
      return true
    })
}

function splitPercentage(count, total = 100) {
  if (!count) return []
  const base = Math.floor(total / count)
  const remainder = total - base * count
  return Array.from({ length: count }, (_, index) => base + (index < remainder ? 1 : 0))
}

function rebalanceRelations(relations) {
  const percentages = splitPercentage(relations.length)
  return relations.map((relation, index) => ({
    ...relation,
    percentage: percentages[index],
  }))
}

function normalizeRelations(value, sourceCategoryId) {
  const relations = Array.isArray(value)
    ? value.map((relation, index) => ({
        id: relation.id || makeId(`relation-${index + 1}`),
        sourceCategoryId: relation.sourceCategoryId || sourceCategoryId || null,
        memberCategoryIds: Array.isArray(relation.memberCategoryIds)
          ? [...new Set(relation.memberCategoryIds)]
          : [],
        percentage: Number.isFinite(Number(relation.percentage)) ? Number(relation.percentage) : 0,
      }))
    : []

  const total = relations.reduce(
    (sum, relation) => sum + (Number.isFinite(relation.percentage) ? relation.percentage : 0),
    0
  )

  return total === 100 ? relations : rebalanceRelations(relations)
}

function updateRelationPercentage(relations, index, nextValue) {
  if (relations.length <= 1) return relations.map((relation) => ({ ...relation, percentage: 100 }))

  const percentage = Math.max(0, Math.min(100, Number(nextValue) || 0))
  const otherIndexes = relations
    .map((_, relationIndex) => relationIndex)
    .filter((relationIndex) => relationIndex !== index)
  const otherPercentages = splitPercentage(otherIndexes.length, 100 - percentage)

  return relations.map((relation, relationIndex) => {
    if (relationIndex === index) return { ...relation, percentage }
    return {
      ...relation,
      percentage: otherPercentages[otherIndexes.indexOf(relationIndex)],
    }
  })
}

function normalizeAttributeValues(value) {
  if (!Array.isArray(value)) return []
  return value.map((attributeValue, index) => ({
    id: attributeValue.id || makeId(`attribute-value-${index + 1}`),
    value: attributeValue.value || attributeValue.label || '',
    aliases: normalizeAliases(attributeValue.aliases),
  }))
}

function cleanAttributeValues(value) {
  return value.map((attributeValue) => ({
    id: attributeValue.id || makeId('attribute-value'),
    value: attributeValue.value.trim().normalize('NFC'),
    aliases: cleanAliases(attributeValue.aliases),
  }))
}

function AliasFields({ value, onChange }) {
  const aliases = value
  const updateAlias = (index, next) => {
    onChange(aliases.map((alias, aliasIndex) => (aliasIndex === index ? next : alias)))
  }
  const removeAlias = (index) => {
    const next = aliases.filter((_, aliasIndex) => aliasIndex !== index)
    onChange(next)
  }

  return (
    <div className="flex flex-col gap-2">
      {aliases.map((alias, index) => (
        <div key={`alias-${index}`} className="flex items-center gap-2">
          <input
            className={inputClass}
            value={alias}
            onChange={(event) => updateAlias(index, event.target.value)}
            placeholder={`Alias ${index + 1}`}
            aria-label={`Alias ${index + 1}`}
          />
          <IconButton
            label={`Xóa alias ${index + 1}`}
            icon="close"
            danger
            onClick={() => removeAlias(index)}
          />
        </div>
      ))}
    </div>
  )
}

function AttributeValueFields({ values, onChange }) {
  const updateValue = (index, nextValue) =>
    onChange(
      values.map((attributeValue, valueIndex) =>
        valueIndex === index ? nextValue : attributeValue
      )
    )
  const addValue = () =>
    onChange([...values, { id: makeId('attribute-value'), value: '', aliases: [] }])
  const removeValue = (index) => onChange(values.filter((_, valueIndex) => valueIndex !== index))

  return (
    <div className={labelClass}>
      <div className="flex items-center gap-1.5">
        <span>Giá trị thuộc tính</span>
        <IconButton
          label="Thêm giá trị thuộc tính"
          icon="plus"
          className="border border-line-strong bg-surface"
          onClick={addValue}
        />
      </div>
      {values.length > 0 && (
        <div className="space-y-3">
          {values.map((attributeValue, index) => (
            <article
              key={attributeValue.id}
              className="rounded-lg border border-line bg-surface-muted p-3"
            >
              <div className="flex items-start gap-2">
                <label className={cx(labelClass, 'min-w-0 flex-1')}>
                  Tên giá trị
                  <input
                    className={inputClass}
                    value={attributeValue.value}
                    onChange={(event) =>
                      updateValue(index, { ...attributeValue, value: event.target.value })
                    }
                    placeholder="Ví dụ: Đỏ, vàng, dây chuyền..."
                  />
                </label>
                <IconButton
                  label={`Xóa giá trị ${index + 1}`}
                  icon="close"
                  danger
                  className="mt-6"
                  onClick={() => removeValue(index)}
                />
              </div>
              <div className="mt-3">
                <div className={labelClass}>
                  <div className="flex items-center gap-1.5">
                    <span>Alias</span>
                    <IconButton
                      label={`Thêm alias cho giá trị ${index + 1}`}
                      icon="plus"
                      className="border border-line-strong bg-surface"
                      onClick={() =>
                        updateValue(index, {
                          ...attributeValue,
                          aliases: [...attributeValue.aliases, ''],
                        })
                      }
                    />
                  </div>
                  <AliasFields
                    value={attributeValue.aliases}
                    onChange={(aliases) => updateValue(index, { ...attributeValue, aliases })}
                  />
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}

function CategoryForm({ value, categories, onSubmit, onClose, editing }) {
  const [form, setForm] = useState({
    ...value,
    aliases: normalizeAliases(value.aliases),
    relations: normalizeRelations(value.relations, value.id),
  })
  const [error, setError] = useState('')
  const change = (key, next) => {
    setError('')
    setForm((current) => ({ ...current, [key]: next }))
  }
  const submit = (event) => {
    event.preventDefault()
    if (!form.name.trim()) return setError('Nhập tên danh mục.')
    if (
      !Number.isInteger(Number(form.radius)) ||
      Number(form.radius) < 100 ||
      Number(form.radius) > 50000
    ) {
      return setError('Bán kính phải là số nguyên từ 100 đến 50.000 m.')
    }
    const relations = form.relations || []
    if (relations.some((relation) => !relation.memberCategoryIds?.length)) {
      return setError('Mỗi mối quan hệ phải có ít nhất một danh mục liên quan.')
    }

    const relationMembers = relations.flatMap((relation) => relation.memberCategoryIds)
    if (new Set(relationMembers).size !== relationMembers.length) {
      return setError('Một danh mục không được xuất hiện ở nhiều mối quan hệ khác nhau.')
    }

    const relationPercentage = relations.reduce(
      (sum, relation) => sum + Number(relation.percentage || 0),
      0
    )
    if (relations.length && relationPercentage !== 100) {
      return setError('Tổng phần trăm các mối quan hệ phải bằng 100%.')
    }

    onSubmit({
      name: form.name.trim(),
      radius: Number(form.radius),
      aliases: cleanAliases(form.aliases),
      relations: relations.map((relation) => ({
        ...relation,
        sourceCategoryId: value.id || null,
        percentage: Number(relation.percentage),
      })),
    })
  }

  return (
    <Dialog
      title={editing ? 'Sửa danh mục' : 'Thêm danh mục'}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Hủy</Button>
          <Button type="submit" form="admin-category-form" variant="primary" icon="check">
            Lưu
          </Button>
        </>
      }
    >
      <form
        id="admin-category-form"
        className="flex flex-col gap-[18px]"
        onSubmit={submit}
        noValidate
      >
        <label className={labelClass}>
          Tên danh mục
          <input
            autoFocus
            className={inputClass}
            value={form.name}
            onChange={(event) => change('name', event.target.value)}
            placeholder="Tên danh mục"
          />
        </label>
        <label className={labelClass}>
          Bán kính matching
          <input
            className={inputClass}
            type="number"
            min="100"
            max="50000"
            step="1"
            value={form.radius}
            onChange={(event) => change('radius', event.target.value)}
          />
        </label>
        <div className={labelClass}>
          <div className="flex items-center gap-1.5">
            <span>Alias</span>
            <IconButton
              label="Thêm alias"
              icon="plus"
              className="border border-line-strong bg-surface"
              onClick={() => change('aliases', [...form.aliases, ''])}
            />
          </div>
          <AliasFields value={form.aliases} onChange={(aliases) => change('aliases', aliases)} />
        </div>
        <CategoryRelationsField
          value={form.relations}
          categories={categories}
          sourceCategoryId={value.id}
          onChange={(relations) => change('relations', relations)}
        />
        {error && <FormError>{error}</FormError>}
      </form>
    </Dialog>
  )
}

function AttributeForm({ value, onSubmit, onClose, editing }) {
  const [form, setForm] = useState({
    ...value,
    name: value.name || value.label || '',
    aliases: normalizeAliases(value.aliases),
    strength: value.strength || 'medium',
    values: normalizeAttributeValues(value.values),
  })
  const [error, setError] = useState('')
  const change = (key, next) => {
    setError('')
    setForm((current) => ({ ...current, [key]: next }))
  }
  const submit = (event) => {
    event.preventDefault()
    if (!form.name.trim()) return setError('Nhập tên thuộc tính.')
    if (form.values.some((attributeValue) => !attributeValue.value.trim())) {
      return setError('Vui lòng nhập tên cho tất cả giá trị thuộc tính.')
    }
    const valueNames = form.values.map((attributeValue) =>
      attributeValue.value.trim().toLocaleLowerCase('vi')
    )
    if (new Set(valueNames).size !== valueNames.length) {
      return setError('Các giá trị trong cùng một thuộc tính không được trùng nhau.')
    }
    onSubmit({
      name: form.name.trim(),
      aliases: cleanAliases(form.aliases),
      strength: form.strength,
      values: cleanAttributeValues(form.values),
    })
  }

  return (
    <Dialog
      title={editing ? 'Sửa thuộc tính' : 'Thêm thuộc tính'}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Hủy</Button>
          <Button type="submit" form="admin-attribute-form" variant="primary" icon="check">
            Lưu thuộc tính
          </Button>
        </>
      }
    >
      <form
        id="admin-attribute-form"
        className="flex flex-col gap-[18px]"
        onSubmit={submit}
        noValidate
      >
        <label className={labelClass}>
          Tên thuộc tính
          <input
            autoFocus
            className={inputClass}
            value={form.name}
            onChange={(event) => change('name', event.target.value)}
            placeholder="Tên thuộc tính"
          />
        </label>
        <div className="grid grid-cols-1 gap-3.5">
          <label className={labelClass}>
            Độ mạnh
            <select
              className={cx(inputClass, 'cursor-pointer')}
              value={form.strength}
              onChange={(event) => change('strength', event.target.value)}
            >
              <option value="strong">Mạnh</option>
              <option value="medium">Vừa</option>
              <option value="weak">Nhẹ</option>
            </select>
          </label>
        </div>
        <div className={labelClass}>
          <div className="flex items-center gap-1.5">
            <span>Alias</span>
            <IconButton
              label="Thêm alias"
              icon="plus"
              className="border border-line-strong bg-surface"
              onClick={() => change('aliases', [...form.aliases, ''])}
            />
          </div>
          <AliasFields value={form.aliases} onChange={(aliases) => change('aliases', aliases)} />
        </div>
        <AttributeValueFields
          values={form.values}
          onChange={(values) => change('values', values)}
        />
        {error && <FormError>{error}</FormError>}
      </form>
    </Dialog>
  )
}

function AttributeDetailDialog({ attribute, onClose }) {
  const attributeName = attribute.name || attribute.label
  const values = attribute.values || []

  return (
    <Dialog
      title={`Chi tiết thuộc tính: ${attributeName}`}
      onClose={onClose}
      footer={<Button onClick={onClose}>Đóng</Button>}
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
          <div className="rounded-lg border border-line bg-surface-muted p-3">
            <small className="block text-caption text-ink-muted">Độ mạnh</small>
            <strong className="mt-1 block text-body font-semibold text-ink-secondary">
              {STRENGTH_LABELS[attribute.strength] || 'Vừa'}
            </strong>
          </div>
          <div className="rounded-lg border border-line bg-surface-muted p-3">
            <small className="block text-caption text-ink-muted">Số giá trị</small>
            <strong className="mt-1 block text-body font-semibold text-ink-secondary">
              {values.length} giá trị
            </strong>
          </div>
        </div>

        <section className="rounded-lg border border-line bg-surface-muted p-3.5">
          <h3 className="m-0 text-body font-bold text-ink-secondary">Alias của thuộc tính</h3>
          {attribute.aliases?.length ? (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {attribute.aliases.map((alias) => (
                <span
                  key={alias}
                  className="rounded-md bg-white px-2 py-1 text-small text-ink-secondary"
                >
                  {alias}
                </span>
              ))}
            </div>
          ) : (
            <p className="mt-2 mb-0 text-small text-ink-muted">Chưa có alias.</p>
          )}
        </section>

        <section>
          <h3 className="m-0 text-body font-bold text-ink-secondary">Giá trị thuộc tính</h3>
          {values.length ? (
            <div className="mt-2 space-y-2">
              {values.map((attributeValue) => (
                <article
                  key={attributeValue.id}
                  className="rounded-lg border border-line bg-surface-muted p-3"
                >
                  <strong className="block text-body font-semibold text-[#3b5774]">
                    {attributeValue.value || attributeValue.label}
                  </strong>
                  {attributeValue.aliases?.length ? (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {attributeValue.aliases.map((alias) => (
                        <span
                          key={alias}
                          className="rounded-md bg-white px-2 py-1 text-caption text-ink-secondary"
                        >
                          {alias}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <small className="mt-1 block text-caption text-ink-muted">Chưa có alias.</small>
                  )}
                </article>
              ))}
            </div>
          ) : (
            <div className="mt-2 rounded-lg border border-dashed border-line-strong p-4 text-center text-small text-ink-muted">
              Chưa có giá trị thuộc tính.
            </div>
          )}
        </section>
      </div>
    </Dialog>
  )
}

function QuestionForm({ question, categoryName, onSubmit, onClose }) {
  const [text, setText] = useState(question?.text || '')
  const [error, setError] = useState('')
  const inputRef = useRef(null)
  const submit = (event) => {
    event.preventDefault()
    const value = text.trim()
    if (!value || value.length > 500) {
      setError(
        !value ? 'Vui lòng nhập nội dung câu hỏi.' : 'Câu hỏi không được vượt quá 500 ký tự.'
      )
      inputRef.current?.focus()
      return
    }
    onSubmit(value)
  }

  return (
    <Dialog
      title={question ? 'Sửa câu hỏi xác minh' : 'Thêm câu hỏi xác minh'}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Hủy</Button>
          <Button type="submit" form="admin-question-form" variant="primary" icon="check">
            Lưu câu hỏi
          </Button>
        </>
      }
    >
      <form
        id="admin-question-form"
        className="flex flex-col gap-[18px]"
        noValidate
        onSubmit={submit}
      >
        <p className="m-0 text-body text-ink-muted">
          Danh mục: <strong className="text-ink-secondary">{categoryName}</strong>
        </p>
        <label htmlFor="admin-question-text" className={labelClass}>
          Nội dung câu hỏi
          <textarea
            ref={inputRef}
            id="admin-question-text"
            autoFocus
            rows={5}
            maxLength={500}
            required
            className={cx(
              inputClass,
              'min-h-32 resize-y leading-relaxed',
              error && 'border-danger-ink'
            )}
            value={text}
            onChange={(event) => {
              setText(event.target.value)
              setError('')
            }}
            placeholder="Nhập câu hỏi xác minh…"
            aria-invalid={Boolean(error)}
            aria-describedby={`admin-question-count${error ? ' admin-question-error' : ''}`}
          />
        </label>
        <small id="admin-question-count" className="-mt-3 text-right text-caption text-ink-muted">
          {text.length}/500 ký tự
        </small>
        {error && <FormError id="admin-question-error">{error}</FormError>}
      </form>
    </Dialog>
  )
}

function MetaCard({ icon, label, value, tone = 'blue' }) {
  const tones = {
    blue: 'bg-[#e7f0fb] text-[#3976bd]',
    teal: 'bg-[#e3f4ef] text-[#258c7b]',
    amber: 'bg-[#fcf1dc] text-[#ae812e]',
  }
  return (
    <article className="flex min-w-0 items-center gap-2.5 rounded-lg border border-line bg-surface-muted p-3">
      <span className={cx('grid size-[34px] shrink-0 place-items-center rounded-lg', tones[tone])}>
        <Icon name={icon} size={18} />
      </span>
      <div className="min-w-0">
        <small className="block text-caption text-ink-muted">{label}</small>
        <strong className="mt-1 block truncate text-small font-semibold text-ink-secondary">
          {value}
        </strong>
      </div>
    </article>
  )
}

function RelationGroup({
  relation,
  index,
  categories,
  sourceCategoryId,
  hasDuplicate,
  onChange,
  onRemove,
}) {
  const memberCategoryIds = relation.memberCategoryIds || []
  const members = categories.filter((category) => memberCategoryIds.includes(category.id))
  const candidates = categories.filter((category) => category.id !== sourceCategoryId)
  const toggleMember = (categoryId) => {
    const next = memberCategoryIds.includes(categoryId)
      ? memberCategoryIds.filter((id) => id !== categoryId)
      : [...memberCategoryIds, categoryId]
    onChange({ ...relation, memberCategoryIds: next })
  }

  return (
    <article
      className={cx(
        'rounded-lg border border-line bg-surface-muted p-3.5',
        hasDuplicate && 'border-danger-ink bg-[#fff7f8]'
      )}
      aria-invalid={hasDuplicate}
    >
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <strong className="text-small font-semibold text-ink-secondary">
            Có {members.length} danh mục
          </strong>
          {hasDuplicate && (
            <p className="mt-1 text-caption font-semibold text-danger-ink" role="alert">
              Danh mục liên quan đang bị trùng với một quan hệ khác. Vui lòng chọn lại.
            </p>
          )}
        </div>
        <div className="flex shrink-0 items-start gap-2">
          <label className="flex items-center gap-2 text-caption font-semibold text-ink-secondary">
            <span>Tỷ lệ</span>
            <div className="relative w-[110px]">
              <input
                className={cx(inputClass, 'pr-8')}
                type="number"
                min="0"
                max="100"
                step="1"
                value={relation.percentage}
                onChange={(event) =>
                  onChange({ ...relation, percentage: Number(event.target.value) })
                }
                aria-label={`Tỷ lệ quan hệ ${index + 1}`}
              />
              <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-small text-ink-muted">
                %
              </span>
            </div>
          </label>
          <IconButton label={`Xóa quan hệ ${index + 1}`} icon="close" danger onClick={onRemove} />
        </div>
      </header>

      {members.length > 0 && (
        <div className="mt-3 flex min-h-9 flex-wrap items-center gap-2">
          {members.map((member) => (
            <span
              key={member.id}
              className="inline-flex max-w-full items-center gap-1 rounded-md border border-[#c5d8eb] bg-white px-2.5 py-1.5 text-small text-ink-secondary"
            >
              <span className="truncate">{member.name}</span>
              <button
                type="button"
                className={cx(
                  'inline-flex size-5 shrink-0 cursor-pointer items-center justify-center rounded text-ink-subtle hover:bg-danger-soft hover:text-danger-ink',
                  focusRing
                )}
                aria-label={`Bỏ ${member.name} khỏi quan hệ ${index + 1}`}
                onClick={() => toggleMember(member.id)}
              >
                <Icon name="close" size={13} />
              </button>
            </span>
          ))}
        </div>
      )}

      <details className="mt-3 rounded-lg border border-line-strong bg-surface">
        <summary className="cursor-pointer px-3 py-2 text-small font-semibold text-primary outline-none hover:bg-primary-subtle focus-visible:ring-2 focus-visible:ring-focus/30">
          Chọn danh mục
        </summary>
        <div className="grid max-h-52 gap-1 overflow-y-auto border-t border-line-subtle p-2 sm:grid-cols-2">
          {candidates.map((category) => (
            <label
              key={category.id}
              className="flex cursor-pointer items-start gap-2 rounded-md px-2.5 py-2 text-small text-ink-secondary hover:bg-primary-subtle"
            >
              <input
                type="checkbox"
                className="mt-0.5 size-4 shrink-0 accent-primary"
                checked={memberCategoryIds.includes(category.id)}
                onChange={() => toggleMember(category.id)}
              />
              <span className="min-w-0">
                <strong className="block truncate font-semibold">{category.name}</strong>
              </span>
            </label>
          ))}
        </div>
      </details>
    </article>
  )
}

function CategoryRelationsField({ value, categories, sourceCategoryId, onChange }) {
  const relations = value || []
  const memberCounts = relations
    .flatMap((relation) => relation.memberCategoryIds || [])
    .reduce(
      (counts, categoryId) => counts.set(categoryId, (counts.get(categoryId) || 0) + 1),
      new Map()
    )
  const duplicateMemberIds = new Set(
    [...memberCounts].filter(([, count]) => count > 1).map(([categoryId]) => categoryId)
  )
  const updateRelation = (index, nextRelation) => {
    if (nextRelation.percentage !== relations[index].percentage) {
      onChange(updateRelationPercentage(relations, index, nextRelation.percentage))
      return
    }
    onChange(
      relations.map((relation, relationIndex) =>
        relationIndex === index ? nextRelation : relation
      )
    )
  }
  const addRelation = () =>
    onChange(
      rebalanceRelations([
        ...relations,
        {
          id: makeId('relation'),
          sourceCategoryId: sourceCategoryId || null,
          memberCategoryIds: [],
          percentage: 0,
        },
      ])
    )
  const removeRelation = (index) =>
    onChange(rebalanceRelations(relations.filter((_, relationIndex) => relationIndex !== index)))

  return (
    <div className={labelClass}>
      <div className="flex items-center gap-1.5">
        <span>Mối quan hệ</span>
        <IconButton
          label="Thêm mối quan hệ"
          icon="plus"
          className="border border-line-strong bg-surface"
          onClick={addRelation}
        />
      </div>
      {relations.length > 0 && (
        <div className="space-y-3">
          {relations.map((relation, index) => (
            <RelationGroup
              key={relation.id}
              relation={relation}
              index={index}
              categories={categories}
              sourceCategoryId={sourceCategoryId}
              hasDuplicate={relation.memberCategoryIds?.some((categoryId) =>
                duplicateMemberIds.has(categoryId)
              )}
              onChange={(nextRelation) => updateRelation(index, nextRelation)}
              onRemove={() => removeRelation(index)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export default function Categories() {
  const [categoryState, setCategoryState] = useState(() => {
    const items = createAdminCategories()
    return {
      items,
      updatedAt: null,
    }
  })
  const updateCategories = (update) => {
    setCategoryState((current) => ({
      ...current,
      items: typeof update === 'function' ? update(current.items) : update,
      updatedAt: new Date().toISOString(),
    }))
  }
  const categories = categoryState.items
  const [selectedId, setSelectedId] = useState(categories[0]?.id)
  const [modal, setModal] = useState(null)
  const [query, setQuery] = useState('')
  const listRef = useRef(null)
  const selected = categories.find((category) => category.id === selectedId) || categories[0]
  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase('vi')
    return categories.filter((category) =>
      `${category.name} ${category.aliases.join(' ')}`
        .toLocaleLowerCase('vi')
        .includes(normalizedQuery)
    )
  }, [categories, query])

  const updateSelected = (updater) => {
    if (!selected) return
    updateCategories((current) =>
      current.map((category) => (category.id === selected.id ? updater(category) : category))
    )
  }

  const saveCategory = (value) => {
    if (modal.editing) {
      updateCategories((current) =>
        current.map((category) =>
          category.id === modal.value.id
            ? {
                ...category,
                ...value,
                relations: (value.relations || []).map((relation) => ({
                  ...relation,
                  sourceCategoryId: category.id,
                })),
              }
            : category
        )
      )
    } else {
      const id = makeId('CAT')
      updateCategories((current) => [
        {
          id,
          ...value,
          relations: (value.relations || []).map((relation) => ({
            ...relation,
            sourceCategoryId: id,
          })),
          attributes: [],
          inside: [],
          questions: [],
        },
        ...current,
      ])
      setSelectedId(id)
      setQuery('')
      if (listRef.current) listRef.current.scrollTop = 0
    }
    setModal(null)
  }

  const removeCategory = () => {
    if (categories.length <= 1 || modal?.kind !== 'delete-category') return
    const next = categories.filter((category) => category.id !== modal.category.id)
    updateCategories(next)
    setSelectedId(next[0]?.id)
    setModal(null)
  }

  const saveAttribute = (value) => {
    const savedAttribute = {
      id: modal.editing ? modal.attribute.id : makeId('attribute'),
      ...value,
    }
    updateSelected((category) => ({
      ...category,
      attributes: modal.editing
        ? category.attributes.map((attribute) =>
            attribute.id === modal.attribute.id ? savedAttribute : attribute
          )
        : [...category.attributes, savedAttribute],
    }))
    setModal(null)
  }

  const removeAttribute = (id) =>
    updateSelected((category) => ({
      ...category,
      attributes: category.attributes.filter((attribute) => attribute.id !== id),
    }))

  const saveQuestion = (text) => {
    const id = modal.question?.id || makeId('question')
    updateCategories((current) =>
      current.map((category) =>
        category.id !== modal.categoryId
          ? category
          : {
              ...category,
              questions: modal.question
                ? category.questions.map((question) =>
                    question.id === id ? { ...question, text } : question
                  )
                : [...category.questions, { id, text }],
            }
      )
    )
    setModal(null)
  }

  return (
    <div className="mx-auto max-w-[1640px] px-8 pt-7 text-ink max-[1200px]:px-[22px] max-sm:px-4 max-sm:pt-[22px]">
      <div className="mb-[18px] flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 text-small text-ink-muted" role="status">
          <Icon name="history" size={18} className="shrink-0 text-[#6684a5]" />
          <div>
            <span className="block">Cập nhật lần gần nhất</span>
            {categoryState.updatedAt ? (
              <time
                className="mt-1 block text-small font-semibold text-ink-secondary"
                dateTime={categoryState.updatedAt}
              >
                {new Date(categoryState.updatedAt).toLocaleString('vi-VN')}
              </time>
            ) : (
              <strong className="mt-1 block text-small font-semibold text-ink-secondary">
                Chưa có cập nhật
              </strong>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            variant="primary"
            icon="compose"
            onClick={() => setModal({ kind: 'category', value: EMPTY_CATEGORY })}
          >
            Thêm danh mục
          </Button>
        </div>
      </div>

      <div className="grid items-stretch gap-[22px] [grid-template-columns:minmax(245px,.72fr)_minmax(0,1.8fr)] max-[1100px]:gap-4 max-[1100px]:[grid-template-columns:minmax(220px,.62fr)_minmax(0,1.45fr)] max-[800px]:grid-cols-1">
        <aside className="flex min-w-0 flex-col overflow-hidden rounded-[10px] border border-[#b4c6db] bg-surface shadow-[0_3px_10px_#16233a08]">
          <div className="border-b border-line bg-[#f7fafd] px-[18px] pt-[19px] pb-[15px]">
            <div className="mb-3.5 flex items-baseline justify-between gap-2">
              <strong className="text-lead font-semibold text-[#304e6e]">Danh mục phẳng</strong>
              <span className="text-small text-ink-muted">{categories.length} danh mục</span>
            </div>
            <label className="flex h-[38px] items-center gap-2 rounded-lg border border-[#c5d4e4] bg-surface px-2.5 text-[#7990aa] transition focus-within:border-primary focus-within:ring-3 focus-within:ring-primary/10">
              <Icon name="search" size={16} />
              <input
                className="min-w-0 w-full bg-transparent text-small text-ink-secondary outline-none placeholder:text-ink-subtle"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Tìm danh mục hoặc alias…"
                aria-label="Tìm danh mục hoặc alias"
              />
            </label>
          </div>
          <div
            ref={listRef}
            className={cx(
              'grid min-h-0 flex-1 grid-cols-1 overflow-auto p-2 max-[800px]:max-h-[280px] max-[800px]:grid-cols-2 max-[600px]:grid-cols-1',
              filtered.length > 10 && 'max-h-[736px] auto-rows-[72px]'
            )}
            tabIndex={filtered.length > 10 ? 0 : undefined}
            aria-label="Danh sách danh mục"
          >
            {filtered.map((category) => (
              <button
                key={category.id}
                type="button"
                className={cx(
                  'flex w-full min-w-0 cursor-pointer items-center gap-2.5 rounded-lg border border-transparent px-2.5 py-3 text-left text-[#4a6480] transition-colors hover:bg-[#f3f7fb]',
                  selected?.id === category.id && 'border-[#afc9e3] bg-[#eaf2fb] text-[#1e568d]'
                )}
                onClick={() => setSelectedId(category.id)}
              >
                <span
                  className={cx(
                    'grid size-[34px] shrink-0 place-items-center rounded-lg bg-[#edf3fb] text-[#527daa]',
                    selected?.id === category.id && 'bg-white text-primary'
                  )}
                >
                  <Icon name="category" size={18} />
                </span>
                <span className="min-w-0 flex-1">
                  <strong className="block truncate text-small font-semibold">
                    {category.name}
                  </strong>
                  <small className="mt-1 block text-caption text-ink-muted">
                    {category.radius.toLocaleString('vi-VN')} m · {category.attributes.length} thuộc
                    tính
                  </small>
                </span>
                <Icon name="next" size={15} className="shrink-0 text-[#9aabbd]" />
              </button>
            ))}
            {!filtered.length && (
              <div className="flex flex-col items-center gap-2.5 px-4 py-11 text-small text-ink-muted">
                <Icon name="search" size={26} />
                <span>Không tìm thấy danh mục</span>
              </div>
            )}
          </div>
        </aside>

        {selected && (
          <section
            className="min-w-0 rounded-[10px] border border-[#b4c6db] bg-surface p-[23px] shadow-[0_3px_10px_#16233a08] max-[1100px]:p-[18px] max-sm:p-[15px]"
            aria-label="Chi tiết danh mục"
          >
            <header className="flex flex-wrap items-start justify-between gap-[18px] border-b border-[#d5e0ec] pb-5 max-sm:flex-col">
              <div className="min-w-0">
                <span className="text-caption font-semibold uppercase tracking-[.2px] text-ink-muted">
                  {selected.id}
                </span>
                <h2 className="mt-1.5 mb-1 text-2xl font-bold tracking-[-.4px] text-[#263f5e]">
                  {selected.name}
                </h2>
                <p className="m-0 truncate text-body text-ink-muted">
                  {selected.aliases.join(' · ') || 'Chưa có alias'}
                </p>
              </div>
              <div className="flex shrink-0 gap-2 max-sm:w-full">
                <Button
                  className="text-caption max-sm:flex-1"
                  icon="edit"
                  onClick={() => setModal({ kind: 'category', editing: true, value: selected })}
                >
                  Sửa danh mục
                </Button>
                <Button
                  className="text-caption max-sm:flex-1"
                  variant="danger"
                  icon="lock"
                  disabled={categories.length <= 1}
                  onClick={() => setModal({ kind: 'delete-category', category: selected })}
                >
                  Xóa
                </Button>
              </div>
            </header>

            <div className="my-[19px] mb-[21px] grid grid-cols-3 gap-3 max-sm:grid-cols-1">
              <MetaCard
                icon="pin"
                label="Bán kính matching"
                value={`${selected.radius.toLocaleString('vi-VN')} m`}
              />
              <MetaCard
                icon="link"
                label="Quan hệ matching"
                value={`${(selected.relations || []).length} quan hệ`}
                tone="teal"
              />
              <MetaCard
                icon="compose"
                label="Alias"
                value={`${selected.aliases.length} cách gọi`}
                tone="amber"
              />
            </div>

            <section className="min-w-0 overflow-hidden rounded-[9px] border border-[#b8cadd] bg-surface">
              <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[#d5e0ec] bg-[#f7fafd] px-[18px] py-4">
                <div>
                  <h3 className="m-0 mb-1 text-[17px] font-bold text-[#304d6c]">
                    Thuộc tính matching
                  </h3>
                </div>
                <Button
                  className="text-caption"
                  icon="compose"
                  onClick={() => setModal({ kind: 'attribute', value: EMPTY_ATTRIBUTE })}
                >
                  Thêm thuộc tính
                </Button>
              </header>
              <div>
                <table className="w-full table-fixed border-collapse text-left">
                  <thead>
                    <tr>
                      {['Thuộc tính', 'Giá trị', 'Độ mạnh'].map((heading) => (
                        <th
                          key={heading}
                          className="bg-[#eef4fa] px-[15px] py-3 text-caption font-bold whitespace-nowrap text-[#56708c]"
                        >
                          {heading}
                        </th>
                      ))}
                      <th className="w-[116px] bg-[#eef4fa] px-1 py-3" aria-label="Thao tác" />
                    </tr>
                  </thead>
                  <tbody>
                    {selected.attributes.map((attribute) => (
                      <tr key={attribute.id} className="last:[&>td]:border-b-0">
                        <td className="w-[30%] border-b border-line-subtle px-3 py-3.5 align-top text-body text-ink-secondary">
                          <strong className="font-semibold text-[#3b5774]">
                            {attribute.name || attribute.label}
                          </strong>
                        </td>
                        <td className="w-[20%] border-b border-line-subtle px-3 py-3.5 align-top text-body text-ink-secondary">
                          <span className="text-small text-ink-muted">
                            {attribute.values?.length || 0}
                          </span>
                        </td>
                        <td className="w-[20%] border-b border-line-subtle px-3 py-3.5 align-top text-body text-ink-secondary">
                          <span
                            className={cx(
                              'inline-flex rounded-md px-2 py-1.5 text-caption font-semibold whitespace-nowrap',
                              attribute.strength === 'strong'
                                ? 'bg-[#eaf2fb] text-[#3b6595]'
                                : attribute.strength === 'medium'
                                  ? 'bg-[#fff7e8] text-[#94702c]'
                                  : 'bg-[#f1f4f7] text-ink-muted'
                            )}
                          >
                            {STRENGTH_LABELS[attribute.strength]}
                          </span>
                        </td>
                        <td className="w-[116px] border-b border-line-subtle px-1 py-3.5">
                          <div className="flex justify-end gap-0.5">
                            <IconButton
                              label={`Xem chi tiết ${attribute.name || attribute.label}`}
                              icon="eye"
                              onClick={() => setModal({ kind: 'attribute-detail', attribute })}
                            />
                            <IconButton
                              label={`Sửa ${attribute.name || attribute.label}`}
                              icon="edit"
                              onClick={() =>
                                setModal({
                                  kind: 'attribute',
                                  editing: true,
                                  attribute,
                                  value: attribute,
                                })
                              }
                            />
                            <IconButton
                              label={`Xóa ${attribute.name || attribute.label}`}
                              icon="close"
                              danger
                              onClick={() => removeAttribute(attribute.id)}
                            />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!selected.attributes.length && (
                  <div className="p-6 text-center text-body text-ink-muted">
                    Chưa có thuộc tính được thiết lập.
                  </div>
                )}
              </div>
            </section>

            <section className="mt-[18px] min-w-0 overflow-hidden rounded-[9px] border border-[#b8cadd] bg-surface">
              <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[#d5e0ec] bg-[#f7fafd] px-[18px] py-4">
                <div>
                  <h3 className="m-0 mb-1 text-[17px] font-bold text-[#304d6c]">
                    Câu hỏi xác minh
                  </h3>
                  <p className="m-0 text-small leading-relaxed text-ink-muted">
                    Câu hỏi giúp kiểm tra quyền sở hữu.
                  </p>
                </div>
                <Button
                  className="text-caption"
                  icon="compose"
                  onClick={() =>
                    setModal({
                      kind: 'question',
                      categoryId: selected.id,
                      categoryName: selected.name,
                    })
                  }
                >
                  Thêm câu hỏi
                </Button>
              </header>
              {selected.questions.length ? (
                <ol className="m-0 list-none px-[17px] py-2">
                  {selected.questions.map((question, index) => (
                    <li
                      key={question.id}
                      className="flex min-w-0 items-center gap-2 border-b border-line-subtle py-2.5 text-body text-ink-secondary last:border-b-0"
                    >
                      <span className="grid size-[23px] shrink-0 place-items-center rounded-md bg-[#eaf2fb] text-caption font-bold text-[#3976bd]">
                        {index + 1}
                      </span>
                      <p className="m-0 min-w-0 flex-1 break-words leading-relaxed">
                        {question.text}
                      </p>
                      <div className="flex shrink-0 gap-1">
                        <IconButton
                          label={`Sửa câu hỏi ${index + 1}`}
                          icon="edit"
                          onClick={() =>
                            setModal({
                              kind: 'question',
                              categoryId: selected.id,
                              categoryName: selected.name,
                              question,
                            })
                          }
                        />
                        <IconButton
                          label={`Xóa câu hỏi ${index + 1}`}
                          icon="close"
                          danger
                          onClick={() =>
                            updateSelected((category) => ({
                              ...category,
                              questions: category.questions.filter(
                                (entry) => entry.id !== question.id
                              ),
                            }))
                          }
                        />
                      </div>
                    </li>
                  ))}
                </ol>
              ) : (
                <div className="p-6 text-center text-body text-ink-muted">
                  Chưa có câu hỏi xác minh. Thêm câu hỏi để thiết lập nội dung xác minh cho danh
                  mục.
                </div>
              )}
            </section>
          </section>
        )}
      </div>

      {modal?.kind === 'category' && (
        <CategoryForm
          value={modal.value}
          categories={categories}
          editing={modal.editing}
          onSubmit={saveCategory}
          onClose={() => setModal(null)}
        />
      )}
      {modal?.kind === 'delete-category' && (
        <Dialog
          title="Xóa danh mục"
          onClose={() => setModal(null)}
          footer={
            <>
              <Button autoFocus onClick={() => setModal(null)}>
                Hủy
              </Button>
              <Button variant="danger" onClick={removeCategory}>
                Xóa danh mục
              </Button>
            </>
          }
        >
          <div className="space-y-3 text-body leading-relaxed text-ink-secondary">
            <p>
              Bạn có chắc muốn xóa danh mục{' '}
              <strong className="text-ink">“{modal.category.name}”</strong>?
            </p>
            <p>Thuộc tính, câu hỏi xác minh và cấu hình matching của danh mục cũng sẽ bị xóa.</p>
          </div>
        </Dialog>
      )}
      {modal?.kind === 'attribute' && (
        <AttributeForm
          value={modal.value}
          editing={modal.editing}
          onSubmit={saveAttribute}
          onClose={() => setModal(null)}
        />
      )}
      {modal?.kind === 'attribute-detail' && (
        <AttributeDetailDialog attribute={modal.attribute} onClose={() => setModal(null)} />
      )}
      {modal?.kind === 'question' && (
        <QuestionForm
          question={modal.question}
          categoryName={modal.categoryName}
          onSubmit={saveQuestion}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  )
}
