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
export default function FeedFilters({
  draft,
  activeCount = 0,
  onChange,
  onApply,
  onReset,
  error,
  idPrefix,
}) {
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
      {/* Giữ chiều cao cố định để nút xuất hiện không đẩy các mục bên dưới */}
      <div className="flex min-h-7 items-center justify-between">
        <h2 className="m-0 text-body font-bold text-ink">Bộ lọc</h2>
        {/* Chỉ hiện khi đã chọn ít nhất một tiêu chí khác mặc định */}
        {activeCount > 0 && (
          <button
            type="button"
            onClick={onReset}
            aria-label={`Xóa lọc, đang chọn ${activeCount} tiêu chí`}
            className={cx(
              'group inline-flex cursor-pointer items-center gap-1 rounded-full border border-primary/30 bg-primary-soft py-1 pr-1 pl-2.5 text-caption font-semibold text-primary shadow-[0_2px_8px_-2px_rgb(46_109_180/0.35)] transition-colors hover:bg-primary hover:text-white motion-safe:animate-ll-fade',
              focusRing
            )}
          >
            <Icon name="reset" size={12} />
            Xóa lọc
            <span className="grid min-w-4.5 place-items-center rounded-full bg-primary px-1 text-[9px] leading-4.5 font-bold text-white transition-colors group-hover:bg-white group-hover:text-primary">
              {activeCount}
            </span>
          </button>
        )}
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

      <PickList
        legend="Danh mục"
        value={draft.category}
        options={CATEGORIES}
        allLabel="Tất cả danh mục"
        unit="danh mục"
        renderIcon={(name) => <CategoryIcon name={name || 'Tất cả'} />}
        onPick={(category) => onChange({ category })}
      />

      <PickList
        legend="Khu vực"
        value={draft.area}
        options={AREAS}
        allLabel="Tất cả khu vực"
        unit="khu vực"
        renderIcon={(area) => <Icon name={area ? 'pin' : 'locate'} size={16} />}
        onPick={(area) => onChange({ area })}
      />

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

// Danh sách chọn một: thu gọn chỉ còn hàng đang chọn ('' = Tất cả), bấm "Xem tất cả" để mở,
// chọn xong tự thu gọn. Dùng chung cho Danh mục và Khu vực
function PickList({ legend, value, options, allLabel, unit, renderIcon, onPick }) {
  const [expanded, setExpanded] = useState(false)
  const shown = expanded ? ['', ...options] : [value]

  return (
    <fieldset className="m-0 border-0 p-0">
      <legend className={legendClass}>{legend}</legend>
      <div className="flex flex-col gap-0.5">
        {shown.map((option) => {
          const active = value === option
          return (
            <button
              key={option || 'all'}
              type="button"
              aria-pressed={active}
              onClick={() => {
                onPick(option)
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
                {renderIcon(option)}
              </span>
              {option || allLabel}
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
          {expanded ? 'Thu gọn' : `Xem tất cả ${options.length} ${unit}`}
          <Icon name="next" size={14} className={expanded ? '-rotate-90' : 'rotate-90'} />
        </button>
      </div>
    </fieldset>
  )
}
