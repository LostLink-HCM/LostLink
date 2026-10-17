import { cx, focusRing } from '../moderator/classes'

export const card = 'rounded-2xl border border-line bg-surface shadow-card'

export const inputClass =
  'w-full min-w-0 rounded-xl border border-line-strong bg-surface px-3.5 text-body text-ink outline-none transition placeholder:text-ink-subtle focus:border-primary focus:ring-3 focus:ring-primary/12 aria-invalid:border-danger'

export const labelClass = 'mb-2 block p-0 text-small font-semibold text-ink'

// Chip chọn giá trị, dùng aria-pressed để báo trạng thái
export const chipClass = (active) =>
  cx(
    'inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-full border px-3.5 text-small transition-colors',
    active
      ? 'border-primary/40 bg-primary-soft font-semibold text-primary'
      : 'border-line bg-surface font-medium text-ink-secondary hover:border-primary/30 hover:bg-primary-subtle',
    focusRing
  )

// Ô lựa chọn dạng thẻ (danh mục, buổi trong ngày, cách chọn vị trí)
export const tileClass = (active) =>
  cx(
    'flex cursor-pointer rounded-xl border text-left transition-colors',
    active
      ? 'border-primary/50 bg-primary-soft text-primary ring-3 ring-primary/10'
      : 'border-line bg-surface text-ink-secondary hover:border-primary/30 hover:bg-primary-subtle',
    focusRing
  )

const buttonBase =
  'inline-flex h-11 cursor-pointer items-center justify-center gap-2 rounded-full px-5 text-small font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-45'

export const primaryButton = cx(
  buttonBase,
  'border-0 bg-primary text-white shadow-[0_6px_16px_-6px_rgb(46_109_180/0.7)] hover:bg-primary-hover',
  focusRing
)

export const secondaryButton = cx(
  buttonBase,
  'border border-line bg-surface text-ink-secondary hover:bg-surface-muted',
  focusRing
)
