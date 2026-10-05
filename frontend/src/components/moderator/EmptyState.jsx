import Icon from '../common/Icon'

export default function EmptyState({ icon = 'check', title, description }) {
  return (
    <div className="flex flex-col items-center px-5 py-14 text-center text-ink-subtle">
      <Icon name={icon} size={36} />
      <h3 className="mt-4 mb-2 text-lead font-semibold text-ink">{title}</h3>
      {description && <p className="text-caption">{description}</p>}
    </div>
  )
}
