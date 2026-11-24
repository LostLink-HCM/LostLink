import { useEffect, useRef, useState } from 'react'
import Icon from '../../common/Icon'
import { cx, focusRing } from '../classes'

const WEEKDAYS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN']

const pad = (n) => String(n).padStart(2, '0')
// Ngày lưu dạng yyyy-mm-dd theo giờ máy, so sánh chuỗi là so sánh ngày
const toKey = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
const fromKey = (key) => {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d)
}
const shift = (key, days) => {
  const date = fromKey(key)
  date.setDate(date.getDate() + days)
  return toKey(date)
}
const shiftMonth = (key, months) => {
  const date = fromKey(key)
  const day = date.getDate()
  date.setDate(1)
  date.setMonth(date.getMonth() + months)
  // Giữ ngày cũ, tháng ngắn hơn thì lấy ngày cuối tháng
  const last = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
  date.setDate(Math.min(day, last))
  return toKey(date)
}
const clamp = (key, min, max) => (min && key < min ? min : max && key > max ? max : key)

const fullLabel = new Intl.DateTimeFormat('vi-VN', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})

// Lịch chọn một ngày bằng tiếng Việt, tuần bắt đầu từ thứ Hai.
// rangeFrom/rangeTo: tô nhạt các ngày nằm giữa khoảng đang lọc
export default function MiniCalendar({
  id,
  label,
  value,
  min,
  max,
  rangeFrom,
  rangeTo,
  onPick,
  onClose,
}) {
  // Lấy ngày hôm nay một lần lúc mở lịch
  const [today] = useState(() => toKey(new Date()))
  const [cursor, setCursor] = useState(() => clamp(value || today, min, max))
  // days: lưới ngày; months: bấm tiêu đề để chọn tháng và năm nhanh
  const [mode, setMode] = useState('days')
  const [pickYear, setPickYear] = useState(null)
  const gridRef = useRef(null)
  // Mở lịch hoặc đi bằng phím mũi tên thì focus theo ngày; bấm nút đổi tháng thì focus giữ ở nút
  const followFocus = useRef(true)

  useEffect(() => {
    if (!followFocus.current) return
    gridRef.current?.querySelector(`[data-day="${cursor}"]`)?.focus()
    followFocus.current = false
  }, [cursor])

  const view = fromKey(cursor)
  const year = view.getFullYear()
  const month = view.getMonth()
  const offset = (new Date(year, month, 1).getDay() + 6) % 7
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells = Array.from({ length: Math.ceil((offset + daysInMonth) / 7) * 7 }, (_, i) =>
    toKey(new Date(year, month, i - offset + 1))
  )
  const disabled = (key) => (min && key < min) || (max && key > max)

  const moveTo = (key) => setCursor(clamp(key, min, max))

  const onKeyDown = (e) => {
    const weekday = (fromKey(cursor).getDay() + 6) % 7
    const steps = {
      ArrowLeft: () => shift(cursor, -1),
      ArrowRight: () => shift(cursor, 1),
      ArrowUp: () => shift(cursor, -7),
      ArrowDown: () => shift(cursor, 7),
      Home: () => shift(cursor, -weekday),
      End: () => shift(cursor, 6 - weekday),
      PageUp: () => shiftMonth(cursor, -1),
      PageDown: () => shiftMonth(cursor, 1),
    }
    if (steps[e.key]) {
      e.preventDefault()
      followFocus.current = true
      moveTo(steps[e.key]())
    }
  }

  const navClass = cx(
    'grid size-6.5 cursor-pointer place-items-center rounded-md border-0 bg-transparent text-ink-muted transition-colors hover:bg-primary-subtle hover:text-primary disabled:cursor-not-allowed disabled:opacity-35',
    focusRing
  )
  const titleClass = cx(
    'inline-flex cursor-pointer items-center gap-1 rounded-md border-0 bg-transparent px-1.5 py-0.5 text-caption font-bold text-ink transition-colors hover:bg-primary-subtle hover:text-primary',
    focusRing
  )
  const firstOfMonth = toKey(new Date(year, month, 1))
  const lastOfMonth = toKey(new Date(year, month, daysInMonth))

  return (
    <div
      id={id}
      role="dialog"
      aria-label={label}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.stopPropagation()
          onClose()
        }
      }}
      className="mt-2 rounded-xl border border-line bg-surface p-2.5 shadow-soft motion-safe:animate-ll-fade"
    >
      {mode === 'days' ? (
        <div className="mb-1.5 flex items-center justify-between">
          <button
            type="button"
            aria-label="Tháng trước"
            disabled={Boolean(min) && firstOfMonth <= min}
            onClick={() => moveTo(shiftMonth(cursor, -1))}
            className={navClass}
          >
            <Icon name="back" size={14} />
          </button>
          <button
            type="button"
            aria-expanded={false}
            onClick={() => {
              setPickYear(year)
              setMode('months')
            }}
            className={titleClass}
          >
            <span aria-live="polite">
              Tháng {month + 1}, {year}
            </span>
            <Icon name="next" size={12} className="rotate-90" />
          </button>
          <button
            type="button"
            aria-label="Tháng sau"
            disabled={Boolean(max) && lastOfMonth >= max}
            onClick={() => moveTo(shiftMonth(cursor, 1))}
            className={navClass}
          >
            <Icon name="next" size={14} />
          </button>
        </div>
      ) : (
        <div className="mb-1.5 flex items-center justify-between">
          <button
            type="button"
            aria-label="Năm trước"
            disabled={Boolean(min) && `${pickYear}-01-01` <= min}
            onClick={() => setPickYear((y) => y - 1)}
            className={navClass}
          >
            <Icon name="back" size={14} />
          </button>
          <button
            type="button"
            aria-expanded
            onClick={() => setMode('days')}
            className={titleClass}
          >
            <span aria-live="polite">Năm {pickYear}</span>
            <Icon name="next" size={12} className="-rotate-90" />
          </button>
          <button
            type="button"
            aria-label="Năm sau"
            disabled={Boolean(max) && `${pickYear}-12-31` >= max}
            onClick={() => setPickYear((y) => y + 1)}
            className={navClass}
          >
            <Icon name="next" size={14} />
          </button>
        </div>
      )}

      {mode === 'days' ? (
        <div
          ref={gridRef}
          role="grid"
          aria-label={`Tháng ${month + 1}, ${year}`}
          onKeyDown={onKeyDown}
        >
          <div role="row" className="grid grid-cols-7">
            {WEEKDAYS.map((day) => (
              <span
                key={day}
                role="columnheader"
                className={cx(
                  'py-1 text-center text-micro font-semibold',
                  day === 'CN' ? 'text-danger-ink' : 'text-ink-subtle'
                )}
              >
                {day}
              </span>
            ))}
          </div>
          {Array.from({ length: cells.length / 7 }, (_, row) => (
            <div key={row} role="row" className="grid grid-cols-7 gap-y-0.5">
              {cells.slice(row * 7, row * 7 + 7).map((key) => {
                const date = fromKey(key)
                const outside = date.getMonth() !== month
                const selected = key === value
                const inRange = rangeFrom && rangeTo && key > rangeFrom && key < rangeTo
                const off = disabled(key)
                return (
                  <span key={key} role="gridcell" aria-selected={selected}>
                    <button
                      type="button"
                      data-day={key}
                      tabIndex={key === cursor ? 0 : -1}
                      disabled={off}
                      aria-label={fullLabel.format(date)}
                      aria-current={key === today ? 'date' : undefined}
                      onClick={() => onPick(key)}
                      className={cx(
                        'grid h-6.5 w-full cursor-pointer place-items-center rounded-md border-0 text-caption tabular-nums transition-colors disabled:cursor-not-allowed disabled:opacity-30',
                        selected
                          ? 'bg-primary font-bold text-white'
                          : cx(
                              inRange ? 'bg-primary-soft' : 'bg-transparent',
                              outside ? 'text-ink-subtle/70' : 'text-ink',
                              key === today &&
                                'font-bold text-primary ring-1 ring-primary/40 ring-inset',
                              !off && 'hover:bg-primary-subtle hover:text-primary'
                            ),
                        focusRing
                      )}
                    >
                      {date.getDate()}
                    </button>
                  </span>
                )
              })}
            </div>
          ))}
        </div>
      ) : (
        // Chọn tháng: giữ ngày đang chọn, tháng ngắn hơn thì lấy ngày cuối tháng
        <div className="grid grid-cols-3 gap-1 py-1">
          {Array.from({ length: 12 }, (_, m) => {
            const first = toKey(new Date(pickYear, m, 1))
            const last = toKey(new Date(pickYear, m + 1, 0))
            const off = (min && last < min) || (max && first > max)
            const current = pickYear === year && m === month
            return (
              <button
                key={m}
                type="button"
                disabled={off}
                aria-pressed={current}
                onClick={() => {
                  const lastDay = new Date(pickYear, m + 1, 0).getDate()
                  followFocus.current = true
                  moveTo(toKey(new Date(pickYear, m, Math.min(view.getDate(), lastDay))))
                  setMode('days')
                }}
                className={cx(
                  'h-8 cursor-pointer rounded-md border-0 text-caption transition-colors disabled:cursor-not-allowed disabled:opacity-30',
                  current
                    ? 'bg-primary font-bold text-white'
                    : 'bg-transparent font-medium text-ink hover:bg-primary-subtle hover:text-primary',
                  focusRing
                )}
              >
                Tháng {m + 1}
              </button>
            )
          })}
        </div>
      )}

      <div className="mt-2 flex items-center justify-between border-t border-line-subtle pt-2">
        <button
          type="button"
          onClick={() => onPick('')}
          className={cx(
            'cursor-pointer rounded-md border-0 bg-transparent px-1.5 py-0.5 text-caption font-medium text-ink-muted hover:text-danger-ink',
            focusRing
          )}
        >
          Xóa
        </button>
        <button
          type="button"
          disabled={Boolean(disabled(today))}
          onClick={() => onPick(today)}
          className={cx(
            'cursor-pointer rounded-md border-0 bg-transparent px-1.5 py-0.5 text-caption font-semibold text-primary hover:bg-primary-subtle disabled:cursor-not-allowed disabled:opacity-40',
            focusRing
          )}
        >
          Hôm nay
        </button>
      </div>
    </div>
  )
}
