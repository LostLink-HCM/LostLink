import Card from '../Card'

// Khung một mục trong trang Cài đặt: tiêu đề, mô tả ngắn và nội dung
export default function SettingsCard({ title, description, actions, children }) {
  return (
    <Card as="section" className="p-5 lg:p-6">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="m-0 text-lead font-bold text-ink">{title}</h2>
          {description && (
            <p className="m-0 mt-1 text-caption leading-relaxed text-ink-muted">{description}</p>
          )}
        </div>
        {actions}
      </div>
      {children}
    </Card>
  )
}
