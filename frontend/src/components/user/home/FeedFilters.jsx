import { useState } from 'react'
import { AREAS, CATEGORIES } from '../../../data/homeFeed'
import { TIME_RANGES, TYPE_LABELS } from '../../../lib/user/homeFeed'
import Icon from '../../common/Icon'
import Button from '../Button'
import { cx, focusRing } from '../classes'
import CategoryIcon from './CategoryIcon'

const typeButtonTones = {
  all: {
    base: 'bg-neutral-soft text-ink-secondary',
    idle: 'border-transparent hover:border-line-strong',
    active: 'border-ink-subtle ring-3 ring-ink-subtle/12',
  },
  lost: {
    base: 'bg-danger-soft text-danger-ink',
    idle: 'border-danger/18 hover:border-danger/40',
    active: 'border-danger/70 ring-3 ring-danger/12',
  },
  found: {
    base: 'bg-primary-soft text-primary',
    idle: 'border-primary/18 hover:border-primary/40',
    active: 'border-primary/70 ring-3 ring-primary/12',
  },
}

const legendClass =
  'mb-2 p-0 text-[9.5px] font-semibold tracking-[0.06em] text-ink-subtle uppercase'

const chipClass = (active) =>
  cx(
    'flex cursor-pointer items-center justify-center rounded-xl border px-2 text-caption transition-colors disabled:cursor-not-allowed disabled:opacity-45',
    active
      ? 'border-primary/35 bg-primary-soft font-semibold text-primary'
      : 'border-transparent bg-line-subtle font-medium text-ink-secondary hover:bg-primary-subtle',
    focusRing
  )

const dateClass =
  'h-9 w-full rounded-xl border border-line bg-surface px-2.5 text-caption text-ink outline-none focus:border-primary focus:ring-3 focus:ring-primary/12 aria-invalid:border-danger'

// Chỉnh trên bản nháp, bấm "Áp dụng bộ lọc" mới lọc danh sách
export default function FeedFilters({ draft, onChange, onApply, onReset, error, idPrefix }) {
  const [expanded, setExpanded] = useState(false)
  // Thu gọn chỉ còn một hàng là lựa chọn hiện tại ('' = Tất cả danh mục)
  const categories = expanded ? ['', ...CATEGORIES] : [draft.category]

  const setDate = (key) => (e) => onChange({ [key]: e.target.value, range: 'custom' })

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault()
        onApply()
      }}
      className="flex flex-col gap-5 [--text-body:11.5px] [--text-caption:10px] [--text-small:10.5px]"
    >
      <div className="flex items-center justify-between">
        <h2 className="m-0 text-body font-bold text-ink">Bộ lọc</h2>
        <button
          type="button"
          onClick={onReset}
          className={cx(
            'cursor-pointer rounded-md border-0 bg-transparent px-1 text-caption font-medium text-primary hover:underline',
            focusRing
          )}
        >
          Xóa lọc
        </button>
      </div>

      <fieldset className="m-0 border-0 p-0">
        <legend className={legendClass}>Loại tin</legend>
        <div className="grid grid-cols-3 gap-1.5">
          {[['', 'Tất cả'], ...Object.entries(TYPE_LABELS)].map(([value, label]) => {
            const active = draft.type === value
            const tone = typeButtonTones[value || 'all']
            return (
              <button
                key={value || 'all'}
                type="button"
                aria-pressed={active}
                onClick={() => onChange({ type: value })}
                className={cx(
                  'h-9.5 cursor-pointer rounded-xl border-[1.5px] px-1 text-caption whitespace-nowrap transition',
                  tone.base,
                  active ? cx('font-semibold', tone.active) : cx('font-medium', tone.idle),
                  focusRing
                )}
              >
                {label}
              </button>
            )
          })}
        </div>
      </fieldset>

      <fieldset className="m-0 border-0 p-0">
        <legend className={legendClass}>Danh mục</legend>
        <div className="flex flex-col gap-0.5">
          {categories.map((name) => {
            const active = draft.category === name
            return (
              <button
                key={name || 'all'}
                type="button"
                aria-pressed={active}
                // Chọn xong tự thu gọn, còn lại đúng hàng vừa chọn
                onClick={() => {
                  onChange({ category: name })
                  setExpanded(false)
                }}
                className={cx(
                  'flex cursor-pointer items-center gap-2.5 rounded-xl border-0 px-2 py-1.5 text-left text-caption transition-colors',
                  active
                    ? 'bg-primary-soft font-semibold text-primary'
                    : 'bg-transparent font-medium text-ink hover:bg-surface-muted',
                  focusRing
                )}
              >
                <span
                  className={cx(
                    'grid size-8 shrink-0 place-items-center rounded-lg',
                    active ? 'bg-surface text-primary' : 'bg-line-subtle text-ink-muted'
                  )}
                >
                  <CategoryIcon name={name || 'Tất cả'} />
                </span>
                {name || 'Tất cả danh mục'}
              </button>
            )
          })}
          <button
            type="button"
            aria-expanded={expanded}
            onClick={() => setExpanded((v) => !v)}
            className={cx(
              'mt-1 flex cursor-pointer items-center gap-1 self-start rounded-lg border-0 bg-transparent px-2 py-1 text-caption font-medium text-primary hover:bg-primary-subtle',
              focusRing
            )}
          >
            {expanded ? 'Thu gọn' : `Xem tất cả ${CATEGORIES.length} danh mục`}
            <Icon name="next" size={14} className={expanded ? '-rotate-90' : 'rotate-90'} />
          </button>
        </div>
      </fieldset>

      <fieldset className="m-0 border-0 p-0">
        <legend className={legendClass}>Khu vực</legend>
        <label htmlFor={`${idPrefix}-area`} className="sr-only">
          Khu vực
        </label>
        <select
          id={`${idPrefix}-area`}
          value={draft.area}
          onChange={(e) => onChange({ area: e.target.value })}
          className="h-10 w-full cursor-pointer rounded-xl border border-line bg-surface-muted px-3 text-caption text-ink outline-none focus:border-primary focus:ring-3 focus:ring-primary/12"
        >
          <option value="">Tất cả khu vực</option>
          {AREAS.map((area) => (
            <option key={area} value={area}>
              {area}
            </option>
          ))}
        </select>
      </fieldset>

      <fieldset className="m-0 border-0 p-0">
        <legend className={legendClass}>Khoảng thời gian</legend>
        <div className="mb-3 grid grid-cols-3 gap-1.5">
          {TIME_RANGES.map((range) => (
            <button
              key={range.value}
              type="button"
              aria-pressed={draft.range === range.value}
              onClick={() => onChange({ range: range.value, from: '', to: '' })}
              className={cx('h-9 whitespace-nowrap', chipClass(draft.range === range.value))}
            >
              {range.label}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2">
          {[
            ['from', 'Từ ngày', { max: draft.to || undefined }],
            ['to', 'Đến ngày', { min: draft.from || undefined }],
          ].map(([key, label, limits]) => (
            <div key={key}>
              <label
                htmlFor={`${idPrefix}-${key}`}
                className="mb-1 block text-[9.5px] font-medium text-ink-secondary"
              >
                {label}
              </label>
              <input
                id={`${idPrefix}-${key}`}
                type="date"
                value={draft[key]}
                onChange={setDate(key)}
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? `${idPrefix}-error` : undefined}
                className={dateClass}
                {...limits}
              />
            </div>
          ))}
        </div>
        {error && (
          <p
            id={`${idPrefix}-error`}
            role="alert"
            className="mt-2 mb-0 text-caption text-danger-ink"
          >
            {error}
          </p>
        )}
      </fieldset>

      <Button type="submit" variant="primary" size="xl" block>
        Áp dụng bộ lọc
      </Button>
    </form>
  )
}
