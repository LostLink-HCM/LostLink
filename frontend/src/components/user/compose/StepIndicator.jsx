import { cx, focusRing } from '../classes'
import { cardClass } from '../Card'

// Chỉ quay lại được các bước đã đi qua, bước sau phải bấm "Tiếp tục" để kiểm tra dữ liệu
export default function StepIndicator({ steps, current, reached, onSelect }) {
  return (
    <nav aria-label="Các bước đăng bài" className={cx(cardClass, 'mb-4 px-4 py-3.5 sm:px-5')}>
      <p className="m-0 mb-2.5 text-caption text-ink-muted sm:hidden">
        Bước {current + 1}/{steps.length} ·{' '}
        <strong className="font-semibold text-ink">{steps[current].label}</strong>
      </p>
      <ol className="m-0 flex list-none items-center gap-2 p-0">
        {steps.map((step, index) => {
          const active = index === current
          const visited = index <= reached
          const last = index === steps.length - 1
          return (
            <li key={step.key} className={cx('flex items-center gap-2', !last && 'flex-1')}>
              <button
                type="button"
                disabled={!visited}
                aria-current={active ? 'step' : undefined}
                aria-label={`Bước ${index + 1}: ${step.label}`}
                onClick={() => onSelect(index)}
                className={cx(
                  'flex shrink-0 items-center gap-2 rounded-full border-0 bg-transparent p-0 disabled:cursor-default',
                  visited && !active && 'cursor-pointer',
                  focusRing
                )}
              >
                <span
                  className={cx(
                    'grid size-7 place-items-center rounded-full text-caption font-bold transition-colors',
                    active
                      ? 'bg-primary text-white'
                      : visited
                        ? 'bg-primary-soft text-primary'
                        : 'bg-line-subtle text-ink-subtle'
                  )}
                >
                  {index + 1}
                </span>
                <span
                  className={cx(
                    'hidden text-small whitespace-nowrap sm:inline',
                    active
                      ? 'font-semibold text-ink'
                      : visited
                        ? 'font-medium text-ink-secondary'
                        : 'font-medium text-ink-subtle'
                  )}
                >
                  {step.label}
                </span>
              </button>
              {!last && (
                <span
                  aria-hidden="true"
                  className={cx(
                    'h-0.5 min-w-3 flex-1 rounded-full',
                    index < current ? 'bg-primary/40' : 'bg-line'
                  )}
                />
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
