// Tiện ích class dùng riêng cho khu người dùng
export const focusRing =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus'

export const cx = (...classes) => classes.filter(Boolean).join(' ')

// Khuôn chung cho nhãn loại tin và trạng thái bài để cùng cỡ
export const tagClass =
  'inline-flex items-center rounded-full px-2.5 py-0.5 text-micro font-bold tracking-wide uppercase'

export const textareaClass =
  'block w-full resize-y rounded-xl border border-line-strong bg-surface px-3.5 py-3 text-body leading-relaxed text-ink outline-none transition placeholder:text-ink-subtle focus:border-primary focus:ring-3 focus:ring-primary/12 aria-invalid:border-danger'
