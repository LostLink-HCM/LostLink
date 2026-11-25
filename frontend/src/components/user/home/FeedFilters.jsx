import { useEffect, useRef, useState } from 'react'
import { AREAS } from '../../../data/homeFeed'
import { useFeedCategories } from '../../../hooks/useFeedCategories'
import { TIME_RANGES, TYPE_LABELS } from '../../../lib/user/homeFeed'
import Icon from '../../common/Icon'
import Button from '../Button'
import { cx, focusRing } from '../classes'
import CategoryIcon from './CategoryIcon'
import DateField from './DateField'
import MiniCalendar from './MiniCalendar'

const DATE_LABELS = { from: 'Từ ngày', to: 'Đến ngày' }

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
    base: 'bg-success-soft text-success',
    idle: 'border-success/18 hover:border-success/40',
    active: 'border-success/70 ring-3 ring-success/12',
  },
}

const legendClass =
  'mb-1.5 p-0 text-micro font-semibold tracking-[0.06em] text-ink-subtle uppercase'

const chipClass = (active) =>
  cx(
    'flex cursor-pointer items-center justify-center rounded-xl border px-2 text-caption transition-colors disabled:cursor-not-allowed disabled:opacity-45',
    active
      ? 'border-primary/35 bg-primary-soft font-semibold text-primary'
      : 'border-transparent bg-line-subtle font-medium text-ink-secondary hover:bg-primary-subtle',
    focusRing
  )

const dateClass =
  'h-9 rounded-lg border border-line bg-surface px-2 text-caption outline-none focus-visible:border-primary aria-invalid:border-danger'

// Chọn chip (loại tin, danh mục, khu vực, khoảng thời gian) là lọc ngay. Riêng khoảng ngày tự chọn
// nằm ở bản nháp, pendingDates bật nút "Áp dụng khoảng ngày" để xác nhận rồi mới lọc
export default function FeedFilters({
  draft,
  activeCount = 0,
  pendingDates = false,
  onChange,
  onApply,
  onReset,
  error,
  idPrefix,
  scrollBody = false,
  categoryPicker = true,
}) {
  // Ô ngày đang mở lịch ('from' | 'to' | null), lịch hiện ngay dưới hai ô
  const [picking, setPicking] = useState(null)
  const dateBoxRef = useRef(null)
  const calendarId = `${idPrefix}-calendar`

  const closeCalendar = () => {
    document.getElementById(`${idPrefix}-${picking}`)?.focus()
    setPicking(null)
  }
  const pickDate = (value) => {
    onChange({ [picking]: value, range: 'custom' })
    closeCalendar()
  }

  // Bấm ra ngoài khu chọn ngày thì đóng lịch
  useEffect(() => {
    if (!picking) return
    const onPointerDown = (e) => {
      if (!dateBoxRef.current?.contains(e.target)) setPicking(null)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [picking])

  const categories = useFeedCategories()
  const categoryName = (slug) => categories.find((item) => item.slug === slug)?.name ?? ''

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault()
        onApply()
      }}
      className="flex min-h-0 flex-col gap-3"
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
              'group inline-flex cursor-pointer items-center gap-1 rounded-full border border-primary/30 bg-primary-soft py-1.5 pr-1.5 pl-3 text-caption font-semibold text-primary shadow-[0_2px_8px_-2px_color-mix(in_srgb,var(--color-primary)_35%,transparent)] transition-colors hover:bg-primary hover:text-white motion-safe:animate-ll-fade',
              focusRing
            )}
          >
            <Icon name="reset" size={12} />
            Xóa lọc
            <span className="grid min-w-4.5 place-items-center rounded-full bg-primary px-1 text-micro leading-4.5 font-bold text-white transition-colors group-hover:bg-white group-hover:text-primary">
              {activeCount}
            </span>
          </button>
        )}
      </div>

      {/* scrollBody: tiêu đề đứng yên, chỉ phần dưới cuộn khi khung bị giới hạn chiều cao */}
      <div
        className={cx(
          'flex flex-col gap-3.5',
          scrollBody &&
            '-mr-3 min-h-0 overflow-y-auto overscroll-contain pr-3 pb-1 [scrollbar-width:thin]'
        )}
      >
        {!categoryPicker && (
          <ActiveChips
            items={[
              draft.category && {
                key: 'category',
                label: categoryName(draft.category) || draft.category,
                icon: <CategoryIcon name={categoryName(draft.category)} size={12} />,
              },
            ].filter(Boolean)}
            onRemove={(key) => onChange({ [key]: '' })}
          />
        )}

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
                    // Cùng khuôn với các chip khác trong bộ lọc, giữ màu riêng của từng loại tin
                    'h-9 cursor-pointer rounded-xl border px-1 text-caption whitespace-nowrap transition',
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

        {categoryPicker && (
          <PickList
            legend="Danh mục"
            value={draft.category}
            options={categories.map((item) => item.slug)}
            labelOf={categoryName}
            allLabel="Tất cả danh mục"
            unit="danh mục"
            renderIcon={(slug) => <CategoryIcon name={categoryName(slug) || 'Tất cả'} size={16} />}
            onPick={(category) => onChange({ category })}
          />
        )}

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
          <div className="mb-2 grid grid-cols-3 gap-1.5">
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
          <div ref={dateBoxRef}>
            <div className="grid grid-cols-2 gap-2">
              {['from', 'to'].map((key) => (
                <div key={key}>
                  <label
                    htmlFor={`${idPrefix}-${key}`}
                    className="mb-0.5 block text-tiny font-medium text-ink-secondary"
                  >
                    {DATE_LABELS[key]}
                  </label>
                  <DateField
                    id={`${idPrefix}-${key}`}
                    value={draft[key]}
                    open={picking === key}
                    controls={calendarId}
                    onToggle={() => setPicking((current) => (current === key ? null : key))}
                    invalid={Boolean(error)}
                    describedBy={error ? `${idPrefix}-error` : undefined}
                    className={dateClass}
                  />
                </div>
              ))}
            </div>
            {picking && (
              <MiniCalendar
                // Đổi ô thì dựng lại lịch để mở đúng tháng của ô đó
                key={picking}
                id={calendarId}
                label={`Chọn ${DATE_LABELS[picking].toLowerCase()}`}
                value={draft[picking]}
                min={picking === 'to' ? draft.from || undefined : undefined}
                max={picking === 'from' ? draft.to || undefined : undefined}
                rangeFrom={draft.from}
                rangeTo={draft.to}
                onPick={pickDate}
                onClose={closeCalendar}
              />
            )}
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
          {pendingDates && (
            <Button type="submit" variant="cta" size="md" block className="mt-2.5">
              Áp dụng khoảng ngày
            </Button>
          )}
        </fieldset>
      </div>
    </form>
  )
}

function ActiveChips({ items, onRemove }) {
  if (!items.length) return null
  return (
    <div className="motion-safe:animate-ll-fade">
      <p className={cx(legendClass, 'm-0')}>Đang lọc</p>
      <div className="flex flex-wrap gap-1.5">
        {items.map(({ key, label, icon }) => (
          <button
            key={key}
            type="button"
            aria-label={`Bỏ lọc ${label}`}
            onClick={() => onRemove(key)}
            className={cx(
              'inline-flex max-w-full cursor-pointer items-center gap-1.5 rounded-full border border-primary/30 bg-primary-soft py-1 pr-1.5 pl-2 text-caption font-semibold text-primary transition-colors hover:bg-primary hover:text-white',
              focusRing
            )}
          >
            <span className="shrink-0">{icon}</span>
            <span className="truncate">{label}</span>
            <Icon name="close" size={11} className="shrink-0" />
          </button>
        ))}
      </div>
    </div>
  )
}

// Danh sách chọn một: thu gọn chỉ còn hàng đang chọn ('' = Tất cả), bấm "Xem tất cả" để mở,
// chọn xong tự thu gọn. Dùng chung cho Danh mục và Khu vực
// labelOf: giá trị → tên hiển thị (danh mục lưu slug, hiện tên)
function PickList({
  legend,
  value,
  options,
  labelOf = (option) => option,
  allLabel,
  unit,
  renderIcon,
  onPick,
}) {
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
                'flex cursor-pointer items-center gap-2.5 rounded-lg border-0 px-2 py-1.5 text-left text-small transition-colors',
                active
                  ? 'bg-primary-soft font-semibold text-primary'
                  : 'bg-transparent font-medium text-ink hover:bg-surface-muted',
                focusRing
              )}
            >
              <span
                className={cx(
                  'grid size-7.5 shrink-0 place-items-center rounded-md',
                  active ? 'bg-surface text-primary' : 'bg-line-subtle text-ink-muted'
                )}
              >
                {renderIcon(option)}
              </span>
              {option ? labelOf(option) || option : allLabel}
            </button>
          )
        })}
        <button
          type="button"
          aria-expanded={expanded}
          onClick={() => setExpanded((v) => !v)}
          className={cx(
            'mt-0.5 flex cursor-pointer items-center gap-1 self-start rounded-lg border-0 bg-transparent px-1.5 py-0.5 text-caption font-medium text-primary hover:bg-primary-subtle',
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
