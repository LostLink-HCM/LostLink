import { useRef } from 'react'
import Icon from '../../common/Icon'
import { cx, focusRing } from '../../backoffice/classes'

// Mỗi tab một sắc của thang ramp, đậm dần sang nhạt theo thứ tự tab
const CATEGORY_TABS = [
  { key: 'general', label: 'Thông tin chung', icon: 'info' },
  { key: 'attributes', label: 'Thuộc tính', icon: 'list' },
  { key: 'relations', label: 'Quan hệ', icon: 'link' },
  { key: 'algorithm', label: 'Cấu hình thuật toán', icon: 'activity' },
  { key: 'questions', label: 'Câu hỏi xác minh', icon: 'chat' },
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
      className="flex gap-1 overflow-x-auto border-b border-[#c4d2e2]"
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
              'flex min-w-0 shrink-0 cursor-pointer items-center gap-2.5 border-b-2 px-4 py-2.5 text-left text-small font-semibold transition-colors',
              active
                ? 'border-[#3976bd] text-[#24476b]'
                : 'border-transparent text-[#71839a] hover:text-[#24476b]',
              focusRing
            )}
          >
            <span
              className={cx(
                'grid size-7 shrink-0 place-items-center rounded-full border transition-colors',
                active
                  ? 'border-[#d5e0ec] bg-[#edf3fa] text-[#3976bd]'
                  : 'border-[#e3ebf3] bg-[#f7fafd] text-[#71839a]'
              )}
            >
              <Icon name={tab.icon} size={14} />
            </span>
            <span className="min-w-0 leading-snug">{tab.label}</span>
          </button>
        )
      })}
    </div>
  )
}
