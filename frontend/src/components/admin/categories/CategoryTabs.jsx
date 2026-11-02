import { useRef } from 'react'
import Icon from '../../common/Icon'
import { cx, focusRing } from '../../backoffice/classes'

// Mỗi tab một sắc của thang ramp, đậm dần sang nhạt theo thứ tự tab
const CATEGORY_TABS = [
  { key: 'general', label: 'Thông tin chung', icon: 'info', tone: 'bg-ramp-1 text-white' },
  { key: 'attributes', label: 'Thuộc tính', icon: 'list', tone: 'bg-ramp-2 text-white' },
  { key: 'relations', label: 'Quan hệ', icon: 'link', tone: 'bg-ramp-3 text-white' },
  {
    key: 'algorithm',
    label: 'Cấu hình thuật toán',
    icon: 'activity',
    tone: 'bg-ramp-4 text-ramp-1',
  },
  { key: 'questions', label: 'Câu hỏi xác minh', icon: 'chat', tone: 'bg-ramp-5 text-ramp-1' },
]

export default function CategoryTabs({ value, onChange }) {
  const refs = useRef([])
  const move = (event, index) => {
    const step = { ArrowRight: 1, ArrowLeft: -1 }[event.key]
    if (!step) return
    event.preventDefault()
    const next = (index + step + CATEGORY_TABS.length) % CATEGORY_TABS.length
    onChange(CATEGORY_TABS[next].key)
    refs.current[next]?.focus()
  }

  return (
    <div
      role="tablist"
      aria-label="Nhóm cấu hình danh mục"
      className="grid [grid-template-columns:repeat(5,minmax(150px,1fr))] gap-1 overflow-x-auto rounded-2xl bg-white/80 p-1.5 ring-1 ring-line-soft"
    >
      {CATEGORY_TABS.map((tab, index) => {
        const active = tab.key === value
        return (
          <button
            key={tab.key}
            ref={(node) => {
              refs.current[index] = node
            }}
            type="button"
            role="tab"
            id={`category-tab-${tab.key}`}
            aria-selected={active}
            aria-controls={`category-panel-${tab.key}`}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(tab.key)}
            onKeyDown={(event) => move(event, index)}
            className={cx(
              'flex min-w-0 cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2 text-left text-small font-semibold whitespace-nowrap transition duration-200',
              active
                ? cx('shadow-raised', tab.tone)
                : 'text-ink-muted hover:bg-primary-subtle hover:text-primary',
              focusRing
            )}
          >
            <span
              className={cx(
                'grid size-7 shrink-0 place-items-center rounded-full transition-colors',
                active ? 'bg-white/25' : tab.tone
              )}
            >
              <Icon name={tab.icon} size={14} />
            </span>
            <span className="min-w-0 truncate">{tab.label}</span>
          </button>
        )
      })}
    </div>
  )
}
